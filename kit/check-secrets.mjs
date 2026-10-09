/**
 * Stops passwords, API keys and private keys from reaching the code history.
 *
 * TOOL-KIT MODULE "check-secrets". The source is tool-techne/kit/. Never
 * edit a tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails a
 * tool whose copy differs from the source.
 *
 * Why. Someone new to this pastes an API key into a script to get it
 * working, commits it, and pushes it to a public repo. Bots scan public
 * repos for keys within minutes. Deleting the file later does not help:
 * the key stays in the history.
 *
 * What it scans: every file git would keep (tracked, plus new files that
 * .gitignore does not exclude). Outside a git repo, every file except
 * node_modules/ and .git/.
 *
 * What fails:
 *   - files that only ever hold secrets: .env (not .env.example), anything
 *     in secrets/, *.pem, *.key, id_rsa
 *   - text that looks like a real key: private key blocks, and the key
 *     shapes of AWS, GitHub, Slack, Stripe, Google, OpenAI and Anthropic
 *
 * A line that is a known false alarm can end with the comment
 * `secret-scan: allow`. Use it for example values, never for a real key.
 *
 * WHAT THIS CANNOT CHECK: a password typed as an ordinary word. It catches
 * the shapes keys have, not every secret.
 *
 * Usage:
 *   node scripts/check-secrets.mjs
 *
 * Exits 1 when it finds anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 1_000_000;
const ALLOW = 'secret-scan: allow';

/** File paths that should never be committed, whatever they hold. */
const SECRET_FILES = [
  {re: /(^|\/)\.env(\.[^/]*)?$/, why: 'an .env file holds settings and passwords', except: /\.env\.example$/},
  {re: /(^|\/)secrets\//, why: 'secrets/ is for credentials'},
  {re: /\.(pem|key|p12|pfx)$/i, why: 'a key or certificate file'},
  {re: /(^|\/)id_(rsa|ed25519|ecdsa)$/, why: 'a private SSH key'},
];

/** Text shapes of real keys. Each is specific enough to rarely misfire. */
const SECRET_TEXT = [
  {re: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/, what: 'a private key'},
  {re: /\bAKIA[0-9A-Z]{16}\b/, what: 'an AWS access key'},
  {re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/, what: 'a GitHub token'},
  {re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/, what: 'a GitHub token'},
  {re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, what: 'a Slack token'},
  {re: /\b[sr]k_live_[A-Za-z0-9]{20,}\b/, what: 'a Stripe live key'},
  {re: /\bAIza[0-9A-Za-z_-]{35}\b/, what: 'a Google API key'},
  {re: /\bsk-ant-[A-Za-z0-9_-]{20,}/, what: 'an Anthropic API key'},
  {re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/, what: 'an OpenAI API key'},
];

/**
 * @return {!Array<string>} Paths relative to ROOT, with forward slashes,
 *     of every file git would keep.
 */
function candidates() {
  const r = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {cwd: ROOT, encoding: 'utf8'});
  if (r.status === 0) return r.stdout.split('\0').filter(Boolean);
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
    }
  };
  walk(ROOT);
  return out;
}

const findings = [];
for (const rel of candidates()) {
  const named = SECRET_FILES.find((s) => s.re.test(rel) && !(s.except && s.except.test(rel)));
  if (named) {
    findings.push(`${rel}: ${named.why}. Add it to .gitignore, or move it out of the folder.`);
    continue;
  }
  const abs = path.join(ROOT, rel);
  let buf;
  try {
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    buf = fs.readFileSync(abs);
  } catch {
    continue;
  }
  if (buf.includes(0)) continue; // binary
  buf.toString('utf8').split('\n').forEach((line, i) => {
    if (line.includes(ALLOW)) return;
    const hit = SECRET_TEXT.find((s) => s.re.test(line));
    if (hit) findings.push(`${rel}:${i + 1}: looks like ${hit.what}. Move it to .env and read it from there.`);
  });
}

if (findings.length) {
  console.log(`FAIL  ${findings.length} possible secret(s):\n`);
  findings.forEach((f) => console.log(`  - ${f}`));
  console.log('\nIf a real key was already committed or pushed, removing it is not');
  console.log('enough: cancel the key with whoever issued it, and make a new one.');
  process.exit(1);
}
console.log('PASS  no secrets found in files git would keep');
