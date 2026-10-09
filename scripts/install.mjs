/**
 * Sets this tool up: checks Node.js, git and (for a Python tool) Python,
 * installs dependencies, turns on the git pre-commit hook, copies the slash
 * commands. One command, no questions, safe to re-run.
 *
 * TOOL-KIT MODULE "install". The source is tool-techne/kit/. Never edit a
 * tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails a
 * tool whose copy differs from the source.
 *
 * A step only one tool needs (a browser download, a file that must exist)
 * goes in that tool's own script, listed in tool.json "setupExtra". Each is
 * run with node after the standard steps, with --check passed through, and
 * must exit non-zero when something is missing.
 *
 * Usage:
 *   node scripts/install.mjs                  install
 *   node scripts/install.mjs --scope user     commands somewhere else:
 *                                             tool, parent, user or none
 *   node scripts/install.mjs --check          report only, change nothing
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tool.json'), 'utf8'));
const pkgPath = path.join(ROOT, 'package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
const scopeAt = process.argv.indexOf('--scope');
const scope = scopeAt === -1 ? manifest.commands?.install || 'tool' : process.argv[scopeAt + 1];

const steps = [];

/**
 * Records and prints one step's outcome.
 * @param {boolean} ok Whether it worked.
 * @param {string} label What it was.
 * @param {string=} detail What to do if it failed.
 * @return {void}
 */
function step(ok, label, detail) {
  steps.push({ok, label});
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

/**
 * @param {string} a A version like 22.15.0.
 * @param {string} b Another.
 * @return {boolean} Whether a is at least b.
 */
function atLeast(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return true;
}

console.log(`\n  ${manifest.title}: setup\n`);

const need = String(pkg.engines?.node || '22').replace(/^>=\s*/, '');
step(atLeast(process.versions.node, need), `Node.js ${process.versions.node} (needs ${need} or newer)`,
    `Install Node.js ${need} or newer from https://nodejs.org (the LTS button).`);

const git = spawnSync('git', ['--version'], {encoding: 'utf8'});
step(git.status === 0, git.status === 0 ? git.stdout.trim() : 'git',
    'Install git from https://git-scm.com/downloads, then open a new terminal.');

if (manifest.stack === 'python') pythonSteps();

// The pre-commit hook runs the quick check before every commit, whichever
// AI is used, or none. git does not copy this setting with the folder, so
// it is set here.
if (fs.existsSync(path.join(ROOT, '.git')) && fs.existsSync(path.join(ROOT, '.githooks', 'pre-commit'))) {
  const cur = spawnSync('git', ['config', '--get', 'core.hooksPath'], {cwd: ROOT, encoding: 'utf8'}).stdout.trim();
  if (cur !== '.githooks' && !CHECK) {
    spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {cwd: ROOT});
  }
  step(CHECK ? cur === '.githooks' : true, 'git pre-commit hook on (runs the quick check before each commit)',
      'Run: node scripts/install.mjs');
}

const deps = Object.keys({...pkg.dependencies, ...pkg.devDependencies});
if (deps.length) {
  const missing = deps.filter((d) => !fs.existsSync(path.join(ROOT, 'node_modules', d)));
  if (CHECK || !missing.length) {
    step(!missing.length, 'Dependencies installed', 'Run: npm install');
  } else {
    let ok = true;
    try {
      execFileSync('npm', ['install', '--no-audit', '--no-fund'],
          {cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32'});
    } catch {
      ok = false;
    }
    step(ok, 'Dependencies installed', 'npm install failed. Read the output above.');
  }
}

/**
 * Python 3 at the version pyproject.toml asks for, and the packages in
 * requirements.txt installed into .venv/ (only when it lists any).
 * @return {void}
 */
function pythonSteps() {
  const venvPy = process.platform === 'win32'
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python');
  let py = null;
  let ver = '';
  // python3 is tried by running it: on Windows it is often a Microsoft
  // Store placeholder that is not Python.
  for (const [cmd, ...pre] of [['python'], ['python3'], ['py', '-3']]) {
    const r = spawnSync(cmd, [...pre, '--version'], {encoding: 'utf8'});
    const m = /^Python (3\.\d+\.\d+)/.exec(`${r.stdout || ''}${r.stderr || ''}`.trim());
    if (r.status === 0 && m) {
      py = [cmd, ...pre];
      ver = m[1];
      break;
    }
  }
  let pyNeed = '3.10';
  try {
    pyNeed = /requires-python\s*=\s*">=\s*([\d.]+)"/.exec(fs.readFileSync(path.join(ROOT, 'pyproject.toml'), 'utf8'))?.[1] || pyNeed;
  } catch {
    /* default */
  }
  step(Boolean(py) && atLeast(ver, pyNeed), py ? `Python ${ver} (needs ${pyNeed} or newer)` : 'Python 3',
      `Install Python ${pyNeed} or newer from https://www.python.org/downloads/ (on Windows, tick "Add python.exe to PATH").`);
  if (!py) return;

  const reqFile = path.join(ROOT, 'requirements.txt');
  const reqs = fs.existsSync(reqFile)
    ? fs.readFileSync(reqFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    : [];
  if (!reqs.length) return;
  if (CHECK) {
    step(fs.existsSync(venvPy), `${reqs.length} Python package(s) in .venv/`, 'Run: node scripts/install.mjs');
    return;
  }
  if (!fs.existsSync(venvPy)) spawnSync(py[0], [...py.slice(1), '-m', 'venv', '.venv'], {cwd: ROOT, stdio: 'inherit'});
  const pip = spawnSync(venvPy, ['-m', 'pip', 'install', '-q', '-r', 'requirements.txt'], {cwd: ROOT, stdio: 'inherit'});
  step(pip.status === 0, `${reqs.length} Python package(s) installed in .venv/`, 'pip install failed. Read the output above.');
}

// Slash commands: commands/ is the source, every other copy is installed.
const src = path.join(ROOT, 'commands');
const files = fs.existsSync(src) ? fs.readdirSync(src).filter((f) => f.endsWith('.md')) : [];
const dests = {
  tool: [path.join(ROOT, '.claude', 'commands')],
  parent: [path.join(ROOT, '.claude', 'commands'), path.join(ROOT, '..', '.claude', 'commands')],
  user: [path.join(os.homedir(), '.claude', 'commands')],
  none: [],
}[scope];
if (!dests) {
  step(false, `--scope ${scope}`, 'Use tool, parent, user or none.');
} else if (files.length) {
  for (const dest of dests) {
    const same = files.every((f) => {
      try {
        return fs.readFileSync(path.join(dest, f), 'utf8') === fs.readFileSync(path.join(src, f), 'utf8');
      } catch {
        return false;
      }
    });
    if (!CHECK) {
      fs.mkdirSync(dest, {recursive: true});
      files.forEach((f) => fs.copyFileSync(path.join(src, f), path.join(dest, f)));
    }
    step(CHECK ? same : true, `${files.length} slash command(s) in ${dest}`,
        `Out of date. Run: node scripts/install.mjs --scope ${scope}`);
  }
}

// The tool's own setup steps, after the standard ones.
for (const extra of Array.isArray(manifest.setupExtra) ? manifest.setupExtra : []) {
  console.log(`\n  --- ${extra}\n`);
  const r = spawnSync(process.execPath, [extra, ...(CHECK ? ['--check'] : [])], {cwd: ROOT, stdio: 'inherit'});
  console.log('');
  step(r.status === 0, `This tool's own setup (${extra})`, 'Read its output above.');
}

const failed = steps.filter((s) => !s.ok);
console.log('');
if (!failed.length) {
  console.log('  Ready.\n');
  process.exit(0);
}
console.log(`  ${failed.length} problem(s):`);
failed.forEach((f) => console.log(`    - ${f.label}`));
console.log('');
process.exit(1);
