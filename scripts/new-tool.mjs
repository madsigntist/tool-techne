/**
 * Scaffolds a new tool that meets TOOL-STANDARD.md from its first commit.
 *
 * Copies skeleton/core, then the stack, then the profile and options, fills
 * in the names, picks a free port, copies the kit, makes the tool its own
 * git repo with a first commit, and runs the standard check on the result.
 * The new tool is made beside tool-techne, in the same parent folder.
 *
 * Usage:
 *   node scripts/new-tool.mjs --name <kebab-name> --profile page|cli|panel|app
 *       [--stack static|node|python] [--title "Human name"] [--purpose "One sentence."]
 *       [--prefix xx] [--shared] [--guard] [--node 22] [--root <folder>]
 *       [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  APP_PORT_START, KIT, KIT_DEFAULT, KIT_DIR, NODE_FLOOR, PANEL_PORT_START, PROFILES, PYTHON_FLOOR,
  STACKS, STANDARD,
  checkTool, defaultStack, discover, nextPort, readManifest,
} from './lib/standard.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

/**
 * @param {string} k Flag name without dashes.
 * @return {string|undefined} Its value.
 */
function opt(k) {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? undefined : argv[i + 1];
}

/**
 * @param {string} msg Why it stopped, and what to do.
 * @return {never}
 */
function die(msg) {
  console.error(`\n  Stopped: ${msg}\n`);
  process.exit(1);
}

const name = opt('name');
const profile = opt('profile');
if (!name || !/^[a-z][a-z0-9-]{1,62}$/.test(name)) {
  die('--name is required: lowercase letters, digits and hyphens, like "recipe-box".');
}
if (!PROFILES[profile]) {
  die(`--profile is required: ${Object.entries(PROFILES).map(([k, v]) => `${k} (${v})`).join(', ')}.`);
}
const stack = opt('stack') || defaultStack(profile);
if (!STACKS[stack]) die(`--stack must be one of ${Object.keys(STACKS).join(', ')}.`);
if (!STACKS[stack].profiles.includes(profile)) {
  die(`the ${stack} stack does not support the ${profile} profile. It supports: ${STACKS[stack].profiles.join(', ')}.`);
}

const root = path.resolve(opt('root') || path.dirname(HERE));
const dest = path.join(root, name);
if (fs.existsSync(dest)) die(`${dest} already exists. Pick another name.`);

/**
 * Makes text safe inside a quoted string in JSON, TOML, Python or HTML: one
 * line, no double quotes, backslashes or angle brackets.
 * @param {string} t Text the person typed.
 * @return {string} It, safe.
 */
const clean = (t) => t.replace(/[\r\n]+/g, ' ').replace(/"/g, '\'').replace(/[\\<>]/g, '').trim();

const title = clean(opt('title') || name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
const chosenPrefix = opt('prefix');
const initials = name.split('-').map((w) => w[0]).join('').slice(0, 3);
let prefix = chosenPrefix || (initials.length >= 2 ? initials : name.replace(/-/g, '').slice(0, 2));
if (!/^[a-z][a-z0-9]{0,5}$/.test(prefix)) die('--prefix: 1 to 6 lowercase letters or digits.');
const shared = argv.includes('--shared');
const guard = argv.includes('--guard');
const dry = argv.includes('--dry-run');

/**
 * @return {?{cmd: !Array<string>, version: string}} Python 3 here, found by
 *     running it: on Windows, python3 is often a Microsoft Store placeholder.
 */
function findPython() {
  for (const cmd of [['python'], ['python3'], ['py', '-3']]) {
    const r = spawnSync(cmd[0], [...cmd.slice(1), '--version'], {encoding: 'utf8'});
    const m = /^Python (3\.\d+)\.\d+/.exec(`${r.stdout || ''}${r.stderr || ''}`.trim());
    if (r.status === 0 && m) return {cmd, version: m[1]};
  }
  return null;
}
const minor = (v) => Number(v.split('.')[1]);
const python = stack === 'python' ? findPython() : null;
if (stack === 'python' && !python) {
  die(`Python 3 is not installed. Get ${PYTHON_FLOOR} or newer from https://www.python.org/downloads/ ` +
    '(on Windows, tick "Add python.exe to PATH"), open a new terminal, and run this again.');
}
if (python && minor(python.version) < minor(PYTHON_FLOOR)) {
  die(`Python ${python.version} is too old. Install ${PYTHON_FLOOR} or newer from https://www.python.org/downloads/`);
}

if (spawnSync('git', ['--version']).status !== 0) {
  die('git is not installed. Get it from https://git-scm.com/downloads, open a new terminal, and run this again.');
}

const siblings = discover(root).map((d) => {
  try {
    return readManifest(d) || {};
  } catch {
    return {};
  }
});
const prefixes = new Set(siblings.map((m) => m.commands?.prefix));
if (prefixes.has(prefix)) {
  // A prefix the person chose is never changed behind their back. One the
  // scaffolder made up gets a number until it is free.
  if (chosenPrefix) {
    const taken = siblings.find((m) => m.commands?.prefix === prefix);
    die(`the prefix "${prefix}" is already used by ${taken.name}. Pass a different --prefix.`);
  }
  const base = prefix;
  for (let n = 2; prefixes.has(prefix); n += 1) prefix = `${base}${n}`;
}
const used = siblings.map((m) => m.port).filter(Number.isInteger);
const port = {panel: nextPort(used, PANEL_PORT_START), app: nextPort(used, APP_PORT_START)}[profile] ?? null;
const portEnv = port ? `${prefix.toUpperCase()}_PORT` : '';

const TOKENS = {
  NAME: name,
  TITLE: title,
  PURPOSE: clean(opt('purpose') || `[One sentence: what ${title} does and for whom.]`),
  PROFILE: profile,
  PROFILE_LABEL: PROFILES[profile],
  STACK: stack,
  STACK_LABEL: STACKS[stack].label,
  SHARED: String(shared),
  PORT: port === null ? 'null' : String(port),
  PORT_ENV: portEnv,
  PREFIX: prefix,
  NODE: opt('node') || String(NODE_FLOOR),
  PYTHON_FLOOR,
  PYTHON_VERSION: python ? python.version : PYTHON_FLOOR,
  NEEDS: {
    static: 'To use it: a web browser, nothing else.\n\n' +
      `To work on it: Node.js ${NODE_FLOOR} or newer (https://nodejs.org) and git\n` +
      '(https://git-scm.com/downloads), for the checks.',
    node: `- Node.js ${NODE_FLOOR} or newer: https://nodejs.org (choose LTS)\n- git: https://git-scm.com/downloads`,
    python: `- Python ${PYTHON_FLOOR} or newer: https://www.python.org/downloads/\n` +
      `- Node.js ${NODE_FLOOR} or newer, for the checks: https://nodejs.org (choose LTS)\n` +
      '- git: https://git-scm.com/downloads',
  }[stack],
  START_HOW: {
    page: 'Open `index.html` in your web browser: double-click it.',
    panel: `In a terminal in this folder, run \`npm run gui\`, then open http://localhost:${port} in your browser.`,
    cli: stack === 'python'
      ? 'In a terminal in this folder, run `python main.py --help`.'
      : '[The command that runs it, once it does something.]',
    app: stack === 'python'
      ? 'In a terminal in this folder, run `python main.py`.'
      : '[The command that starts it, once it does something.]',
  }[profile],
  DATE: new Date().toISOString().slice(0, 10),
};

/**
 * @param {string} s Text with {{TOKEN}} placeholders.
 * @return {string} It, filled.
 */
const fill = (s) => s.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in TOKENS ? TOKENS[k] : m));

const SKIP = new Set(['package.scripts.json', 'settings.hooks.json']);
const TEXT = /\.(md|mjs|cjs|js|json|html|css|txt|example|append|py|toml)$|^\.[a-z-]+$|^pre-commit$/;

/**
 * Copies a folder into dest, filling tokens in names and text files. A file
 * ending in .append is added to the end of the file it names instead.
 * @param {string} from Source folder.
 * @return {!Array<string>} Relative paths written.
 */
function copyTree(from) {
  const written = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const src = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(src);
        continue;
      }
      if (SKIP.has(e.name)) continue;
      const append = e.name.endsWith('.append');
      const rel = fill(path.relative(from, src)).replace(/\.append$/, '');
      const out = path.join(dest, rel);
      if (!dry) {
        fs.mkdirSync(path.dirname(out), {recursive: true});
        if (append) fs.appendFileSync(out, fill(fs.readFileSync(src, 'utf8')));
        else if (TEXT.test(e.name)) fs.writeFileSync(out, fill(fs.readFileSync(src, 'utf8')));
        else fs.copyFileSync(src, out);
      }
      written.push(rel);
    }
  };
  walk(from);
  return written;
}

/**
 * Runs a command in the new tool, printing a one-line result.
 * @param {string} label What it is.
 * @param {string} cmd Executable.
 * @param {!Array<string>} args Arguments.
 * @return {boolean} Whether it succeeded.
 */
function run(label, cmd, args) {
  const r = spawnSync(cmd, args, {cwd: dest, encoding: 'utf8'});
  const ok = r.status === 0;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}`);
  if (!ok) console.log((r.stderr || r.stdout || '').trim().split('\n').map((l) => `        ${l}`).join('\n'));
  return ok;
}

console.log(`\n  New tool: ${title} (${name})`);
console.log(`  ${PROFILES[profile]}, written in ${STACKS[stack].label}`);
console.log(`  command prefix ${prefix}-, port ${port ?? 'none'}\n`);
if (/onedrive/i.test(dest)) {
  console.log('  WARN  this folder is inside OneDrive. OneDrive and git fight over the same');
  console.log('        files, which causes locked files and conflicting copies. Move your');
  console.log('        tools folder somewhere OneDrive does not sync, like C:\\tools.\n');
}
if (/[\\/](downloads|temp|tmp)[\\/]/i.test(dest)) {
  console.log('  WARN  this folder is inside Downloads or a temporary folder, which can be');
  console.log('        cleaned out. Move your tools folder somewhere permanent, like C:\\tools.\n');
}

const layers = [path.join(HERE, 'skeleton', 'core'), path.join(HERE, 'stacks', stack)];
if (fs.existsSync(path.join(HERE, 'profiles', profile))) layers.push(path.join(HERE, 'profiles', profile));
if (guard) layers.push(path.join(HERE, 'profiles', 'guard'));
for (const l of layers) {
  const files = copyTree(l);
  console.log(`  OK    ${files.length} file(s) from ${path.relative(HERE, l).split(path.sep).join('/')}/`);
}
if (dry) {
  console.log('\n  Dry run: nothing written.\n');
  process.exit(0);
}

// Merges a plain copy cannot do.
const pkgPath = path.join(dest, 'package.json');
const extraScripts = path.join(HERE, 'profiles', profile, 'package.scripts.json');
if (fs.existsSync(pkgPath) && fs.existsSync(extraScripts)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = {...pkg.scripts, ...JSON.parse(fs.readFileSync(extraScripts, 'utf8'))};
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

const manifestPath = path.join(dest, 'tool.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.standard = STANDARD;
manifest.test = STACKS[stack].test;
if (!port) delete manifest.portEnv;
manifest.kit = [...KIT_DEFAULT];
if (profile === 'panel') manifest.kit.push('panel-core');
if (guard) {
  manifest.guard = {open: ['data']};
  manifest.kit.push('tool-guard');
}
if (shared) manifest.docs.security = 'SECURITY.md';
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (guard) {
  const settingsPath = path.join(dest, '.claude', 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const extra = JSON.parse(fs.readFileSync(path.join(HERE, 'profiles', 'guard', 'settings.hooks.json'), 'utf8'));
  settings.hooks = {...settings.hooks, ...extra};
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}
if (shared) {
  fs.writeFileSync(path.join(dest, 'SECURITY.md'), fill(
    '# Security\n\nFor whoever checks {{TITLE}} before using it.\n\n' +
      '## Passwords and keys\n\n## Network\n\n## What it runs\n\n## What it changes outside this computer\n\n' +
      '## Data it keeps\n\n## Dependencies\n\n## Open items\n',
  ));
}
if (profile === 'app') {
  for (const d of ['core', 'modules', 'deploy']) {
    fs.mkdirSync(path.join(dest, d), {recursive: true});
    fs.writeFileSync(path.join(dest, d, '.gitkeep'), '');
  }
}
console.log('  OK    stack, profile and options merged');

for (const k of manifest.kit) {
  const to = path.join(dest, KIT[k]);
  fs.mkdirSync(path.dirname(to), {recursive: true});
  fs.copyFileSync(path.join(KIT_DIR, `${k}.mjs`), to);
}
console.log(`  OK    kit: ${manifest.kit.join(', ')}`);

// A repo in the parent folder must not track the tool.
if (fs.existsSync(path.join(root, '.git'))) {
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', `${name}/`]).status === 0;
  if (!ignored) {
    fs.appendFileSync(path.join(root, '.gitignore'), `\n# ${title}: its own repo\n${name}/\n`);
    console.log('  OK    added to the parent folder\'s .gitignore');
  }
}

const hook = path.join(dest, '.githooks', 'pre-commit');
if (fs.existsSync(hook)) fs.chmodSync(hook, 0o755);
run('git init', 'git', ['init', '-q', '-b', 'main']);
run('setup: commands and the pre-commit hook', process.execPath, ['scripts/install.mjs']);
const who = spawnSync('git', ['config', 'user.email'], {cwd: dest, encoding: 'utf8'}).stdout.trim();
let committed = false;
if (!who) {
  console.log('  FAIL  first commit: git does not know your name and email yet. Run these, then');
  console.log('        "git add -A" and "git commit -m \\"First commit\\"" in the new folder:');
  console.log('          git config --global user.name "Your Name"');
  console.log('          git config --global user.email "you@example.com"');
} else {
  committed = run('git add', 'git', ['add', '-A']) &&
    run('first commit', 'git', ['commit', '-q', '-m', `Start ${title} from tool-techne (standard ${STANDARD}, ${stack}, ${profile})`]);
}

const result = checkTool(dest);
const fails = committed ? result.fails : result.fails.filter((f) => !/git repo/.test(f));
console.log(`\n  Standard check: ${fails.length ? 'FAIL' : 'OK'}`);
fails.forEach((f) => console.log(`    FAIL  ${f}`));
result.warns.forEach((w) => console.log(`    warn  ${w}`));
console.log(`\n  Made: ${dest}`);
console.log('  Next: open that folder in your AI assistant and say "Read AGENTS.md, then help me build the first feature."\n');
process.exit(fails.length || !committed ? 1 : 0);
