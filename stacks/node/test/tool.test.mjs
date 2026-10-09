// Smoke test: tool.json is valid and every doc it names exists. Add tests
// beside this one as soon as the tool does something.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('tool.json is valid and its docs exist', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'tool.json'), 'utf8'));
  for (const rel of Object.values(m.docs)) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} is missing`);
  }
});
