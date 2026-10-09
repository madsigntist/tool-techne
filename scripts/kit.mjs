/**
 * Copies the shared kit into tools: the single source for code every tool
 * needs the same, so a fix lands once.
 *
 * A tool lists the modules it uses in tool.json "kit". Each module is one
 * file in kit/, copied to a fixed path in the tool (see KIT in
 * lib/standard.mjs). Tools stay self-contained, which a zipped hand-over
 * needs; the standard check fails a tool whose copy has drifted.
 *
 * Usage:
 *   node scripts/kit.mjs status              every tool: which copies differ
 *   node scripts/kit.mjs sync <tool>         copy the kit into one tool
 *   node scripts/kit.mjs sync --all          into every tool
 *   ... --root <folder>                      a folder other than ../
 *
 * Exits 1 from status when any copy differs.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {KIT, KIT_DIR, discover, kitState, readManifest} from './lib/standard.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const rootAt = args.indexOf('--root');
const ROOT = rootAt === -1 ? path.dirname(HERE) : path.resolve(args[rootAt + 1]);
const [cmd, target] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root');

/**
 * @param {string} dir A tool folder.
 * @return {!Array<string>} The kit modules its tool.json lists.
 */
function modulesOf(dir) {
  try {
    return readManifest(dir)?.kit || [];
  } catch {
    return [];
  }
}

const tools = args.includes('--all') || cmd === 'status'
  ? discover(ROOT)
  : target ? [path.resolve(ROOT, target)] : [];
if (!['status', 'sync'].includes(cmd) || !tools.length) {
  console.error('Usage: node scripts/kit.mjs status | sync <tool> | sync --all');
  process.exit(1);
}

let drift = 0;
for (const dir of tools) {
  const states = kitState(dir, modulesOf(dir));
  if (!states.length) continue;
  console.log(`\n  ${path.basename(dir)}`);
  for (const s of states) {
    if (s.state === 'unknown') {
      console.log(`    ??    ${s.module}: not a kit module (known: ${Object.keys(KIT).join(', ')})`);
      drift += 1;
      continue;
    }
    if (cmd === 'sync' && s.state !== 'same') {
      const to = path.join(dir, s.dest);
      fs.mkdirSync(path.dirname(to), {recursive: true});
      fs.copyFileSync(path.join(KIT_DIR, `${s.module}.mjs`), to);
      console.log(`    sync  ${s.dest}  (${s.module}, was ${s.state})`);
    } else {
      if (s.state !== 'same') drift += 1;
      console.log(`    ${s.state === 'same' ? 'ok  ' : s.state.padEnd(5)} ${s.dest}  (${s.module})`);
    }
  }
}
console.log('');
process.exit(cmd === 'status' && drift ? 1 : 0);
