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
 *                                  (node --test, pytest, ...)
 *
 * Works the same for every stack: the tool's language only changes step 3.
 *
 * Usage:
 *   node scripts/check.mjs
 *
 * Exits 1 when any step fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tool.json'), 'utf8'));

const steps = [
  {label: 'Defect register is current', argv: [process.execPath, 'scripts/lint-register.mjs']},
  {label: 'No secrets in files git would keep', argv: [process.execPath, 'scripts/check-secrets.mjs']},
];
if (manifest.test) steps.push({label: `Tests (${manifest.test})`, cmd: manifest.test});

const results = steps.map((s) => {
  console.log(`\n--- ${s.label}`);
  // The test command is the tool's own configured string, so it runs
  // through a shell. The kit steps are fixed argv and do not.
  const r = s.cmd
    ? spawnSync(s.cmd, {cwd: ROOT, stdio: 'inherit', shell: true})
    : spawnSync(s.argv[0], s.argv.slice(1), {cwd: ROOT, stdio: 'inherit'});
  return {label: s.label, ok: r.status === 0};
});

const failed = results.filter((r) => !r.ok);
console.log('\n=== check ===');
results.forEach((r) => console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.label}`));
console.log(failed.length
  ? `\n  ${failed.length} step(s) failed. Read the output above the failing step.\n`
  : '\n  Everything passed.\n');
process.exit(failed.length ? 1 : 0);
