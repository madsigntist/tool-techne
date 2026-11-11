/**
 * The start of a session, in one short printout: where the work stands,
 * how many decisions are settled, and which defects can still come back.
 *
 * TOOL-KIT MODULE "brief". The source is tool-techne/kit/. Never edit a
 * tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails a
 * tool whose copy differs from the source.
 *
 * WHY: ROADMAP.md and DEFECT-REGISTER.md grow with every session. Read
 * whole at the start of each one, they cost more than the work. This prints
 * the parts a session needs first, so the AI reads the rest only for the
 * area it is working in.
 *
 * What it prints:
 *   - ROADMAP's first section ("Start here"), cut at 40 lines
 *   - how many settled decisions there are, and where
 *   - the register's index: each section with its row count and tags
 *   - every RULE, POINT or OPEN row by title: the ones that can recur
 *   - the size of both files, so growth is seen
 *
 * Reads either register shape: one table row per defect, or one two-column
 * table per defect with a **Tag** row.
 *
 * Usage:
 *   node scripts/brief.mjs
 *   node scripts/brief.mjs --dir <tool folder>
 *
 * Changes nothing. Always exits 0: a missing file is reported, not fatal.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const dirArg = process.argv.indexOf('--dir');
const ROOT = dirArg !== -1 && process.argv[dirArg + 1]
  ? path.resolve(process.argv[dirArg + 1])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START_LINES = 40;
const OPEN_MAX = 30;
const TAGS = ['GATE', 'GEN', 'RULE', 'POINT', 'OPEN'];
const RECUR = ['RULE', 'POINT', 'OPEN'];

/**
 * @param {string} file Path.
 * @return {string} Its text with line endings normalized, or '' if absent.
 */
function read(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
}

// Kept equal to DOC_MAX_KB in tool-techne's scripts/lib/standard.mjs. A
// tool's tool.json docMaxKB raises either.
const DOC_MAX_KB = {roadmap: 40, register: 150};

/**
 * @return {{roadmap: string, register: string, budget: !Object}} The two
 *     document paths, from tool.json when it names them, and their budgets.
 */
function docPaths() {
  let m = {};
  try {
    m = JSON.parse(read(path.join(ROOT, 'tool.json')).replace(/^﻿/, ''));
  } catch {
    /* defaults below */
  }
  const docs = m.docs || {};
  return {
    roadmap: path.join(ROOT, docs.roadmap || 'ROADMAP.md'),
    register: path.join(ROOT, docs.register || 'DEFECT-REGISTER.md'),
    budget: {...DOC_MAX_KB, ...(m.docMaxKB && typeof m.docMaxKB === 'object' ? m.docMaxKB : {})},
  };
}

/**
 * Splits Markdown into its level-two sections.
 * @param {string} text The document.
 * @return {!Array<{title: string, lines: !Array<string>}>} In order.
 */
function sections(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const h = /^## (.+)$/.exec(line);
    if (h) out.push({title: h[1].trim(), lines: []});
    else if (out.length) out[out.length - 1].lines.push(line);
  }
  return out;
}

/**
 * @param {string} cell A table cell.
 * @return {?string} The tag it holds, when it holds only a tag.
 */
function tagOf(cell) {
  const m = /^\**\s*([A-Z]+)\s*\**$/.exec(cell.trim());
  return m && TAGS.includes(m[1]) ? m[1] : null;
}

/**
 * Every defect in the register, in either shape.
 * @param {string} text The register.
 * @return {!Array<{section: string, title: string, tag: string}>} Rows.
 */
function registerRows(text) {
  const rows = [];
  let section = '';
  let entry = '';
  for (const line of text.split('\n')) {
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      section = h2[1].trim();
      entry = '';
      continue;
    }
    const h3 = /^### (.+)$/.exec(line);
    if (h3) {
      entry = h3[1].trim();
      continue;
    }
    // The audit and the counts restate rows; they are not defects.
    if (!line.startsWith('|') || /recurrence audit|numbers say|current counts/i.test(section)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    // Fields shape: | **Tag** | **GATE** |
    if (/^\**Tag\**$/i.test(cells[0] || '') && cells.length >= 2) {
      const tag = tagOf(cells[1]) || (/\b(GATE|GEN|RULE|POINT|OPEN)\b/.exec(cells[1]) || [])[1];
      if (tag) rows.push({section, title: entry, tag});
      continue;
    }
    // Table shape: | 1.2 | Problem | ... | GATE | ... |
    if (/^\d+(\.\d+)*$/.test(cells[0] || '')) {
      const tag = cells.map(tagOf).find(Boolean);
      if (tag) rows.push({section, title: `${cells[0]} ${cells[1] || ''}`.trim(), tag});
    }
  }
  return rows;
}

/**
 * @param {string} file Path.
 * @param {number} max Its budget in KB.
 * @return {string} Its size, as "12 KB", flagged when over budget.
 */
function size(file, max) {
  try {
    const kb = Math.round(fs.statSync(file).size / 1024);
    return kb > max ? `${kb} KB (OVER its ${max} KB budget)` : `${kb} KB`;
  } catch {
    return 'missing';
  }
}

/**
 * @param {string} s Text.
 * @param {number} n Most characters.
 * @return {string} Cut to n, with an ellipsis when cut.
 */
function cut(s, n) {
  return s.length > n ? `${s.slice(0, n - 3)}...` : s;
}

const {roadmap, register, budget} = docPaths();
const out = [];

const road = sections(read(roadmap));
if (!road.length) {
  out.push(`No ${path.basename(roadmap)} sections found.`);
} else {
  const first = road[0];
  const body = first.lines.join('\n').trim().split('\n');
  out.push(`== ${path.basename(roadmap)}: ${first.title} ==`, ...body.slice(0, START_LINES));
  if (body.length > START_LINES) out.push(`... ${body.length - START_LINES} more lines in ${path.basename(roadmap)}`);
  const dec = road.find((s) => /decision/i.test(s.title));
  if (dec) {
    const n = dec.lines.filter((l) => /^\s*-\s|^\|\s*[^-\s|]/.test(l)).length;
    out.push('', `Settled decisions: about ${n}, under "${dec.title}". Search there before proposing a change of direction.`);
  }
}

const rows = registerRows(read(register));
out.push('', `== ${path.basename(register)}: ${rows.length} defects ==`);
const count = (list) => TAGS.map((t) => [t, list.filter((r) => r.tag === t).length])
  .filter(([, n]) => n)
  .map(([t, n]) => `${t} ${n}`)
  .join(', ');
if (rows.length) out.push(`By tag: ${count(rows)}`);
const bySection = new Map();
for (const r of rows) bySection.set(r.section, [...(bySection.get(r.section) || []), r]);
for (const [s, list] of bySection) out.push(`  ${s}: ${list.length} (${count(list)})`);
const open = rows.filter((r) => RECUR.includes(r.tag));
if (open.length) {
  out.push('', 'Can recur (RULE, POINT, OPEN). Read the full row before working in its area:');
  open.slice(0, OPEN_MAX).forEach((r) => out.push(`  ${r.tag.padEnd(5)} ${cut(`${r.section} > ${r.title}`, 110)}`));
  if (open.length > OPEN_MAX) out.push(`  ... ${open.length - OPEN_MAX} more`);
}

out.push(
  '',
  `Sizes: ${path.basename(roadmap)} ${size(roadmap, budget.roadmap)}, ${path.basename(register)} ${size(register, budget.register)}.`,
  'Read a register section in full when working in its area; there is no need to read the whole file.',
);
const roadText = read(roadmap);
const ticked = (roadText.match(/^\s*[-*] \[[xX]\]/gm) || []).length;
if (ticked > 10) out.push(`${path.basename(roadmap)} holds ${ticked} ticked boxes: finished work is deleted from it, not kept.`);
console.log(out.join('\n'));
