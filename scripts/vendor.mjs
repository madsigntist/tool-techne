/**
 * Keeps files a tool copies from elsewhere (tool.json "vendored") in step
 * with their source, so one edit to the source reaches every tool.
 *
 * The usual case: a document of standards kept once, in the folder that
 * holds your tools, and copied into each tool so the tool still has it when
 * it is handed to someone without that folder.
 *
 * A copy marked "forked": true is a deliberate difference and is never
 * touched. A copy whose source is not on this computer is skipped: that is
 * normal in a handed-over copy. A copy with uncommitted edits of its own is
 * left alone and reported, never overwritten.
 *
 * Usage (from the folder that holds your tools):
 *   node tool-techne/scripts/vendor.mjs status            which copies differ
 *   node tool-techne/scripts/vendor.mjs sync <tool>       update one tool
 *   node tool-techne/scripts/vendor.mjs sync --all        update every tool
 *   ... --commit    after syncing, commit the updated copies in each tool's
 *                   repo: only those files, whatever else is in progress
 *   ... --hook      for a Claude Code hook: silent unless something was
 *                   synced or needs a person, then one systemMessage; always
 *                   exits 0
 *   ... --root <folder>                                   a folder other than ../
 *
 * Exits 1 from status when any copy differs, and from sync when a copy was
 * left alone or a commit failed.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {discover, readManifest} from './lib/standard.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const rootAt = args.indexOf('--root');
const ROOT = rootAt === -1 ? path.dirname(HERE) : path.resolve(args[rootAt + 1]);
const [cmd, target] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root');
const COMMIT = args.includes('--commit');
const HOOK = args.includes('--hook');

/** In hook mode only the final summary is printed. */
const say = (line) => {
  if (!HOOK) console.log(line);
};

const text = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const tools = args.includes('--all') || cmd === 'status'
  ? discover(ROOT)
  : target ? [path.resolve(ROOT, target)] : [];
if (!['status', 'sync'].includes(cmd) || !tools.length) {
  console.error('Usage: node scripts/vendor.mjs status | sync <tool> | sync --all  [--commit] [--hook]');
  process.exit(1);
}

let drift = 0;
const synced = [];
const problems = [];
for (const dir of tools) {
  let m;
  try {
    m = readManifest(dir);
  } catch {
    continue;
  }
  const entries = (m?.vendored || []).filter((v) => v.path && v.from);
  if (!entries.length) continue;
  const name = path.basename(dir);
  const git = (...a) => spawnSync('git', a, {cwd: dir, encoding: 'utf8'});
  const isRepo = fs.existsSync(path.join(dir, '.git'));
  const changedHere = [];
  say(`\n  ${name}`);
  for (const v of entries) {
    const from = path.resolve(dir, v.from);
    const to = path.join(dir, v.path);
    if (v.forked) {
      say(`    forked ${v.path}  (left alone on purpose)`);
      continue;
    }
    if (!fs.existsSync(from)) {
      say(`    skip   ${v.path}  (source ${v.from} is not on this computer)`);
      continue;
    }
    if (fs.existsSync(to) && text(to) === text(from)) {
      say(`    ok     ${v.path}`);
      continue;
    }
    if (cmd === 'status') {
      drift += 1;
      say(`    differs ${v.path}  (source ${v.from} changed: run vendor.mjs sync ${name})`);
      continue;
    }
    // A copy someone edited in place is theirs to sort out, not ours to erase.
    // Only a tracked copy that differs from its last commit counts: a copy
    // that was never committed is new, not edited.
    const tracked = isRepo && git('ls-files', '--error-unmatch', '--', v.path).status === 0;
    if (tracked && git('diff', '--quiet', 'HEAD', '--', v.path).status !== 0) {
      problems.push(`${name}/${v.path} has uncommitted edits of its own, so it was not synced`);
      say(`    held   ${v.path}  (has uncommitted edits: commit or discard them, then sync)`);
      continue;
    }
    fs.mkdirSync(path.dirname(to), {recursive: true});
    fs.copyFileSync(from, to);
    changedHere.push(v.path);
    synced.push(`${name}/${v.path}`);
    say(`    sync   ${v.path}  (from ${v.from})`);
  }
  if (COMMIT && changedHere.length && isRepo) {
    // `git commit -- <paths>` commits only these files, leaving any other
    // work in progress in the tool exactly as it was.
    git('add', '--', ...changedHere);
    const c = git('commit', '-q', '-m', 'Sync shared files from their source', '-m',
      `Updated by tool-techne vendor.mjs: ${changedHere.join(', ')}`, '--', ...changedHere);
    if (c.status === 0) say(`    commit ${changedHere.length} file(s) in ${name}`);
    else problems.push(`${name}: the sync commit failed (${`${c.stderr}${c.stdout}`.trim().split('\n').pop()})`);
  }
}

if (HOOK) {
  const parts = [];
  if (synced.length) parts.push(`Synced shared files into tools${COMMIT ? ' and committed them' : ''}: ${synced.join(', ')}.`);
  if (problems.length) parts.push(`Needs you: ${problems.join('; ')}.`);
  if (parts.length) process.stdout.write(JSON.stringify({systemMessage: parts.join(' ')}));
  process.exit(0);
}
if (problems.length) {
  console.log('');
  problems.forEach((p) => console.log(`  ! ${p}`));
}
console.log('');
process.exit((cmd === 'status' && drift) || problems.length ? 1 : 0);
