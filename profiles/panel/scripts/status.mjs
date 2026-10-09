/**
 * Prints where each record stands. The panel's first action, and the
 * pattern for every other one: plain argv in, plain text out.
 *
 * Usage:
 *   node scripts/status.mjs                  every record
 *   node scripts/status.mjs --record <name>  one record
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const at = process.argv.indexOf('--record');
const only = at === -1 ? null : process.argv[at + 1];

const records = fs.existsSync(DATA)
  ? fs.readdirSync(DATA).filter((d) => fs.statSync(path.join(DATA, d)).isDirectory())
  : [];
const shown = only ? records.filter((r) => r === only) : records;

if (!shown.length) {
  console.log(only ? `No record named ${only} in data/.` : 'No records yet. Each one is a folder in data/.');
  process.exit(0);
}
for (const r of shown) {
  const files = fs.readdirSync(path.join(DATA, r));
  console.log(`${r}: ${files.length} file(s)`);
}
