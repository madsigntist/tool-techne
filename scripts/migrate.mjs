/**
 * Moves an existing tool onto the tool-techne standard: the mechanical half
 * of the work, with the tool's own check run before and after to prove
 * nothing it does has changed.
 *
 * For a tool that has a tool.json (an older standard), and a git repo with
 * no uncommitted changes to tracked files. New files that are not part of
 * this are left alone and listed, never added.
 *
 * What it does:
 *   1. Runs the tool's current check, as the baseline. Stops if it fails.
 *   2. CLAUDE.md becomes AGENTS.md, word for word, with a short note on the
 *      pointer files. CLAUDE.md becomes "@AGENTS.md". GEMINI.md and
 *      .github/copilot-instructions.md point there too.
 *   3. tool.json: adds "stack", docs.claude becomes docs.agents, "check"
 *      becomes node scripts/check.mjs, and the tool's own gates (its old
 *      check, minus the register lint, which check.mjs runs first) go in
 *      "test". The package.json script the old check named runs check.mjs,
 *      so the command people type still works.
 *   4. A custom scripts/install.mjs moves to scripts/setup-tool.mjs and is
 *      listed in "setupExtra": the standard installer runs it after its own
 *      steps, so `node scripts/install.mjs` still does everything it did.
 *   5. Kit copies from tool-techne. A register lint that is not a kit copy
 *      (one that counts the tool's own numbers) is kept as the tool's own.
 *   6. The git pre-commit hook, and a SessionStart setup check if missing.
 *   7. Runs setup, the secrets scan, the new check and the standard check.
 *
 * It does not commit. It ends with the files it changed, for review, and
 * lists every other file that mentions CLAUDE.md, for a person to judge.
 *
 * Usage:
 *   node scripts/migrate.mjs <tool folder>
 *   ... --dry-run          say what would change, change nothing
 *   ... --skip-baseline    do not run the old check first
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {KIT, KIT_DIR, checkTool, readManifest} from './lib/standard.mjs';
import {applyUpgrades} from './lib/upgrades.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const target = args.find((a) => !a.startsWith('--'));

/**
 * @param {string} msg Why it stopped, and what to do.
 * @return {never}
 */
function die(msg) {
  console.error(`\n  Stopped: ${msg}\n`);
  process.exit(1);
}

/**
 * @param {string} label What happened.
 * @return {void}
 */
const ok = (label) => console.log(`  ${DRY ? 'WOULD' : 'OK   '} ${label}`);

if (!target) die('give the tool folder: node scripts/migrate.mjs ../my-tool');
const dir = path.resolve(target);
const at = (...p) => path.join(dir, ...p);
const git = (...a) => spawnSync('git', a, {cwd: dir, encoding: 'utf8'});

let m;
try {
  m = readManifest(dir);
} catch (e) {
  die(e.message);
}
if (!m) die(`${dir} has no tool.json, so it is not a tool on an older standard`);
if (m.stack !== undefined) die(`${m.name} already has "stack": it is on the tool-techne standard`);
if (!fs.existsSync(at('.git'))) die(`${dir} is not a git repo, so the change could not be reviewed or undone`);
const tracked = git('status', '--porcelain', '--untracked-files=no').stdout.trim();
if (tracked) die(`commit or discard these changes first, so this migration is its own change:\n${tracked}`);
const untracked = git('ls-files', '--others', '--exclude-standard').stdout.trim().split('\n').filter(Boolean);

const pkgPath = at('package.json');
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : null;
const stack = pkg ? 'node' : fs.existsSync(at('pyproject.toml')) ? 'python' : 'static';

// Work out the tool's own gates from its old check command.
const oldCheck = String(m.check || '').trim();
const npmRun = /^npm run (\S+)$/.exec(oldCheck);
const checkScript = npmRun ? npmRun[1] : null;
if (npmRun && !(pkg && pkg.scripts && pkg.scripts[checkScript])) {
  die(`tool.json check is "${oldCheck}" but package.json has no "${checkScript}" script`);
}
const body = checkScript ? pkg.scripts[checkScript] : oldCheck;
const isRegister = (piece) => {
  if (/lint-register/.test(piece)) return true;
  const ref = /^npm run (\S+)$/.exec(piece);
  return Boolean(ref && pkg && /lint-register/.test(pkg.scripts[ref[1]] || ''));
};
const gates = body.split('&&').map((s) => s.trim()).filter(Boolean).filter((s) => !isRegister(s));
const test = gates.join(' && ');
if (/\bnpm run check\b/.test(test) && checkScript === 'check') die('the old check calls itself; untangle it by hand');

// Instructions.
const claudeRel = m.docs?.claude || 'CLAUDE.md';
if (claudeRel !== 'CLAUDE.md') die(`docs.claude is ${claudeRel}; this script only moves a root CLAUDE.md`);
if (!fs.existsSync(at('CLAUDE.md'))) die('there is no CLAUDE.md to move');
// A tool that already keeps its rules in AGENTS.md, with CLAUDE.md importing
// it, is already in the shape the standard asks for: both files stay.
const alreadyAgents = fs.existsSync(at('AGENTS.md')) &&
  /^@AGENTS\.md\s*$/m.test(fs.readFileSync(at('CLAUDE.md'), 'utf8'));
if (fs.existsSync(at('AGENTS.md')) && !alreadyAgents) {
  die('AGENTS.md already exists and CLAUDE.md does not import it with an "@AGENTS.md" line; merge them by hand');
}

// Installer.
const ownInstall = fs.existsSync(at('scripts', 'install.mjs')) &&
  fs.readFileSync(at('scripts', 'install.mjs'), 'utf8') !== fs.readFileSync(path.join(KIT_DIR, 'install.mjs'), 'utf8');
if (ownInstall && fs.existsSync(at('scripts', 'setup-tool.mjs'))) die('scripts/setup-tool.mjs already exists');

// Kit: keep what tool-techne knows, add what every tool needs.
const oldKit = Array.isArray(m.kit) ? m.kit : [];
const register = oldKit.find((k) => k.startsWith('lint-register-'));
const ownRegister = !register && fs.existsSync(at('scripts', 'lint-register.mjs'));
const kit = [...new Set(['check', 'check-secrets', 'install', ...(register ? [register] : []), 'setup-check',
  ...oldKit.filter((k) => KIT[k] && !k.startsWith('lint-register-'))])];
if (!register && !ownRegister) kit.splice(3, 0, 'lint-register-table');

console.log(`\n  Moving ${m.title || m.name} to the tool-techne standard${DRY ? ' (dry run: nothing changes)' : ''}\n`);
console.log(`  stack: ${stack}`);
console.log(`  check: "${oldCheck}" becomes node scripts/check.mjs`);
console.log(`  test:  "${test || '(none)'}"`);
console.log(`  kit:   ${kit.join(', ')}${ownRegister ? ' (plus its own register lint, kept)' : ''}`);
if (ownInstall) console.log('  setup: its own installer moves to scripts/setup-tool.mjs, run by the standard one');
console.log('');

/**
 * Runs the tool's check, showing a short result.
 * @param {string} label When.
 * @param {string} cmd The command.
 * @return {boolean} Whether it passed.
 */
function runCheck(label, cmd) {
  console.log(`  ...   ${label}: ${cmd}`);
  const r = spawnSync(cmd, {cwd: dir, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024});
  const passed = r.status === 0;
  console.log(`  ${passed ? 'OK   ' : 'FAIL '} ${label}`);
  if (!passed) console.log(`${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-20).map((l) => `        ${l}`).join('\n'));
  return passed;
}

if (!args.includes('--skip-baseline') && !DRY) {
  if (!runCheck('baseline, before any change', oldCheck)) {
    die('the tool fails its own check before migration. Fix that first, or pass --skip-baseline');
  }
}
if (DRY) {
  console.log('  Dry run: nothing changed.\n');
  process.exit(0);
}

// 2. Instructions.
if (!alreadyAgents) {
  git('mv', 'CLAUDE.md', 'AGENTS.md');
  const lines = fs.readFileSync(at('AGENTS.md'), 'utf8').split('\n');
  const h1 = lines.findIndex((l) => /^# /.test(l));
  let insertAt = h1 + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt += 1;
  while (insertAt < lines.length && lines[insertAt].trim() !== '' && !/^#/.test(lines[insertAt])) insertAt += 1;
  lines.splice(insertAt, 0, '',
    'Instructions for any AI assistant working here. `CLAUDE.md`, `GEMINI.md`',
    'and `.github/copilot-instructions.md` all point to this file, so it is the',
    'one to change.');
  fs.writeFileSync(at('AGENTS.md'), lines.join('\n'));
  fs.writeFileSync(at('CLAUDE.md'), '@AGENTS.md\n');
}
const title = m.title || m.name;
if (!fs.existsSync(at('GEMINI.md'))) {
  fs.writeFileSync(at('GEMINI.md'),
    `# ${title}\n\nRead AGENTS.md in this folder and follow it. It holds every instruction for\nworking on this tool.\n\n@AGENTS.md\n`);
}
if (!fs.existsSync(at('.github', 'copilot-instructions.md'))) {
  fs.mkdirSync(at('.github'), {recursive: true});
  fs.writeFileSync(at('.github', 'copilot-instructions.md'),
    `# ${title}\n\nRead AGENTS.md at the root of this folder and follow it. It holds every\ninstruction for working on this tool.\n`);
}
ok(alreadyAgents
  ? 'AGENTS.md was already the instructions, with CLAUDE.md importing it: both kept; GEMINI.md and Copilot point there'
  : 'CLAUDE.md moved to AGENTS.md; CLAUDE.md, GEMINI.md and Copilot point there');

// 4. Installer.
if (ownInstall) {
  git('mv', path.join('scripts', 'install.mjs'), path.join('scripts', 'setup-tool.mjs'));
  ok('its own installer is now scripts/setup-tool.mjs');
}

// 3. tool.json and package.json.
const docs = {};
for (const [k, v] of Object.entries(m.docs || {})) docs[k === 'claude' ? 'agents' : k] = k === 'claude' ? 'AGENTS.md' : v;
const out = {};
for (const [k, v] of Object.entries(m)) {
  out[k] = k === 'docs' ? docs : v;
  if (k === 'profile') out.stack = stack;
}
out.check = 'node scripts/check.mjs';
out.test = test;
out.kit = kit;
if (ownInstall) out.setupExtra = [...new Set([...(m.setupExtra || []), 'scripts/setup-tool.mjs'])];
fs.writeFileSync(at('tool.json'), `${JSON.stringify(out, null, 2)}\n`);
if (checkScript) {
  pkg.scripts[checkScript] = 'node scripts/check.mjs';
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
ok(`tool.json updated${checkScript ? `, and npm run ${checkScript} runs scripts/check.mjs` : ''}`);

// 5. Kit.
for (const k of kit) {
  const to = at(KIT[k]);
  fs.mkdirSync(path.dirname(to), {recursive: true});
  fs.copyFileSync(path.join(KIT_DIR, `${k}.mjs`), to);
}
ok(`kit copied: ${kit.join(', ')}`);

// 6. Hooks.
const hook = at('.githooks', 'pre-commit');
fs.mkdirSync(path.dirname(hook), {recursive: true});
fs.copyFileSync(path.join(HERE, 'skeleton', 'core', '.githooks', 'pre-commit'), hook);
fs.chmodSync(hook, 0o755);
const settingsPath = at('.claude', 'settings.json');
const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
const skel = JSON.parse(fs.readFileSync(path.join(HERE, 'skeleton', 'core', '.claude', 'settings.json'), 'utf8'));
settings.hooks = settings.hooks || {};
if (!JSON.stringify(settings.hooks.Stop || []).includes('lint-register')) {
  settings.hooks.Stop = [...(settings.hooks.Stop || []), ...skel.hooks.Stop];
}
if (!JSON.stringify(settings.hooks.SessionStart || []).match(/setup-check|install\.mjs/)) {
  settings.hooks.SessionStart = [...(settings.hooks.SessionStart || []), ...skel.hooks.SessionStart];
}
fs.mkdirSync(path.dirname(settingsPath), {recursive: true});
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
ok('pre-commit hook, and the Claude Code register and setup hooks');

// Then every standard upgrade, so the tool lands on the current standard.
const moved = JSON.parse(fs.readFileSync(at('tool.json'), 'utf8'));
moved.standard = 1;
const ran = applyUpgrades(dir, moved);
fs.writeFileSync(at('tool.json'), `${JSON.stringify(moved, null, 2)}\n`);
ok(`upgraded to standard ${moved.standard}${ran.length ? ` (${ran.map((r) => r.title).join('; ')})` : ''}`);

// 7. Setup, secrets, the new check, the standard.
const setup = spawnSync(process.execPath, ['scripts/install.mjs'], {cwd: dir, encoding: 'utf8'});
console.log(`  ${setup.status === 0 ? 'OK   ' : 'FAIL '} setup (node scripts/install.mjs)`);
if (setup.status !== 0) console.log(setup.stdout.trim().split('\n').slice(-12).map((l) => `        ${l}`).join('\n'));
const secrets = spawnSync(process.execPath, ['scripts/check-secrets.mjs'], {cwd: dir, encoding: 'utf8'});
console.log(`  ${secrets.status === 0 ? 'OK   ' : 'FAIL '} secrets scan`);
if (secrets.status !== 0) console.log(secrets.stdout.trim().split('\n').map((l) => `        ${l}`).join('\n'));
const after = runCheck('after, with the new check', 'node scripts/check.mjs');
const std = checkTool(dir);
console.log(`  ${std.fails.length ? 'FAIL ' : 'OK   '} the tool-techne standard`);
std.fails.forEach((f) => console.log(`        FAIL  ${f}`));
std.warns.forEach((w) => console.log(`        warn  ${w}`));

const mentions = git('grep', '-l', 'CLAUDE\\.md', '--', '.', ':!CLAUDE.md', ':!AGENTS.md', ':!GEMINI.md',
  ':!.github/copilot-instructions.md').stdout.trim().split('\n').filter(Boolean);
console.log('\n  For you to review:');
if (alreadyAgents && fs.readFileSync(at('CLAUDE.md'), 'utf8').trim() !== '@AGENTS.md') {
  console.log('  - CLAUDE.md holds more than "@AGENTS.md". Assistants other than Claude never see that part:');
  console.log('    move anything they also need into AGENTS.md.');
}
if (mentions.length && !alreadyAgents) {
  console.log('  - These files mention CLAUDE.md. Where they mean this tool\'s rules, they now live in AGENTS.md:');
  mentions.forEach((f) => console.log(`      ${f}`));
}
if (ownInstall) console.log('  - scripts/setup-tool.mjs still does the standard steps too. They are harmless twice; trim them if you like.');
if (untracked.length) {
  console.log('  - Left alone, not part of this (new files that were already here):');
  untracked.forEach((f) => console.log(`      ${f}`));
}
console.log('  - Commit only the files this changed. They are:');
// trimEnd, not trim: porcelain lines start with a status column that may be
// a space, and trimming it shifts the first path by one character.
const changed = git('status', '--porcelain', '--untracked-files=all').stdout.trimEnd().split('\n').filter(Boolean)
  .map((l) => l.slice(3).split(' -> ').pop()).filter((f) => !untracked.includes(f));
changed.forEach((f) => console.log(`      ${f}`));
console.log('');
process.exit(after && !std.fails.length && setup.status === 0 && secrets.status === 0 ? 0 : 1);
