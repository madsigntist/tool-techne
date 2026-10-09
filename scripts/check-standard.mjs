/**
 * Checks tools against TOOL-STANDARD.md.
 *
 * Usage:
 *   node scripts/check-standard.mjs                 the current folder
 *   node scripts/check-standard.mjs <tool folder>   one tool
 *   node scripts/check-standard.mjs --all           every tool beside this one, not itself
 *   node scripts/check-standard.mjs --list          the registry
 *   node scripts/check-standard.mjs --registers     every tool's register lint
 *   ... --root <folder>                             a folder other than ../
 *   ... --hook                                      for a Claude Code hook:
 *       prints a systemMessage only on failure, always exits 0
 *
 * Exits 1 when any tool fails, so it can gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkAll, checkTool, discover, readManifest} from './lib/standard.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const rootAt = args.indexOf('--root');
const ROOT = rootAt === -1 ? path.dirname(HERE) : path.resolve(args[rootAt + 1]);
const HOOK = flag('--hook');
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root');

/**
 * Ends a hook run: one systemMessage when there is something to say.
 * @param {string} msg The message, or '' for silence.
 * @return {never}
 */
function hookExit(msg) {
  if (msg) process.stdout.write(JSON.stringify({systemMessage: msg}));
  process.exit(0);
}

if (flag('--list')) {
  const rows = discover(ROOT).map((d) => {
    try {
      const m = readManifest(d);
      return [m.name, m.profile, m.stack ?? '-', m.port ?? '-', m.shared ? 'yes' : 'no', m.standard, m.commands?.prefix ?? '-'];
    } catch {
      return [path.basename(d), 'INVALID tool.json', '', '', '', '', ''];
    }
  });
  const head = ['tool', 'profile', 'stack', 'port', 'shared', 'std', 'prefix'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => r.map((c, i) => String(c).padEnd(w[i])).join('  ');
  console.log(`\n  ${line(head)}\n  ${w.map((n) => '-'.repeat(n)).join('  ')}`);
  rows.forEach((r) => console.log(`  ${line(r)}`));
  console.log('');
  process.exit(0);
}

if (flag('--registers')) {
  const stale = [];
  for (const d of discover(ROOT)) {
    const lint = path.join(d, 'scripts', 'lint-register.mjs');
    if (!fs.existsSync(lint)) continue;
    const r = spawnSync(process.execPath, [lint], {cwd: d, encoding: 'utf8', timeout: 30_000});
    if (r.status !== 0) stale.push(path.basename(d));
  }
  const msg = stale.length
    ? `Stale defect register in ${stale.join(', ')}. Run node scripts/lint-register.mjs in each.`
    : '';
  if (HOOK) hookExit(msg);
  console.log(msg || 'Every register is current.');
  process.exit(stale.length ? 1 : 0);
}

// tool-techne checks itself with its own check, and a downloaded copy has
// no .git, so --all covers only the tools beside it.
const results = flag('--all')
  ? checkAll(ROOT).filter((r) => path.resolve(r.dir) !== HERE)
  : [checkTool(path.resolve(positional[0] || process.cwd()))];
const failing = results.filter((r) => r.fails.length);

if (HOOK) {
  hookExit(
    failing.length
      ? `Tool standard: ${failing.map((r) => `${r.name} (${r.fails[0]}${r.fails.length > 1 ? ` +${r.fails.length - 1} more` : ''})`).join('; ')}. ` +
          'Run node tool-techne/scripts/check-standard.mjs --all'
      : '',
  );
}

for (const r of results) {
  const state = r.fails.length ? 'FAIL' : 'OK  ';
  console.log(`\n  ${state}  ${r.name}${r.manifest ? `  (${r.manifest.profile}, ${r.manifest.stack}, standard ${r.manifest.standard})` : ''}`);
  r.fails.forEach((f) => console.log(`          FAIL  ${f}`));
  r.warns.forEach((w) => console.log(`          warn  ${w}`));
}
console.log(`\n  ${results.length - failing.length} of ${results.length} meet the standard.\n`);
process.exit(failing.length ? 1 : 0);
