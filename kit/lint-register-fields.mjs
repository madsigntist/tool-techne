/**
 * Keeps DEFECT-REGISTER.md from going stale.
 *
 * TOOL-KIT MODULE "lint-register-fields". The source is tool-techne/kit/. Never edit
 * a tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails
 * a tool whose copy differs from the source.
 *
 * A register whose numbers drift makes its own prevention claims false, which
 * is worse than having none: it reads as authoritative. This one states
 * "no GATE or GEN fix has ever recurred", and that claim is only worth
 * anything if the tags behind it are counted rather than remembered.
 *
 * WHAT THIS CAN AND CANNOT CHECK
 *
 * Mechanical: the counts the register states about itself, and whether every
 * defect carries the fields that make it a register entry rather than a
 * changelog line.
 *
 * NOT mechanical: whether a new defect was recorded at all. That is judgment,
 * and the counts were verified by hand for weeks before this existed. This
 * closes the half that can be closed and says so, rather than implying the
 * whole problem is solved.
 *
 * FORMAT THIS EXPECTS (the "fields" register): each defect gets its own
 * two-column table, one field per row, under a bullet list of counts:
 *
 *     - Total defects recorded: **N**
 *     - By tag: GATE n, GEN n, RULE n, POINT n
 *     - Recurrences: n ...
 *
 *     | Field | Detail |
 *     | **Symptom** | ... |
 *     | **Tag** | **GATE** |
 *     | **Again?** | No. |
 *
 * So a defect is counted by its Tag row, which every entry has exactly one of.
 *
 * Usage:
 *   node scripts/lint-register.mjs
 *
 * Exits non-zero on drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// `--file` exists for the self-test, which proves this linter fails on a
// register with a wrong count. Normally it reads the project's own.
const fileArg = process.argv.indexOf('--file');
const FILE =
  fileArg !== -1 && process.argv[fileArg + 1]
    ? path.resolve(process.argv[fileArg + 1])
    : path.join(ROOT, 'DEFECT-REGISTER.md');

if (!fs.existsSync(FILE)) {
  console.error('\n  No DEFECT-REGISTER.md at the project root.');
  console.error('  This project keeps one. See AGENTS.md.\n');
  process.exit(1);
}
const md = fs.readFileSync(FILE, 'utf8');
const lines = md.split('\n');
const findings = [];

const TAGS = ['GATE', 'GEN', 'RULE', 'POINT'];

// One Tag row per defect. Bold, because the field name is bold everywhere in
// this file and a bare "| Tag |" would also match the legend at the top.
const tagRows = lines.filter((l) => /^\|\s*\*\*Tag\*\*\s*\|/.test(l));
const total = tagRows.length;

/**
 * The tags a Tag row names.
 *
 * A row may legitimately carry two (GEN for a lookup and POINT for the
 * hand-fixed data). Each is counted once, under the tag it names first.
 * @param {string} line A Tag row.
 * @return {!Array<string>} Tags found, in file order.
 */
function tagsIn(line) {
  // Sorted by position. Filtering TAGS alone returns them in TAGS order, so
  // "**GEN** for the mechanism, plus two **GATE**s" was counted as GATE.
  return TAGS.map((t) => [t, line.search(new RegExp(`\\*\\*${t}\\*\\*`))])
      .filter(([, at]) => at !== -1)
      .sort((a, b) => a[1] - b[1])
      .map(([t]) => t);
}

const byTag = Object.fromEntries(TAGS.map((t) => [t, 0]));
let dualTagged = 0;
for (const row of tagRows) {
  const found = tagsIn(row);
  if (!found.length) {
    findings.push(`a Tag row names none of ${TAGS.join('/')}: ${row.trim().slice(0, 70)}`);
    continue;
  }
  if (found.length > 1) dualTagged += 1;
  // First tag wins: a row's primary tag is the one it names first.
  byTag[found[0]] += 1;
}

// Every defect needs the fields that make recurrence checkable. Consequence
// is not required: some entries fold it into Symptom.
const REQUIRED = ['Symptom', 'Root cause', 'Fix', 'Tag', 'Again?'];
const blocks = md.split(/\n(?=### )/).filter((b) => /^\|\s*\*\*Tag\*\*\s*\|/m.test(b));
for (const b of blocks) {
  const title = (b.match(/^### (.*)$/m) || [, '(untitled)'])[1].trim();
  const missing = REQUIRED.filter(
    (f) => !new RegExp(`^\\|\\s*\\*\\*${f.replace('?', '\\?')}\\*\\*\\s*\\|`, 'm').test(b),
  );
  if (missing.length) {
    findings.push(`"${title.slice(0, 50)}" has no ${missing.join(', ')} row`);
  }
}

/**
 * Reads a number stated in the counts bullet list.
 * @param {!RegExp} re A pattern with one capturing group.
 * @param {string} label What the number is, for the message.
 * @return {?number} The stated value, or null if absent.
 */
function stated(re, label) {
  const m = md.match(re);
  if (!m) {
    findings.push(`the counts block has no "${label}" figure`);
    return null;
  }
  return Number(m[1]);
}

const statedTotal = stated(/Total defects recorded:\s*\*\*(\d+)\*\*/, 'Total defects recorded');
if (statedTotal !== null && statedTotal !== total) {
  findings.push(`"Total defects recorded" says ${statedTotal}, ${total} Tag row(s) present`);
}

const tagLine = md.match(/By tag:\s*(.+)/);
if (!tagLine) {
  findings.push('the counts block has no "By tag" line');
} else {
  for (const t of TAGS) {
    const m = tagLine[1].match(new RegExp(`${t}\\s+(\\d+)`));
    if (!m) {
      findings.push(`"By tag" does not state ${t}`);
      continue;
    }
    if (Number(m[1]) !== byTag[t]) {
      findings.push(`"By tag" says ${t} ${m[1]}, ${byTag[t]} row(s) tagged ${t}`);
    }
  }
  const sum = TAGS.reduce((a, t) => a + byTag[t], 0);
  if (sum !== total) {
    findings.push(`tags sum to ${sum}, ${total} Tag row(s) present`);
  }
}

// "Again?" answering yes is a recurrence. Counted so the headline figure
// cannot quietly drift BELOW the rows that admit one.
//
// Only a plain "Yes" or "×N" is detected. Some rows answer in prose, such as
// "Three times in one file before it was written down", and no regex should
// pretend to parse that reliably. So this is a floor, not a count: the stated
// figure is the authority and may legitimately exceed what is matched here.
// A first version tested the cell against a pattern that still expected the
// leading pipe, so it matched nothing at all and would have accepted any
// stated figure, including zero.
const againRows = lines.filter((l) => /^\|\s*\*\*Again\?\*\*\s*\|/.test(l));
const recurred = againRows.filter((l) =>
  /^\s*\*{0,2}(yes|×\d)/i.test((l.split('|')[2] || '').trim()),
);
const statedRec = stated(/Recurrences:\s*(\d+)/, 'Recurrences');
if (statedRec !== null && statedRec < recurred.length) {
  findings.push(
    `"Recurrences" says ${statedRec}, ${recurred.length} row(s) answer "Again?" with yes`,
  );
}

console.log('\n  === defect register ===');
console.log(
  `  ${total} defect(s): ` +
    TAGS.map((t) => `${t} ${byTag[t]}`).join(', ') +
    `, at least ${recurred.length} admitting recurrence`,
);
if (dualTagged) {
  console.log(`  ${dualTagged} row(s) carry two tags, counted under the first.`);
}
console.log('');

if (findings.length) {
  console.log(`  FAIL  ${findings.length} drift(s) in DEFECT-REGISTER.md:\n`);
  for (const f of findings) console.log(`    - ${f}`);
  console.log('\n  Fix the register. Do NOT adjust the stated numbers to match:');
  console.log('  a wrong number means a row is missing, mistagged, or was');
  console.log('  added without updating the counts.\n');
  process.exit(1);
}

console.log('  PASS  the register is internally consistent');
console.log('');
console.log('  This proves the COUNTS are current. It cannot prove a new defect');
console.log('  was recorded at all: that is judgment. If you fixed something');
console.log('  today that had a root cause, add the row.\n');
