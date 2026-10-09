// Positive controls for tool-techne: scaffold real tools into a temp folder,
// prove they pass, then break one thing at a time and prove the right check
// goes red for exactly that reason.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkAll, checkTool, nextPort} from '../scripts/lib/standard.mjs';
import {extractZip} from '../scripts/lib/zip.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEW_TOOL = path.join(HERE, 'scripts', 'new-tool.mjs');

// Every child process runs with an empty home folder and its own git
// identity, as on a stranger's computer. A scaffold that reads anything from
// the author's home folder fails here (register 1.3).
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'techne-home-'));
const GITCONFIG = path.join(HOME, '.gitconfig');
fs.writeFileSync(GITCONFIG, '[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n');
const ENV = {...process.env, HOME, USERPROFILE: HOME, GIT_CONFIG_GLOBAL: GITCONFIG};

/**
 * Makes a temp parent folder for tools.
 * @param {boolean=} git Whether the parent is itself a git repo.
 * @return {string} Its path.
 */
function parentFolder(git = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'techne-'));
  if (git) {
    spawnSync('git', ['init', '-q'], {cwd: root, env: ENV});
    fs.writeFileSync(path.join(root, '.gitignore'), '');
  }
  return root;
}

/**
 * Scaffolds a tool with new-tool.mjs.
 * @param {string} root Parent folder.
 * @param {!Array<string>} extra More flags.
 * @return {{status: number, out: string, dir: string}} Result.
 */
function scaffold(root, extra) {
  const r = spawnSync(process.execPath, [NEW_TOOL, '--root', root, ...extra], {encoding: 'utf8', env: ENV});
  const name = extra[extra.indexOf('--name') + 1];
  return {status: r.status, out: r.stdout + r.stderr, dir: path.join(root, name)};
}

/**
 * Runs a script inside a tool.
 * @param {string} dir The tool.
 * @param {string} script Path relative to it.
 * @return {{status: number, out: string}} Result.
 */
function runIn(dir, script) {
  const r = spawnSync(process.execPath, [script], {cwd: dir, encoding: 'utf8', env: ENV});
  return {status: r.status, out: r.stdout + r.stderr};
}

const hasFail = (r, re) => r.fails.some((f) => re.test(f));

test('a static page tool meets the standard and passes its own check, outside any repo', () => {
  const root = parentFolder(false);
  const t = scaffold(root, ['--name', 'reading-list', '--profile', 'page', '--purpose', 'Tracks books I want to read.']);
  assert.equal(t.status, 0, t.out);
  const r = checkTool(t.dir);
  assert.deepEqual(r.fails, []);
  assert.deepEqual(r.warns, []);
  assert.equal(r.manifest.stack, 'static');
  assert.equal(r.manifest.port, null);
  assert.ok(fs.existsSync(path.join(t.dir, 'index.html')));
  assert.ok(!fs.existsSync(path.join(t.dir, 'package.json')), 'a static tool has no package.json');
  assert.ok(!fs.existsSync(path.join(root, '.gitignore')), 'no parent .gitignore when the parent is not a repo');
  assert.match(fs.readFileSync(path.join(t.dir, 'AGENTS.md'), 'utf8'), /Tracks books I want to read\./);
  assert.match(fs.readFileSync(path.join(t.dir, 'CLAUDE.md'), 'utf8'), /^@AGENTS\.md$/m);
  const check = runIn(t.dir, 'scripts/check.mjs');
  assert.equal(check.status, 0, check.out);
  assert.match(check.out, /Everything passed/);
  const log = spawnSync('git', ['log', '--oneline'], {cwd: t.dir, encoding: 'utf8'});
  assert.match(log.stdout, /Start Reading List from tool-techne/);
});

test('a node panel tool meets the standard and passes its own check, inside a parent repo', () => {
  const root = parentFolder(true);
  const t = scaffold(root, ['--name', 'demo-panel', '--profile', 'panel', '--prefix', 'dp', '--node', '18']);
  assert.equal(t.status, 0, t.out);
  const r = checkTool(t.dir);
  assert.deepEqual(r.fails, []);
  assert.equal(r.manifest.stack, 'node');
  assert.equal(r.manifest.port, 4870);
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^demo-panel\/$/m);
  assert.ok(fs.existsSync(path.join(t.dir, '.claude', 'commands', 'dp-panel.md')), 'command installed in the tool');
  const check = spawnSync('npm run check', {cwd: t.dir, encoding: 'utf8', env: ENV, shell: true});
  assert.equal(check.status, 0, check.stdout + check.stderr);
});

test('stacks: a profile the stack does not support is refused, by the scaffolder and the check', () => {
  const root = parentFolder();
  const bad = scaffold(root, ['--name', 'bad-mix', '--profile', 'panel', '--stack', 'static']);
  assert.equal(bad.status, 1);
  assert.match(bad.out, /static stack does not support the panel profile/);
  assert.ok(!fs.existsSync(bad.dir));

  const t = scaffold(root, ['--name', 'demo-cli', '--profile', 'cli', '--node', '18']);
  assert.equal(t.status, 0, t.out);
  const m = JSON.parse(fs.readFileSync(path.join(t.dir, 'tool.json'), 'utf8'));
  m.stack = 'static';
  fs.writeFileSync(path.join(t.dir, 'tool.json'), JSON.stringify(m));
  assert.ok(hasFail(checkTool(t.dir), /static stack does not support the cli profile/));
  m.stack = 'cobol';
  fs.writeFileSync(path.join(t.dir, 'tool.json'), JSON.stringify(m));
  assert.ok(hasFail(checkTool(t.dir), /stack must be one of/));
});

test('prefixes: a chosen one already in use is refused, a made-up one moves to a free one', () => {
  const root = parentFolder();
  assert.equal(scaffold(root, ['--name', 'first-one', '--profile', 'page', '--prefix', 'ab']).status, 0);
  const second = scaffold(root, ['--name', 'second-one', '--profile', 'page', '--prefix', 'ab']);
  assert.equal(second.status, 1);
  assert.match(second.out, /prefix "ab" is already used by first-one/);

  // A prefix the scaffolder made up is moved to a free one instead.
  const p1 = scaffold(root, ['--name', 'plant-tracker', '--profile', 'page']);
  const p2 = scaffold(root, ['--name', 'photo-tidy', '--profile', 'page']);
  assert.equal(p2.status, 0, p2.out);
  assert.equal(JSON.parse(fs.readFileSync(path.join(p1.dir, 'tool.json'), 'utf8')).commands.prefix, 'pt');
  assert.equal(JSON.parse(fs.readFileSync(path.join(p2.dir, 'tool.json'), 'utf8')).commands.prefix, 'pt2');
});

test('ports: the next tool takes the next free one, and a clash fails', () => {
  const root = parentFolder();
  scaffold(root, ['--name', 'tool-a', '--profile', 'panel', '--node', '18']);
  const b = scaffold(root, ['--name', 'tool-b', '--profile', 'panel', '--prefix', 'tb2', '--node', '18']);
  assert.equal(checkTool(b.dir).manifest.port, 4871, b.out);
  const m = JSON.parse(fs.readFileSync(path.join(b.dir, 'tool.json'), 'utf8'));
  m.port = 4870;
  fs.writeFileSync(path.join(b.dir, 'tool.json'), JSON.stringify(m));
  assert.ok(checkAll(root).some((r) => hasFail(r, /port 4870 is also claimed/)));
  assert.equal(nextPort([4870, 4871, 4873]), 4872);
});

test('each broken part is caught', () => {
  const root = parentFolder(true);
  const t = scaffold(root, ['--name', 'demo-cli', '--profile', 'cli', '--prefix', 'dc', '--node', '18']);
  assert.equal(t.status, 0, t.out);
  const cmdSrc = path.join(t.dir, 'commands', 'dc-run.md');
  fs.writeFileSync(cmdSrc, 'v1\n');

  // Installed copy drifts from its source.
  assert.ok(hasFail(checkTool(t.dir), /installed command\(s\) in .*differ/));
  assert.equal(runIn(t.dir, 'scripts/install.mjs').status, 0);
  assert.deepEqual(checkTool(t.dir).fails, []);

  // A command without the prefix.
  fs.writeFileSync(path.join(t.dir, 'commands', 'other.md'), 'x\n');
  assert.ok(hasFail(checkTool(t.dir), /does not start with "dc-"/));
  fs.rmSync(path.join(t.dir, 'commands', 'other.md'));

  // A doc the manifest names is gone.
  fs.renameSync(path.join(t.dir, 'AGENTS.md'), path.join(t.dir, 'A.md'));
  assert.ok(hasFail(checkTool(t.dir), /docs\.agents: AGENTS\.md does not exist/));
  fs.renameSync(path.join(t.dir, 'A.md'), path.join(t.dir, 'AGENTS.md'));

  // The register's Stop hook is removed.
  const sp = path.join(t.dir, '.claude', 'settings.json');
  const settings = fs.readFileSync(sp, 'utf8');
  const s = JSON.parse(settings);
  delete s.hooks.Stop;
  fs.writeFileSync(sp, JSON.stringify(s));
  assert.ok(hasFail(checkTool(t.dir), /no Stop hook running lint-register/));
  fs.writeFileSync(sp, settings);

  // A required kit module is dropped from the manifest.
  const mp = path.join(t.dir, 'tool.json');
  const manifest = fs.readFileSync(mp, 'utf8');
  const m = JSON.parse(manifest);
  m.kit = m.kit.filter((k) => k !== 'check-secrets');
  fs.writeFileSync(mp, JSON.stringify(m));
  assert.ok(hasFail(checkTool(t.dir), /every tool uses "check-secrets"/));
  fs.writeFileSync(mp, manifest);

  // The check command points at a file that is gone.
  fs.renameSync(path.join(t.dir, 'scripts', 'check.mjs'), path.join(t.dir, 'scripts', 'c.mjs'));
  assert.ok(hasFail(checkTool(t.dir), /scripts\/check\.mjs does not exist/));
  fs.renameSync(path.join(t.dir, 'scripts', 'c.mjs'), path.join(t.dir, 'scripts', 'check.mjs'));

  // Not ignored by the parent repo.
  fs.writeFileSync(path.join(root, '.gitignore'), '');
  assert.ok(hasFail(checkTool(t.dir), /parent folder's repo would track it/));

  // Not its own repo.
  fs.rmSync(path.join(t.dir, '.git'), {recursive: true, force: true});
  assert.ok(hasFail(checkTool(t.dir), /not its own git repo/));
});

test('warnings: long AGENTS.md, a missing AI pointer, vendored drift, shared without guard', () => {
  const root = parentFolder();
  const t = scaffold(root, ['--name', 'demo-shared', '--profile', 'cli', '--shared', '--node', '18']);
  assert.equal(t.status, 0, t.out);
  let r = checkTool(t.dir);
  assert.ok(r.warns.some((w) => /without the edit guard/.test(w)));
  assert.ok(fs.existsSync(path.join(t.dir, 'SECURITY.md')));

  fs.appendFileSync(path.join(t.dir, 'AGENTS.md'), 'x\n'.repeat(300));
  fs.writeFileSync(path.join(t.dir, 'CLAUDE.md'), 'Read the other file.\n');
  fs.rmSync(path.join(t.dir, 'GEMINI.md'));
  fs.writeFileSync(path.join(root, 'source.txt'), 'a\n');
  fs.writeFileSync(path.join(t.dir, 'copy.txt'), 'b\n');
  const m = JSON.parse(fs.readFileSync(path.join(t.dir, 'tool.json'), 'utf8'));
  m.vendored = [{path: 'copy.txt', from: '../source.txt'}];
  fs.writeFileSync(path.join(t.dir, 'tool.json'), JSON.stringify(m));
  r = checkTool(t.dir);
  assert.ok(r.warns.some((w) => /AGENTS\.md is \d+ lines/.test(w)));
  assert.ok(r.warns.some((w) => /CLAUDE\.md does not point at AGENTS\.md/.test(w)));
  assert.ok(r.warns.some((w) => /no GEMINI\.md/.test(w)));
  assert.ok(r.warns.some((w) => /vendored copy\.txt differs/.test(w)));

  m.vendored[0].forked = true;
  fs.writeFileSync(path.join(t.dir, 'tool.json'), JSON.stringify(m));
  assert.ok(!checkTool(t.dir).warns.some((w) => /vendored/.test(w)));
});

test('secrets: the scan fails on each kind of secret, and the whole check fails with it', () => {
  const root = parentFolder();
  const t = scaffold(root, ['--name', 'demo-keys', '--profile', 'page']);
  assert.equal(t.status, 0, t.out);
  const scan = () => runIn(t.dir, 'scripts/check-secrets.mjs');
  assert.equal(scan().status, 0, scan().out);

  // Built from parts so this test file does not itself look like a key.
  const awsKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
  const pemHead = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ');
  const cases = [
    {file: 'app.js', text: `const key = '${awsKey}';\n`, re: /app\.js:1: looks like an AWS access key/},
    {file: 'notes.md', text: `${pemHead}\nabc\n`, re: /notes\.md:1: looks like a private key/},
    {file: 'secrets/token.txt', text: 'x\n', re: /secrets\/token\.txt: secrets\/ is for credentials/},
  ];
  for (const c of cases) {
    const p = path.join(t.dir, c.file);
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, c.text);
    // secrets/ is gitignored, so force git to see it as a tracked file.
    if (c.file.startsWith('secrets/')) spawnSync('git', ['add', '-f', c.file], {cwd: t.dir});
    const r = scan();
    assert.equal(r.status, 1, `${c.file} should fail`);
    assert.match(r.out, c.re);
    spawnSync('git', ['rm', '-q', '--cached', '--ignore-unmatch', c.file], {cwd: t.dir});
    fs.rmSync(p);
  }

  // A committed .env fails; .env.example does not; an ignored .env is not scanned.
  fs.writeFileSync(path.join(t.dir, '.env'), 'PASSWORD=hunter2\n');
  assert.equal(scan().status, 0, 'an ignored .env is not in what git keeps');
  spawnSync('git', ['add', '-f', '.env'], {cwd: t.dir});
  assert.match(scan().out, /\.env: an \.env file holds settings and passwords/);
  spawnSync('git', ['rm', '-q', '--cached', '.env'], {cwd: t.dir});

  // A known false alarm can be allowed on its own line.
  fs.writeFileSync(path.join(t.dir, 'example.js'), `const sample = '${awsKey}'; // secret-scan: allow\n`);
  assert.equal(scan().status, 0);

  fs.writeFileSync(path.join(t.dir, 'leak.js'), `const k = '${awsKey}';\n`);
  const check = runIn(t.dir, 'scripts/check.mjs');
  assert.equal(check.status, 1);
  assert.match(check.out, /FAIL {2}No secrets in files git would keep/);
});

test('register: a wrong count fails the whole check', () => {
  const root = parentFolder();
  const t = scaffold(root, ['--name', 'demo-reg', '--profile', 'page']);
  const reg = path.join(t.dir, 'DEFECT-REGISTER.md');
  fs.writeFileSync(reg, fs.readFileSync(reg, 'utf8').replace('| Defects recorded | 0 |', '| Defects recorded | 2 |'));
  const check = runIn(t.dir, 'scripts/check.mjs');
  assert.equal(check.status, 1);
  assert.match(check.out, /"Defects recorded" says 2, 0/);
});

test('guard: scaffolded guard locks tool files and opens data/', () => {
  const root = parentFolder();
  const t = scaffold(root, ['--name', 'demo-guard', '--profile', 'cli', '--guard', '--prefix', 'dg', '--node', '18']);
  assert.equal(t.status, 0, t.out);
  assert.deepEqual(checkTool(t.dir).fails, []);
  const hook = path.join(t.dir, 'scripts', 'hooks', 'tool-guard.mjs');
  const call = (input) => spawnSync(process.execPath, [hook], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: {...process.env, CLAUDE_PROJECT_DIR: t.dir},
  }).stdout;
  const edit = (p) => call({hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: {file_path: path.join(t.dir, p)}});
  assert.match(edit('scripts/install.mjs'), /"deny"/);
  assert.equal(edit('data/rec/a.json'), '');
  call({hook_event_name: 'UserPromptSubmit', prompt: '/dg-tool fix it'});
  assert.equal(edit('scripts/install.mjs'), '');
  assert.match(call({hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: {command: 'rm .claude/tool-unlock.json'}}), /"deny"/);
});

test('kit: an edited copy fails the check, and sync repairs it', () => {
  const root = parentFolder();
  const t = scaffold(root, ['--name', 'demo-kit', '--profile', 'panel', '--prefix', 'dk', '--node', '18']);
  assert.equal(t.status, 0, t.out);
  const m = JSON.parse(fs.readFileSync(path.join(t.dir, 'tool.json'), 'utf8'));
  assert.deepEqual(m.kit, ['check', 'check-secrets', 'install', 'lint-register-table', 'setup-check', 'panel-core']);
  fs.appendFileSync(path.join(t.dir, 'gui', 'panel-core.mjs'), '\n// local edit\n');
  assert.ok(hasFail(checkTool(t.dir), /kit: gui\/panel-core\.mjs differs from the kit/));
  fs.rmSync(path.join(t.dir, 'scripts', 'check-secrets.mjs'));
  assert.ok(hasFail(checkTool(t.dir), /kit: scripts\/check-secrets\.mjs is missing/));
  m.kit.push('no-such-module');
  fs.writeFileSync(path.join(t.dir, 'tool.json'), JSON.stringify(m));
  assert.ok(hasFail(checkTool(t.dir), /no module named "no-such-module"/));
  m.kit.pop();
  fs.writeFileSync(path.join(t.dir, 'tool.json'), JSON.stringify(m));
  const sync = spawnSync(process.execPath, [path.join(HERE, 'scripts', 'kit.mjs'), 'sync', 'demo-kit', '--root', root], {encoding: 'utf8'});
  assert.equal(sync.status, 0, sync.stdout + sync.stderr);
  assert.ok(!checkTool(t.dir).fails.some((f) => /^kit:/.test(f)), JSON.stringify(checkTool(t.dir).fails));
});

test('tool-techne meets its own standard, with or without .git', () => {
  // A downloaded ZIP has no .git, and is still a working copy.
  const fails = checkTool(HERE).fails.filter((f) => !/not its own git repo/.test(f));
  assert.deepEqual(fails, []);
});

test('release ZIP: one tool-techne/ folder, and a tool made from the unzipped copy passes its check', {
  skip: !fs.existsSync(path.join(HERE, '.git')) && 'not a git repo, so there is no commit to archive',
}, () => {
  const tmp = parentFolder();
  const zip = path.join(tmp, 'tool-techne.zip');
  const a = spawnSync('git', ['archive', '--format=zip', '--prefix=tool-techne/', '-o', zip, 'HEAD'], {cwd: HERE, encoding: 'utf8'});
  assert.equal(a.status, 0, a.stderr);
  const names = extractZip(zip, tmp);
  assert.deepEqual(names.filter((n) => !n.startsWith('tool-techne/')), []);
  for (const f of ['START-HERE.md', 'AGENTS.md', 'LICENSE', 'scripts/new-tool.mjs', 'skeleton/core/tool.json']) {
    assert.ok(names.includes(`tool-techne/${f}`), `${f} is in the ZIP`);
  }
  const copy = path.join(tmp, 'tool-techne');
  const r = spawnSync(process.execPath, ['scripts/new-tool.mjs', '--name', 'from-zip', '--profile', 'page'], {cwd: copy, encoding: 'utf8', env: ENV});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(runIn(path.join(tmp, 'from-zip'), 'scripts/check.mjs').status, 0);
  const all = spawnSync(process.execPath, ['scripts/check-standard.mjs', '--all'], {cwd: copy, encoding: 'utf8'});
  assert.equal(all.status, 0, all.stdout);
  assert.match(all.stdout, /from-zip/);
  assert.doesNotMatch(all.stdout, /(OK|FAIL) {2}tool-techne\b/, '--all leaves tool-techne itself out');
});

/**
 * @return {boolean} Whether this computer has Python 3.
 */
function hasPython() {
  return [['python'], ['python3'], ['py', '-3']].some(([c, ...a]) => {
    const r = spawnSync(c, [...a, '--version'], {encoding: 'utf8'});
    return r.status === 0 && /^Python 3\./.test(`${r.stdout}${r.stderr}`.trim());
  });
}

test('a python tool meets the standard and passes its own check', {skip: !hasPython() && 'no Python 3 here'}, () => {
  const root = parentFolder();
  const t = scaffold(root, ['--name', 'receipt-sorter', '--profile', 'cli', '--stack', 'python',
    '--purpose', 'Sorts "receipts" into <folders> \\ by month']);
  assert.equal(t.status, 0, t.out);
  const r = checkTool(t.dir);
  assert.deepEqual(r.fails, []);
  assert.deepEqual(r.warns, []);
  assert.equal(r.manifest.purpose, 'Sorts \'receipts\' into folders  by month', 'quotes, brackets and backslashes made safe');
  assert.match(fs.readFileSync(path.join(t.dir, '.python-version'), 'utf8'), /^3\.\d+\n$/, 'version filled in');
  assert.ok(!fs.existsSync(path.join(t.dir, 'package.json')));
  assert.match(fs.readFileSync(path.join(t.dir, '.gitignore'), 'utf8'), /^__pycache__\/$/m, '.gitignore.append applied');
  const check = runIn(t.dir, 'scripts/check.mjs');
  assert.equal(check.status, 0, check.out);
  assert.match(check.out, /OK +Tests \(.*-m unittest/);

  // Missing requires-python fails.
  fs.writeFileSync(path.join(t.dir, 'pyproject.toml'), '[project]\nname = "x"\n');
  assert.ok(hasFail(checkTool(t.dir), /requires-python is not set/));
});

test('pre-commit hook: a commit with a secret is stopped, with any AI or none', () => {
  const root = parentFolder();
  const t = scaffold(root, ['--name', 'demo-hook', '--profile', 'page']);
  assert.equal(t.status, 0, t.out);
  const git = (...a) => spawnSync('git', a, {cwd: t.dir, encoding: 'utf8', env: ENV});
  assert.equal(git('config', '--get', 'core.hooksPath').stdout.trim(), '.githooks');

  const awsKey = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
  fs.writeFileSync(path.join(t.dir, 'leak.js'), `const k = '${awsKey}';\n`);
  git('add', 'leak.js');
  const blocked = git('commit', '-m', 'add leak');
  assert.notEqual(blocked.status, 0, 'the commit went through');
  assert.match(blocked.stdout + blocked.stderr, /Commit stopped: a check failed/);

  fs.writeFileSync(path.join(t.dir, 'leak.js'), 'const k = process.env.KEY;\n');
  git('add', 'leak.js');
  const clean = git('commit', '-m', 'read the key from the environment');
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);

  // Turned off, the standard check says so.
  git('config', '--unset', 'core.hooksPath');
  assert.ok(checkTool(t.dir).warns.some((w) => /pre-commit hook is not turned on/.test(w)));
});

test('a tools folder inside OneDrive gets a warning', () => {
  const root = path.join(parentFolder(), 'OneDrive - Example', 'tools');
  fs.mkdirSync(root, {recursive: true});
  const t = scaffold(root, ['--name', 'synced-tool', '--profile', 'page']);
  assert.equal(t.status, 0, t.out);
  assert.match(t.out, /WARN {2}this folder is inside OneDrive/);
});

test('panel-core: refuses other hosts and origins, runs one job', async () => {
  const root = parentFolder();
  const t = scaffold(root, ['--name', 'demo-live', '--profile', 'panel', '--prefix', 'dl', '--node', '18']);
  assert.equal(t.status, 0, t.out);
  fs.mkdirSync(path.join(t.dir, 'data', 'acme'), {recursive: true});
  // A job that would run for a minute, to prove one-at-a-time and Stop.
  const serverFile = path.join(t.dir, 'gui', 'server.mjs');
  fs.writeFileSync(serverFile, fs.readFileSync(serverFile, 'utf8')
    .replace('const ACTIONS = {\n', 'const ACTIONS = {\n  wait: () => [\'-e\', \'setTimeout(() => {}, 60000)\'],\n'));
  const port = 4990 + Math.floor(Math.random() * 9);
  const {spawn} = await import('node:child_process');
  const http = await import('node:http');
  const server = spawn(process.execPath, ['gui/server.mjs'], {cwd: t.dir, env: {...process.env, DL_PORT: String(port)}});
  await new Promise((r) => server.stdout.once('data', r));
  const req = (method, p, headers = {}, body = '') => new Promise((resolve) => {
    const r = http.request({host: '127.0.0.1', port, method, path: p, headers}, (res) => {
      let s = '';
      res.on('data', (d) => (s += d));
      res.on('end', () => resolve({status: res.statusCode, body: s}));
    });
    r.end(body);
  });
  try {
    assert.equal((await req('GET', '/api/state', {Host: 'evil.example'})).status, 403);
    assert.equal((await req('POST', '/api/run', {Origin: 'http://evil.example'}, '{}')).status, 403);
    assert.equal((await req('POST', '/api/run', {}, JSON.stringify({action: 'status', record: '../x'}))).status, 400);
    const ok = await req('POST', '/api/run', {}, JSON.stringify({action: 'status', record: 'acme'}));
    assert.match(ok.body, /acme: 0 file\(s\)[\s\S]*\[exit 0/);

    const started = Date.now();
    const waiting = req('POST', '/api/run', {}, JSON.stringify({action: 'wait'}));
    await new Promise((r) => setTimeout(r, 500));
    assert.equal((await req('POST', '/api/run', {}, JSON.stringify({action: 'status'}))).status, 409, 'one job at a time');
    assert.equal(JSON.parse((await req('POST', '/api/stop')).body).stopped, true);
    // Windows taskkill /F ends it with code 1; elsewhere SIGTERM ends it with no code.
    assert.match((await waiting).body, /\[exit (stopped|1),/);
    assert.ok(Date.now() - started < 15_000, 'Stop ended the job, not its own timer');
  } finally {
    await req('POST', '/api/shutdown');
    server.kill();
  }
});
