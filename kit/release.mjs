/**
 * Builds a release of this tool, a ZIP someone else can use with nothing
 * else around it, and with --publish puts it on GitHub.
 *
 * TOOL-KIT MODULE "release". The source is tool-techne/kit/. Never edit a
 * tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails a
 * tool whose copy differs from the source.
 *
 * Why. A tool that only works inside its author's folder is not finished.
 * This builds dist/<name>.zip from the last commit, with a top folder named
 * exactly after the tool, then unzips it somewhere empty and runs the full
 * check there. If the tool quietly depends on anything outside itself (a
 * parent folder's instructions, a file it reads but does not carry), that is
 * where it shows.
 *
 * What goes in: every file git tracks, minus tool.json "releaseExclude"
 * (patterns like "sites", "data/archive"), for folders that hold your own
 * records or client work rather than the tool.
 *
 * Without --publish nothing leaves this computer and git is not changed:
 *   1. refuses uncommitted changes, and a version already tagged
 *   2. runs the full check
 *   3. builds the ZIP and lists what is in it
 *   4. unzips it, installs its dependencies there if it has any, and runs
 *      the full check in that copy (--no-install skips the install, and
 *      then only the quick check runs)
 *
 * With --publish, after 1 and 2: sets the version in package.json (if there
 * is one) and commits it, builds and verifies the ZIP, tags v<version>,
 * pushes the branch and the tag to origin, and creates the GitHub release
 * with the ZIP attached. Needs the GitHub CLI; it uses git's saved GitHub
 * sign-in if gh has none. In a terminal it asks first; elsewhere it needs
 * --yes.
 *
 * Usage:
 *   node scripts/release.mjs 1.0.0              build and verify only
 *   node scripts/release.mjs 1.0.0 --publish    release it
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import zlib from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'tool.json'), 'utf8'));
const NAME = manifest.name;
const EXCLUDE = Array.isArray(manifest.releaseExclude) ? manifest.releaseExclude : [];
const ZIP = path.join(HERE, 'dist', `${NAME}.zip`);
const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const PUBLISH = args.includes('--publish');
const INSTALL = !args.includes('--no-install');
const tag = `v${version}`;

/**
 * @param {string} msg Why it stopped, and what to do.
 * @return {never}
 */
function die(msg) {
  console.error(`\n  Stopped: ${msg}\n`);
  process.exit(1);
}

/**
 * Runs a command, quietly unless asked.
 * @param {string} cmd Executable.
 * @param {!Array<string>} argv Arguments.
 * @param {{cwd: (string|undefined), env: (Object|undefined)}=} o Options.
 * @return {{ok: boolean, out: string}} Result.
 */
function sh(cmd, argv, o = {}) {
  const r = spawnSync(cmd, argv, {cwd: o.cwd || HERE, encoding: 'utf8', env: o.env || process.env, maxBuffer: 64 * 1024 * 1024});
  return {ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim()};
}

/**
 * @param {string} label What happened.
 * @return {void}
 */
const ok = (label) => console.log(`  OK    ${label}`);

/**
 * Extracts a ZIP written by git archive (stored or deflated, no ZIP64) into
 * a folder, refusing any entry that would land outside it.
 * @param {string} file The ZIP.
 * @param {string} dest Folder to extract into.
 * @return {!Array<string>} Entry names.
 */
function extractZip(file, dest) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('not a ZIP file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let n = 0; n < count; n += 1) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    names.push(name);
    const out = path.resolve(dest, name);
    if (!out.startsWith(path.resolve(dest) + path.sep)) throw new Error(`unsafe path in ZIP: ${name}`);
    if (name.endsWith('/')) {
      fs.mkdirSync(out, {recursive: true});
      continue;
    }
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    fs.mkdirSync(path.dirname(out), {recursive: true});
    fs.writeFileSync(out, method === 8 ? zlib.inflateRawSync(raw) : raw);
  }
  return names;
}

/**
 * Builds the ZIP from HEAD and proves an unzipped copy works on its own.
 * @return {void}
 */
function buildAndVerify() {
  fs.mkdirSync(path.dirname(ZIP), {recursive: true});
  const paths = ['.', ...EXCLUDE.map((e) => `:(exclude)${e}`)];
  const a = sh('git', ['archive', '--format=zip', `--prefix=${NAME}/`, '-o', ZIP, 'HEAD', '--', ...paths]);
  if (!a.ok) die(`git archive failed: ${a.out}`);
  ok(`built ${path.relative(HERE, ZIP)} (${Math.round(fs.statSync(ZIP).size / 1024)} KB)`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `${NAME}-release-`));
  const names = extractZip(ZIP, tmp);
  const stray = names.filter((n) => !n.startsWith(`${NAME}/`));
  if (stray.length) die(`the ZIP has entries outside ${NAME}/: ${stray.slice(0, 3).join(', ')}`);
  const top = [...new Set(names.map((n) => n.split('/')[1]).filter(Boolean))].sort();
  ok(`${names.length} entries, all inside ${NAME}/`);
  console.log(`        top level: ${top.join(', ')}`);
  if (EXCLUDE.length) console.log(`        left out (releaseExclude): ${EXCLUDE.join(', ')}`);

  const copy = path.join(tmp, NAME);
  const pkgPath = path.join(copy, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
  const hasDeps = Object.keys({...pkg.dependencies, ...pkg.devDependencies}).length > 0;
  let quick = false;
  if (hasDeps && INSTALL) {
    console.log('  ...   installing its dependencies in the unzipped copy');
    const inst = sh(process.execPath, ['scripts/install.mjs'], {cwd: copy});
    if (!inst.ok) die(`setup fails in the unzipped copy:\n\n${inst.out.split('\n').slice(-25).join('\n')}`);
    ok('setup works in the unzipped copy');
  } else if (hasDeps) {
    quick = true;
  }
  console.log(`  ...   running the ${quick ? 'quick' : 'full'} check in the unzipped copy (no .git, no folder around it)`);
  const c = sh(process.execPath, ['scripts/check.mjs', ...(quick ? ['--quick'] : [])], {cwd: copy});
  if (!c.ok) die(`the unzipped copy fails its check:\n\n${c.out.split('\n').slice(-25).join('\n')}`);
  ok(`the unzipped copy passes its ${quick ? 'quick' : 'full'} check`);
  fs.rmSync(tmp, {recursive: true, force: true});
}

if (!/^\d+\.\d+\.\d+$/.test(version || '')) die('give a version like 1.0.0: node scripts/release.mjs 1.0.0');
console.log(`\n  ${NAME} ${tag}${PUBLISH ? ': release' : ': build and verify only'}\n`);

const dirty = sh('git', ['status', '--porcelain']);
if (dirty.out) die(`there are uncommitted changes. Commit or discard them first:\n${dirty.out}`);
ok('no uncommitted changes');
if (sh('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]).ok) die(`${tag} is already tagged. Use the next version.`);
ok(`${tag} is not tagged yet`);

console.log('  ...   running the full check');
if (!sh(process.execPath, ['scripts/check.mjs']).ok) die('the check fails. Run node scripts/check.mjs to see why.');
ok('the full check passes');

if (!PUBLISH) {
  buildAndVerify();
  console.log(`\n  Verified: dist/${NAME}.zip works on its own. Nothing was published.`);
  console.log(`  To release on GitHub: node scripts/release.mjs ${version} --publish\n`);
  process.exit(0);
}

/**
 * The environment for gh. When gh has no sign-in of its own, borrows the
 * GitHub token git already saved, for this run only. It is passed in
 * memory, never written or printed.
 * @return {?Object} Environment for gh, or null when there is no sign-in.
 */
function ghEnv() {
  if (sh('gh', ['auth', 'status']).ok) return process.env;
  const r = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    timeout: 30_000,
    env: {...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0'},
  });
  const token = /^password=(.+)$/m.exec(r.stdout || '')?.[1];
  if (!token) return null;
  const env = {...process.env, GH_TOKEN: token};
  return spawnSync('gh', ['api', 'user'], {env, encoding: 'utf8'}).status === 0 ? env : null;
}

if (!sh('gh', ['--version']).ok) die('the GitHub CLI is not installed: https://cli.github.com');
const GH_ENV = ghEnv();
if (!GH_ENV) die('no GitHub sign-in for gh or git. Run: gh auth login');
const remote = sh('git', ['remote', 'get-url', 'origin']);
if (!remote.ok) die('no "origin" remote. Run: git remote add origin <repo URL>');
const branch = sh('git', ['branch', '--show-current']).out;

console.log(`\n  This will publish ${tag} to ${remote.out}:`);
console.log(`    tag ${tag}, push ${branch} and the tag, and create the GitHub release`);
console.log(`    with ${NAME}.zip attached.\n`);
if (process.stdin.isTTY) {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  const answer = await rl.question(`  Type ${version} to publish: `);
  rl.close();
  if (answer.trim() !== version) die('not confirmed. Nothing was published.');
} else if (!args.includes('--yes')) {
  die('not a terminal, so it cannot ask. Add --yes to confirm.');
}

const pkgPath = path.join(HERE, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.version !== version) {
    pkg.version = version;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    if (!sh('git', ['commit', '-q', '-am', `Release ${tag}`]).ok) die('could not commit the version change');
    ok(`package.json set to ${version} and committed`);
  }
}
buildAndVerify();
if (!sh('git', ['tag', '-a', tag, '-m', `${NAME} ${tag}`]).ok) die(`could not tag ${tag}`);
ok(`tagged ${tag}`);

const push = sh('git', ['push', '-u', 'origin', branch, tag]);
if (!push.ok) die(`push failed. The tag is local; fix the problem, then run: git push -u origin ${branch} ${tag}\n${push.out}`);
ok(`pushed ${branch} and ${tag}`);

const rel = sh('gh', ['release', 'create', tag, ZIP, '--title', `${NAME} ${tag}`, '--generate-notes', '--latest'], {env: GH_ENV});
if (!rel.ok) die(`the release was not created: ${rel.out}\nThe tag is pushed. Retry: gh release create ${tag} ${ZIP} --generate-notes`);
ok(`release created: ${rel.out.split('\n').pop()}`);
console.log('\n  Published.\n');
