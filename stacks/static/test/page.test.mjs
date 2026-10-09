// The page has what every page needs to be usable and accessible. Add
// tests beside this one as the page grows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('index.html declares its language, title and viewport', () => {
  assert.match(html, /<html[^>]*\slang="[a-z-]+"/i, 'add lang="en" (or your language) to <html>');
  assert.match(html, /<title>[^<]+<\/title>/i, 'add a <title>');
  assert.match(html, /<meta[^>]+name="viewport"/i, 'add the viewport meta tag');
});

test('every image has alt text', () => {
  const missing = (html.match(/<img\b[^>]*>/gi) || []).filter((t) => !/\salt=/.test(t));
  assert.deepEqual(missing, [], 'give each <img> an alt attribute');
});

test('the page has exactly one h1', () => {
  assert.equal((html.match(/<h1[\s>]/gi) || []).length, 1);
});
