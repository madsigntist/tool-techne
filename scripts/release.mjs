/**
 * Builds a tool-techne release, and with --publish puts it on GitHub.
 *
 * Why. GitHub's own "Download ZIP" names the folder tool-techne-main, and
 * every command in the docs says tool-techne. This builds a ZIP whose top
 * folder is exactly tool-techne, proves a copy unzipped from it works, and
 * attaches it to the GitHub release, where the README's download link
 * points.
 *
 * Without --publish nothing leaves this computer and git is not changed:
 *   1. refuses uncommitted changes, and a version already tagged
 *   2. runs the full check
 *   3. builds dist/tool-techne.zip from the last commit
 *   4. unzips it to a temp folder and runs the full check THERE, as a
 *      downloader would have it: no .git folder
 *
 * With --publish, after 1 and 2:
 *   sets the version in package.json and commits it, builds and verifies
 *   the ZIP, tags v<version>, pushes the branch and the tag to origin, and
 *   creates the GitHub release with the ZIP attached (needs the GitHub CLI,
 *   signed in). In a terminal it asks first; elsewhere it needs --yes.
 *
 * Usage:
 *   node scripts/release.mjs 1.0.0              build and verify only
 *   node scripts/release.mjs 1.0.0 --publish    release it
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extractZip} from './lib/zip.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'tool-techne';
const ZIP = path.join(HERE, 'dist', `${NAME}.zip`);
const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const PUBLISH = args.includes('--publish');
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
 * Runs a command, quietly unless it fails.
 * @param {string} cmd Executable.
 * @param {!Array<string>} argv Arguments.
 * @param {{cwd: (string|undefined), show: (boolean|undefined)}=} o Options.
 * @return {{ok: boolean, out: string}} Result.
 */
function sh(cmd, argv, o = {}) {
  const r = spawnSync(cmd, argv, {cwd: o.cwd || HERE, encoding: 'utf8', stdio: o.show ? 'inherit' : 'pipe'});
  return {ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim()};
}

/**
 * @param {string} label What happened.
 * @return {void}
 */
const ok = (label) => console.log(`  OK    ${label}`);

/**
 * Builds the ZIP from HEAD and proves an unzipped copy passes its check.
 * @return {void}
 */
function buildAndVerify() {
  fs.mkdirSync(path.dirname(ZIP), {recursive: true});
  const a = sh('git', ['archive', '--format=zip', `--prefix=${NAME}/`, '-o', ZIP, 'HEAD']);
  if (!a.ok) die(`git archive failed: ${a.out}`);
  ok(`built ${path.relative(HERE, ZIP)} (${Math.round(fs.statSync(ZIP).size / 1024)} KB)`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'techne-release-'));
  const names = extractZip(ZIP, tmp);
  const stray = names.filter((n) => !n.startsWith(`${NAME}/`));
  if (stray.length) die(`the ZIP has entries outside ${NAME}/: ${stray.slice(0, 3).join(', ')}`);
  ok(`every entry is inside ${NAME}/ (${names.length} entries)`);

  console.log('  ...   running the full check in the unzipped copy (no .git, as a download)');
  const c = sh(process.execPath, ['scripts/check.mjs'], {cwd: path.join(tmp, NAME)});
  if (!c.ok) die(`the unzipped copy fails its check:\n\n${c.out.split('\n').slice(-25).join('\n')}`);
  ok('the unzipped copy passes its full check');
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
const check = sh(process.execPath, ['scripts/check.mjs']);
if (!check.ok) die(`the check fails. Run node scripts/check.mjs to see why.`);
ok('the full check passes');

if (!PUBLISH) {
  buildAndVerify();
  console.log(`\n  Verified. Nothing was published. To release: node scripts/release.mjs ${version} --publish\n`);
  process.exit(0);
}

// Publishing: everything that can fail locally is checked before anything
// is pushed.
if (!sh('gh', ['--version']).ok) die('the GitHub CLI is not installed: https://cli.github.com');
if (!sh('gh', ['auth', 'status']).ok) die('the GitHub CLI is not signed in. Run: gh auth login');
const remote = sh('git', ['remote', 'get-url', 'origin']);
if (!remote.ok) die('no "origin" remote. Run: git remote add origin <repo URL>');
const branch = sh('git', ['branch', '--show-current']).out;

console.log(`\n  This will publish ${tag} to ${remote.out}:`);
console.log(`    commit the version, tag ${tag}, push ${branch} and the tag, and create`);
console.log(`    the GitHub release with ${NAME}.zip attached.\n`);
if (process.stdin.isTTY) {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  const answer = await rl.question(`  Type ${version} to publish: `);
  rl.close();
  if (answer.trim() !== version) die('not confirmed. Nothing was published.');
} else if (!args.includes('--yes')) {
  die('not a terminal, so it cannot ask. Add --yes to confirm.');
}

const pkgPath = path.join(HERE, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.version !== version) {
  pkg.version = version;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  if (!sh('git', ['commit', '-q', '-am', `Release ${tag}`]).ok) die('could not commit the version change');
  ok(`package.json set to ${version} and committed`);
}
buildAndVerify();
if (!sh('git', ['tag', '-a', tag, '-m', `${NAME} ${tag}`]).ok) die(`could not tag ${tag}`);
ok(`tagged ${tag}`);

const push = sh('git', ['push', '-u', 'origin', branch, tag]);
if (!push.ok) die(`push failed. The tag is local; fix the problem, then run: git push -u origin ${branch} ${tag}\n${push.out}`);
ok(`pushed ${branch} and ${tag}`);

const rel = sh('gh', ['release', 'create', tag, ZIP, '--title', `${NAME} ${tag}`, '--generate-notes', '--latest']);
if (!rel.ok) die(`the release was not created: ${rel.out}\nThe tag is pushed. Retry: gh release create ${tag} ${ZIP} --generate-notes`);
ok(`release created: ${rel.out.split('\n').pop()}`);
console.log('\n  Published.\n');
