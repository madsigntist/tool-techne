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
 * normal in a handed-over copy.
 *
 * Usage (from the folder that holds your tools):
 *   node tool-techne/scripts/vendor.mjs status            which copies differ
 *   node tool-techne/scripts/vendor.mjs sync <tool>       update one tool
 *   node tool-techne/scripts/vendor.mjs sync --all        update every tool
 *   ... --root <folder>                                   a folder other than ../
 *
 * Exits 1 from status when any copy differs.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {discover, readManifest} from './lib/standard.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const rootAt = args.indexOf('--root');
const ROOT = rootAt === -1 ? path.dirname(HERE) : path.resolve(args[rootAt + 1]);
const [cmd, target] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root');

const text = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const tools = args.includes('--all') || cmd === 'status'
  ? discover(ROOT)
  : target ? [path.resolve(ROOT, target)] : [];
if (!['status', 'sync'].includes(cmd) || !tools.length) {
  console.error('Usage: node scripts/vendor.mjs status | sync <tool> | sync --all');
  process.exit(1);
}

let drift = 0;
for (const dir of tools) {
  let m;
  try {
    m = readManifest(dir);
  } catch {
    continue;
  }
  const entries = (m?.vendored || []).filter((v) => v.path && v.from);
  if (!entries.length) continue;
  console.log(`\n  ${path.basename(dir)}`);
  for (const v of entries) {
    const from = path.resolve(dir, v.from);
    const to = path.join(dir, v.path);
    if (v.forked) {
      console.log(`    forked ${v.path}  (left alone on purpose)`);
      continue;
    }
    if (!fs.existsSync(from)) {
      console.log(`    skip   ${v.path}  (source ${v.from} is not on this computer)`);
      continue;
    }
    const same = fs.existsSync(to) && text(to) === text(from);
    if (same) {
      console.log(`    ok     ${v.path}`);
    } else if (cmd === 'sync') {
      fs.mkdirSync(path.dirname(to), {recursive: true});
      fs.copyFileSync(from, to);
      console.log(`    sync   ${v.path}  (from ${v.from})`);
    } else {
      drift += 1;
      console.log(`    differs ${v.path}  (source ${v.from} changed: run vendor.mjs sync ${path.basename(dir)})`);
    }
  }
}
console.log('');
process.exit(cmd === 'status' && drift ? 1 : 0);
