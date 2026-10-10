/**
 * Brings a tool up to the current tool standard: every step since the
 * version its tool.json "standard" records, with the tool's own check run
 * before and after.
 *
 * For a tool already on tool-techne (its tool.json has "stack"). A tool on
 * an older standard is moved over with migrate.mjs instead, which runs these
 * same steps at the end.
 *
 * Refuses uncommitted changes to tracked files, so the upgrade is its own
 * change. Never commits: it ends with the files it changed.
 *
 * Usage (from the folder that holds your tools):
 *   node tool-techne/scripts/upgrade.mjs <tool>
 *   node tool-techne/scripts/upgrade.mjs --all          every tool beside tool-techne
 *   ... --dry-run                                       say what would run
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {STANDARD, checkTool, discover, readManifest} from './lib/standard.mjs';
import {UPGRADES, applyUpgrades} from './lib/upgrades.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const target = args.find((a) => !a.startsWith('--'));
const dirs = args.includes('--all')
  ? discover(path.dirname(HERE)).filter((d) => path.resolve(d) !== HERE)
  : target ? [path.resolve(target)] : [];
if (!dirs.length) {
  console.error('\n  Usage: node scripts/upgrade.mjs <tool folder> | --all  [--dry-run]\n');
  process.exit(1);
}

let failed = 0;
for (const dir of dirs) {
  const name = path.basename(dir);
  const git = (...a) => spawnSync('git', a, {cwd: dir, encoding: 'utf8'});
  let m;
  try {
    m = readManifest(dir);
  } catch (e) {
    console.log(`\n  ${name}: skipped, ${e.message}`);
    failed += 1;
    continue;
  }
  if (!m) continue;
  if (m.stack === undefined) {
    console.log(`\n  ${name}: on an older standard. Move it over first: node tool-techne/scripts/migrate.mjs ${name}`);
    continue;
  }
  const from = m.standard || 1;
  const steps = UPGRADES.filter((s) => s.to > from);
  if (!steps.length) {
    console.log(`\n  ${name}: already on standard ${STANDARD}`);
    continue;
  }
  console.log(`\n  ${name}: standard ${from} to ${STANDARD}`);
  steps.forEach((s) => console.log(`    step ${s.to}: ${s.title}`));
  if (DRY) continue;

  const tracked = git('status', '--porcelain', '--untracked-files=no').stdout.trimEnd();
  if (tracked) {
    console.log(`    Stopped: commit or discard these changes first, so the upgrade is its own change:\n${tracked}`);
    failed += 1;
    continue;
  }
  const untracked = git('ls-files', '--others', '--exclude-standard').stdout.trim().split('\n').filter(Boolean);
  const before = spawnSync(process.execPath, ['scripts/check.mjs'], {cwd: dir, encoding: 'utf8'});
  if (before.status !== 0) {
    console.log('    Stopped: the tool fails its own check before the upgrade. Fix that first.');
    failed += 1;
    continue;
  }
  console.log('    OK    its check passes before');

  const ran = applyUpgrades(dir, m);
  fs.writeFileSync(path.join(dir, 'tool.json'), `${JSON.stringify(m, null, 2)}\n`);
  for (const r of ran) r.done.forEach((d) => console.log(`    done  ${d}`));
  console.log(`    done  tool.json standard: ${m.standard}`);

  const setup = spawnSync(process.execPath, ['scripts/install.mjs'], {cwd: dir, encoding: 'utf8'});
  console.log(`    ${setup.status === 0 ? 'OK   ' : 'FAIL '} setup`);
  const after = spawnSync(process.execPath, ['scripts/check.mjs'], {cwd: dir, encoding: 'utf8'});
  console.log(`    ${after.status === 0 ? 'OK   ' : 'FAIL '} its check passes after`);
  if (after.status !== 0) console.log(`${after.stdout}${after.stderr}`.trim().split('\n').slice(-15).map((l) => `        ${l}`).join('\n'));
  const std = checkTool(dir);
  console.log(`    ${std.fails.length ? 'FAIL ' : 'OK   '} the tool-techne standard`);
  std.fails.forEach((f) => console.log(`        FAIL  ${f}`));

  const changed = git('status', '--porcelain', '--untracked-files=all').stdout.trimEnd().split('\n').filter(Boolean)
    .map((l) => l.slice(3).split(' -> ').pop()).filter((f) => !untracked.includes(f));
  console.log('    Commit only these files:');
  changed.forEach((f) => console.log(`      ${f}`));
  if (setup.status !== 0 || after.status !== 0 || std.fails.length) failed += 1;
}
console.log('');
process.exit(failed ? 1 : 0);
