/**
 * Fails when a color value sits outside the token block. A component rule
 * uses var(--token), never a hex, rgb() or hsl() of its own, so a palette
 * change is one edit and light and dark cannot drift apart.
 *
 * TOOL-KIT MODULE "check-colors". The source is tool-techne/kit/. Never
 * edit a tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails a
 * tool whose copy differs from the source.
 *
 * What it reads: the .html and .css files under tool.json "colorScan", a
 * list of files or folders. Without one, a panel reads gui/ and a page
 * reads index.html. In HTML, the <style> blocks and style="" attributes.
 *
 * What counts as the token block: any rule whose selector is :root or
 * carries [data-theme], including inside @media. Everywhere else, a hex
 * color or a color function (rgb, hsl, hwb, lab, lch, oklab, oklch) is a
 * finding. Named colors (white, red) are not looked for.
 *
 * Usage:
 *   node scripts/check-colors.mjs
 *
 * Exits 1 when it finds any.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g;
const TOKEN_SELECTOR_RE = /(^|[\s,(]):root\b|\[data-theme/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'data']);

/**
 * @return {!Array<string>} The configured paths, or the profile's default.
 */
function scanPaths() {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'tool.json'), 'utf8'));
  if (Array.isArray(m.colorScan)) return m.colorScan;
  return m.profile === 'page' ? ['index.html'] : ['gui'];
}

/**
 * @param {string} p A file or folder, relative to the tool.
 * @return {!Array<string>} Every .html and .css file at or under it.
 */
function files(p) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return /\.(html?|css)$/i.test(abs) ? [abs] : [];
  return fs.readdirSync(abs, {withFileTypes: true})
      .filter((e) => !(e.isDirectory() && SKIP_DIRS.has(e.name)))
      .flatMap((e) => files(path.join(p, e.name)));
}

/**
 * @param {string} text Source text.
 * @param {number} index A position in it.
 * @return {number} The 1-based line of that position.
 */
function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * Finds color values in CSS outside a token rule.
 * @param {string} css The stylesheet, with comments still in.
 * @param {number} offset Where it starts in the whole file.
 * @param {string} whole The whole file, for line numbers.
 * @return {!Array<{line: number, value: string, where: string}>} Findings.
 */
function scanCss(css, offset, whole) {
  // Blank out comments, keeping every position where it was.
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const found = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      stack.push(src.slice(start, i).trim());
      start = i + 1;
    } else if (ch === '}' || ch === ';') {
      const decl = src.slice(start, i);
      const inToken = stack.some((s) => TOKEN_SELECTOR_RE.test(s));
      if (!inToken && stack.length) {
        for (const m of decl.matchAll(COLOR_RE)) {
          found.push({
            line: lineAt(whole, offset + start + m.index),
            value: decl.slice(m.index).match(/^[^;,\s)]+\)?/)[0],
            where: stack[stack.length - 1],
          });
        }
      }
      if (ch === '}') stack.pop();
      start = i + 1;
    }
  }
  return found;
}

/**
 * @param {string} file An .html or .css file.
 * @return {!Array<{line: number, value: string, where: string}>} Findings.
 */
function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.css$/i.test(file)) return scanCss(text, 0, text);
  const found = [];
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    found.push(...scanCss(m[1], m.index + m[0].indexOf(m[1]), text));
  }
  for (const m of text.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) {
    for (const c of m[1].matchAll(COLOR_RE)) {
      found.push({line: lineAt(text, m.index), value: c[0], where: 'style=""'});
    }
  }
  return found;
}

const list = scanPaths().flatMap(files);
const findings = list.flatMap((f) => scanFile(f).map((x) => ({...x, file: path.relative(ROOT, f)})));
if (findings.length) {
  console.log(`FAIL  ${findings.length} color value(s) outside the token block:`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  ${f.value}  in ${f.where}`);
  }
  console.log('Add a token in :root (light and dark) and use var(--token) here.');
  process.exit(1);
}
console.log(`PASS  no color values outside the token block (${list.length} file(s))`);
