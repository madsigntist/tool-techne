/**
 * Sets this tool up: checks Node.js and git, installs dependencies, copies
 * the slash commands. One command, no questions, safe to re-run.
 *
 * TOOL-KIT MODULE "install". The source is tool-techne/kit/. Never edit a
 * tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails a
 * tool whose copy differs from the source. A step only one tool needs goes
 * in that tool's own script, run from tool.json "setupCheck".
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

const need = String(pkg.engines?.node || '18').replace(/^>=\s*/, '');
step(atLeast(process.versions.node, need), `Node.js ${process.versions.node} (needs ${need} or newer)`,
    `Install Node.js ${need} or newer from https://nodejs.org (the LTS button).`);

const git = spawnSync('git', ['--version'], {encoding: 'utf8'});
step(git.status === 0, git.status === 0 ? git.stdout.trim() : 'git',
    'Install git from https://git-scm.com/downloads, then open a new terminal.');

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
