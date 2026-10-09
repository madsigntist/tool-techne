/**
 * Reads a ZIP file with Node's own zlib, so verifying a release needs no
 * unzip program. Handles what `git archive --format=zip` writes: stored and
 * deflated entries, no ZIP64, no encryption.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * @param {!Buffer} buf A whole ZIP file.
 * @return {!Array<{name: string, data: ?Buffer}>} Every entry. Folders have
 *     a name ending in / and null data.
 * @throws {Error} When it is not a ZIP this can read.
 */
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('not a ZIP file (no end-of-directory record)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged ZIP directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) {
      entries.push({name, data: null});
      continue;
    }
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method === 0) entries.push({name, data: raw});
    else if (method === 8) entries.push({name, data: zlib.inflateRawSync(raw)});
    else throw new Error(`${name}: compression method ${method} is not supported`);
  }
  return entries;
}

/**
 * Extracts a ZIP into a folder, refusing any entry that would land outside
 * it.
 * @param {string} file The ZIP.
 * @param {string} dest Folder to extract into.
 * @return {!Array<string>} Entry names.
 */
export function extractZip(file, dest) {
  const entries = readZip(fs.readFileSync(file));
  for (const e of entries) {
    const out = path.resolve(dest, e.name);
    if (!out.startsWith(path.resolve(dest) + path.sep)) throw new Error(`unsafe path in ZIP: ${e.name}`);
    if (e.data === null) fs.mkdirSync(out, {recursive: true});
    else {
      fs.mkdirSync(path.dirname(out), {recursive: true});
      fs.writeFileSync(out, e.data);
    }
  }
  return entries.map((e) => e.name);
}
