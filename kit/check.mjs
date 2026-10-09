/**
 * The one check command: every gate this tool has, in order, with a plain
 * summary at the end.
 *
 * TOOL-KIT MODULE "check". The source is tool-techne/kit/. Never edit a
 * tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails a
 * tool whose copy differs from the source.
 *
 * Runs, from the tool folder:
 *   1. scripts/lint-register.mjs   the defect register's counts are current
 *   2. scripts/check-secrets.mjs   no password, key or .env is about to be
 *                                  committed
 *   3. tool.json "test"            the tool's own tests, in its own stack
 *
 * Works the same for every stack: the tool's language only changes step 3.
 * In the test command, {python} becomes this computer's Python 3: the one
 * in .venv/ when the tool has one, otherwise python, python3 or py -3,
 * whichever really is Python 3. (On Windows, python3 is often a Microsoft
 * Store placeholder that is not Python at all.)
 *
 * Usage:
 *   node scripts/check.mjs           everything
 *   node scripts/check.mjs --quick   steps 1 and 2 only, in a second or two.
 *                                    What the git pre-commit hook runs.
 *
 * Exits 1 when any step fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUICK = process.argv.includes('--quick');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tool.json'), 'utf8'));

/**
 * @return {?string} A command that runs Python 3 here, quoted for a shell,
 *     or null when there is none.
 */
function findPython() {
  const venv = process.platform === 'win32'
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python');
  const tries = [[venv], ['python'], ['python3'], ['py', '-3']];
  for (const [cmd, ...pre] of tries) {
    const r = spawnSync(cmd, [...pre, '--version'], {encoding: 'utf8'});
    if (r.status === 0 && /^Python 3\./.test(`${r.stdout}${r.stderr}`.trim())) {
      return [cmd, ...pre].map((p) => (/\s/.test(p) ? `"${p}"` : p)).join(' ');
    }
  }
  return null;
}

const steps = [
  {label: 'Defect register is current', argv: [process.execPath, 'scripts/lint-register.mjs']},
  {label: 'No secrets in files git would keep', argv: [process.execPath, 'scripts/check-secrets.mjs']},
];
if (manifest.test && !QUICK) {
  let cmd = manifest.test;
  if (cmd.includes('{python}')) {
    const py = findPython();
    cmd = py ? cmd.replaceAll('{python}', py) : null;
  }
  steps.push(cmd
    ? {label: `Tests (${cmd})`, cmd}
    : {label: 'Tests', missing: 'Python 3 was not found. Install it from https://www.python.org/downloads/'});
}

const results = steps.map((s) => {
  console.log(`\n--- ${s.label}`);
  if (s.missing) {
    console.log(s.missing);
    return {label: s.label, ok: false};
  }
  // The test command is the tool's own configured string, so it runs
  // through a shell. The kit steps are fixed argv and do not.
  const r = s.cmd
    ? spawnSync(s.cmd, {cwd: ROOT, stdio: 'inherit', shell: true})
    : spawnSync(s.argv[0], s.argv.slice(1), {cwd: ROOT, stdio: 'inherit'});
  return {label: s.label, ok: r.status === 0};
});

const failed = results.filter((r) => !r.ok);
console.log(`\n=== check${QUICK ? ' (quick)' : ''} ===`);
results.forEach((r) => console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.label}`));
console.log(failed.length
  ? `\n  ${failed.length} step(s) failed. Read the output above the failing step.\n`
  : '\n  Everything passed.\n');
process.exit(failed.length ? 1 : 0);
