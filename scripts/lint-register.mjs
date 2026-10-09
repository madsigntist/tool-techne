/**
 * Keeps DEFECT-REGISTER.md from going stale.
 *
 * TOOL-KIT MODULE "lint-register-table". The source is tool-techne/kit/. Never edit
 * a tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails
 * a tool whose copy differs from the source.
 *
 * A register whose numbers drift makes its own prevention claims false, which
 * is worse than having none: it reads as authoritative.
 *
 * WHAT THIS CAN AND CANNOT CHECK
 *
 * Mechanical: the counts the register states about itself. Every defect row is
 * numbered and tagged, so rows, duplicates, columns and tag totals are all
 * countable, and drift in them is the failure that actually happens.
 *
 * NOT mechanical: whether a new defect was recorded at all. That is judgment.
 * This closes the half that can be closed and says so, rather than implying
 * the whole problem is solved.
 *
 * Project-agnostic on purpose. Add checks for this project's own numbers
 * (built artefacts, gate scripts, test counts) as it grows.
 *
 * Usage:
 *   node scripts/lint-register.mjs
 *
 * Exits non-zero on drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'DEFECT-REGISTER.md');

if (!fs.existsSync(FILE)) {
  console.error('No DEFECT-REGISTER.md at the project root.');
  console.error('This project keeps one. See AGENTS.md.');
  process.exit(1);
}
const md = fs.readFileSync(FILE, 'utf8');
const findings = [];

// A defect row starts with a section number like "4b.10" AND carries all
// seven columns. The cell count is what separates it from the recurrence
// audit, which cites the same ids in a narrower table.
const CELLS = 7;
const rowLines = md.split('\n')
    .filter((l) => /^\|\s*\d+b?\.\d+\s*\|/.test(l))
    .map((l) => ({ cells: l.split('|').slice(1, -1) }));

const full = rowLines.filter((r) => r.cells.length >= CELLS);
const ids = full.map((r) => r.cells[0].trim());
const unique = new Set(ids);

if (ids.length !== unique.size) {
  const seen = new Set();
  const dupes = ids.filter((r) => seen.has(r) || (seen.add(r), false));
  findings.push(`duplicate defect id(s): ${[...new Set(dupes)].join(', ')}`);
}

const thin = rowLines
    .filter((r) => r.cells.length < CELLS)
    .map((r) => r.cells[0].trim())
    .filter((id) => !unique.has(id));
if (thin.length) {
  findings.push(`row(s) missing the "Found by" / "Again?" columns: ` +
      thin.join(', '));
}

/**
 * Reads a number out of the headline table.
 * @param {string} label
 * @return {?number}
 */
function stated(label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = md.match(new RegExp(`\\|\\s*${esc}\\s*\\|\\s*\\**~?(\\d+)`));
  return m ? Number(m[1]) : null;
}

const check = (label, actual, what) => {
  const s = stated(label);
  if (s === null) {
    findings.push(`headline table has no "${label}" row`);
  } else if (s !== actual) {
    findings.push(`"${label}" says ${s}, ${actual} ${what}`);
  }
};

check('Defects recorded', unique.size, 'defect row(s) present');

const tagged = (tag) => full
    .filter((r) => new RegExp(`\\b${tag}\\b`).test(r.cells[4])).length;
check('Fixed by a gate or a generator', tagged('GATE') + tagged('GEN'),
    'row(s) tagged GATE or GEN');

const recurred = full
    .filter((r) => /^\**(yes|×\d)/i.test(r.cells[6].trim()))
    .map((r) => r.cells[0].trim());
check('Defect classes that recurred', recurred.length,
    `row(s) marked yes or times-N (${recurred.join(', ') || 'none'})`);

console.log(`\n=== defect register ===`);
console.log(`${unique.size} defect(s), ${recurred.length} recurrence(s)\n`);

if (findings.length) {
  console.log(`FAIL  ${findings.length} drift(s) in DEFECT-REGISTER.md:\n`);
  for (const f of findings) console.log(`  - ${f}`);
  console.log('\nFix the register. Do not adjust the headline numbers to');
  console.log('match: a wrong number means a row is missing or mistagged.');
  process.exit(1);
}

console.log('PASS  the register is internally consistent');
console.log('\nNote: this proves the COUNTS are current. It cannot prove a new');
console.log('defect was recorded at all. If you fixed something today that');
console.log('had a root cause, add the row.');
