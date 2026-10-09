/**
 * The checkable parts of TOOL-STANDARD.md, as functions.
 *
 * Each finding is a FAIL (the tool does not meet the standard, or something
 * has drifted that will bite) or a WARN (judgment the person should see).
 * Nothing here changes a file.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const STANDARD = 1;
export const INSTALL_SCOPES = ['tool', 'parent', 'user', 'none'];
export const PANEL_PORT_START = 4870;
export const APP_PORT_START = 4900;
export const AGENTS_MD_MAX_LINES = 250;

/**
 * How a tool is used. Plain-language labels are what START-HERE.md asks.
 */
export const PROFILES = {
  page: 'a page you open in your browser',
  panel: 'a dashboard with buttons that runs tasks on your computer',
  cli: 'commands you type',
  app: 'a service that runs all the time',
};

/**
 * What a tool is written in. Each stack lists the profiles it supports,
 * the first being its default, and the test command its tools start with.
 * A new stack is a folder in stacks/ plus an entry here.
 */
export const STACKS = {
  static: {profiles: ['page'], test: 'node --test', label: 'HTML, CSS and JavaScript, nothing to install'},
  node: {profiles: ['cli', 'panel', 'app'], test: 'node --test', label: 'Node.js'},
};

/**
 * @param {string} profile A profile.
 * @return {string|undefined} The first stack that supports it.
 */
export function defaultStack(profile) {
  return Object.keys(STACKS).find((s) => STACKS[s].profiles.includes(profile));
}

/** Where the shared kit lives, and where each module lands in a tool. */
export const KIT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'kit');
export const KIT = {
  'check': 'scripts/check.mjs',
  'check-secrets': 'scripts/check-secrets.mjs',
  'install': 'scripts/install.mjs',
  'lint-register-table': 'scripts/lint-register.mjs',
  'setup-check': 'scripts/hooks/setup-check.mjs',
  'tool-guard': 'scripts/hooks/tool-guard.mjs',
  'panel-core': 'gui/panel-core.mjs',
};
/** Every tool carries these. */
export const KIT_REQUIRED = ['check', 'check-secrets', 'install', 'lint-register-table'];

/** Files that point other AI assistants at AGENTS.md. */
export const AI_POINTERS = ['CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md'];

/**
 * Compares a tool's kit copies with the kit.
 * @param {string} dir A tool folder.
 * @param {!Array<string>} modules The kit modules its tool.json lists.
 * @return {!Array<{module: string, dest: string, state: string}>} One entry
 *     per module: 'same', 'differs', 'missing' or 'unknown'.
 */
export function kitState(dir, modules) {
  return modules.map((module) => {
    const dest = KIT[module];
    if (!dest) return {module, dest: '', state: 'unknown'};
    const mine = path.join(dir, dest);
    if (!fs.existsSync(mine)) return {module, dest, state: 'missing'};
    const same = readText(mine) === readText(path.join(KIT_DIR, `${module}.mjs`));
    return {module, dest, state: same ? 'same' : 'differs'};
  });
}

/**
 * @param {string} file Path.
 * @return {string} Its text with line endings normalized, or '' if absent.
 */
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
}

/**
 * @param {string} dir A tool folder.
 * @return {?Object} Its parsed tool.json, or null when there is none.
 * @throws {Error} When tool.json exists but is not valid JSON.
 */
export function readManifest(dir) {
  const file = path.join(dir, 'tool.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new Error(`tool.json is not valid JSON: ${e.message}`);
  }
}

/**
 * Every immediate subfolder of root that has a tool.json.
 * @param {string} root The folder that holds the tools.
 * @return {!Array<string>} Absolute tool folders, sorted.
 */
export function discover(root) {
  return fs
    .readdirSync(root, {withFileTypes: true})
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, d.name, 'tool.json')))
    .map((d) => path.join(root, d.name))
    .sort();
}

/**
 * @param {!Array<number>} used Ports already taken.
 * @param {number=} start First port to try.
 * @return {number} The lowest free port from start up.
 */
export function nextPort(used, start = PANEL_PORT_START) {
  let p = start;
  while (used.includes(p)) p += 1;
  return p;
}

/**
 * @param {string} dir A tool folder.
 * @return {!Object} The hooks in its .claude/settings.json, keyed by event.
 */
function hooksOf(dir) {
  try {
    return JSON.parse(readText(path.join(dir, '.claude', 'settings.json'))).hooks || {};
  } catch {
    return {};
  }
}

/**
 * Checks one tool against the standard.
 * @param {string} dir The tool folder.
 * @param {{ports: !Map<number, string>}=} ctx Ports claimed by other tools,
 *     for the uniqueness check across the parent folder.
 * @return {{dir: string, name: string, fails: !Array<string>,
 *     warns: !Array<string>, manifest: ?Object}} The findings.
 */
export function checkTool(dir, ctx = {ports: new Map()}) {
  const fails = [];
  const warns = [];
  const folder = path.basename(dir);
  let m;
  try {
    m = readManifest(dir);
  } catch (e) {
    return {dir, name: folder, fails: [e.message], warns, manifest: null};
  }
  if (!m) return {dir, name: folder, fails: ['no tool.json'], warns, manifest: null};
  const name = m.name || folder;
  const at = (p) => path.join(dir, String(p).split('#')[0]);

  // Manifest shape.
  for (const k of ['name', 'title', 'purpose', 'profile', 'stack', 'docs', 'check']) {
    if (m[k] === undefined || m[k] === '') fails.push(`tool.json: "${k}" is missing`);
  }
  if (typeof m.standard !== 'number') fails.push('tool.json: "standard" must be a number');
  else if (m.standard < STANDARD) warns.push(`meets standard ${m.standard}; the current one is ${STANDARD}`);
  if (m.name && m.name !== folder) warns.push(`tool.json name "${m.name}" differs from the folder "${folder}"`);
  if (m.profile && !PROFILES[m.profile]) fails.push(`tool.json: profile must be one of ${Object.keys(PROFILES).join(', ')}`);
  if (m.stack && !STACKS[m.stack]) {
    fails.push(`tool.json: stack must be one of ${Object.keys(STACKS).join(', ')}`);
  } else if (m.stack && PROFILES[m.profile] && !STACKS[m.stack].profiles.includes(m.profile)) {
    fails.push(`tool.json: the ${m.stack} stack does not support the ${m.profile} profile (it supports ${STACKS[m.stack].profiles.join(', ')})`);
  }

  // Own repo, and a parent repo does not track it.
  if (!fs.existsSync(path.join(dir, '.git'))) fails.push('not its own git repo (no .git)');
  const parent = path.dirname(dir);
  if (fs.existsSync(path.join(parent, '.git'))) {
    const r = spawnSync('git', ['-C', parent, 'check-ignore', '-q', `${folder}/`], {encoding: 'utf8'});
    if (r.status === 1) fails.push(`the parent folder's repo would track it: add "${folder}/" to ${path.join(parent, '.gitignore')}`);
  }

  // Docs.
  const docs = m.docs || {};
  for (const [key, rel] of Object.entries(docs)) {
    if (rel && !fs.existsSync(at(rel))) fails.push(`docs.${key}: ${rel} does not exist`);
  }
  for (const key of ['readme', 'runbook', 'architecture', 'roadmap', 'agents', 'register']) {
    if (!docs[key]) fails.push(`docs.${key} is not set`);
  }
  if (m.shared && !docs.security) fails.push('shared tool: docs.security (SECURITY.md) is required');
  if (docs.agents) {
    const lines = readText(at(docs.agents)).split('\n').length;
    if (lines > AGENTS_MD_MAX_LINES) {
      warns.push(`${docs.agents} is ${lines} lines (over ${AGENTS_MD_MAX_LINES}): it loads every session, move detail to ARCHITECTURE`);
    }
  }
  if (docs.roadmap && !/^#+ .*decision/im.test(readText(at(docs.roadmap)))) {
    warns.push(`${docs.roadmap} has no "Decisions" heading`);
  }

  // Every AI assistant finds AGENTS.md.
  for (const p of AI_POINTERS) {
    const text = readText(path.join(dir, p));
    if (!text) warns.push(`no ${p}: that AI assistant will not find AGENTS.md on its own`);
    else if (!text.includes('AGENTS.md')) warns.push(`${p} does not point at AGENTS.md`);
  }
  if (!readText(path.join(dir, 'CLAUDE.md')).match(/^@AGENTS\.md\s*$/m)) {
    warns.push('CLAUDE.md does not import AGENTS.md with an "@AGENTS.md" line');
  }

  // Register and its gate.
  const hooks = hooksOf(dir);
  if (docs.register && !JSON.stringify(hooks.Stop || []).includes('lint-register')) {
    fails.push('no Stop hook running lint-register in .claude/settings.json');
  }

  // The check command exists.
  const pkg = (() => {
    try {
      return JSON.parse(readText(path.join(dir, 'package.json')));
    } catch {
      return null;
    }
  })();
  const check = String(m.check || '').trim();
  const npmRun = /^npm run (\S+)$/.exec(check);
  const nodeRun = /^node (\S+\.m?js)\b/.exec(check);
  if (npmRun && !(pkg && pkg.scripts && pkg.scripts[npmRun[1]])) {
    fails.push(`check is "${m.check}" but package.json has no "${npmRun[1]}" script`);
  }
  if (nodeRun && !fs.existsSync(path.join(dir, nodeRun[1]))) {
    fails.push(`check is "${m.check}" but ${nodeRun[1]} does not exist`);
  }

  // Runtime pinned, per stack.
  if (m.stack === 'node') {
    if (!(pkg && pkg.engines && pkg.engines.node)) fails.push('package.json: engines.node is not set');
    if (!fs.existsSync(path.join(dir, '.nvmrc'))) warns.push('no .nvmrc');
  }
  if (!JSON.stringify(hooks.SessionStart || []).match(/setup-check|install\.mjs/)) {
    warns.push('no SessionStart setup check: a cold copy will not say what is missing');
  }

  // Port.
  if (m.port !== null && m.port !== undefined) {
    if (!Number.isInteger(m.port)) fails.push('tool.json: port must be a whole number or null');
    else if (ctx.ports.has(m.port) && ctx.ports.get(m.port) !== name) {
      fails.push(`port ${m.port} is also claimed by ${ctx.ports.get(m.port)}`);
    }
  } else if (m.profile === 'panel' || m.profile === 'app') {
    fails.push(`${m.profile} profile needs a port`);
  }

  // Commands: prefix, and installed copies that match their source.
  const cmd = m.commands;
  if (cmd && cmd.prefix) {
    const src = path.join(dir, 'commands');
    if (!fs.existsSync(src)) {
      fails.push('commands.prefix is set but there is no commands/ folder');
    } else {
      const files = fs.readdirSync(src).filter((f) => f.endsWith('.md'));
      for (const f of files) {
        if (!f.startsWith(`${cmd.prefix}-`)) fails.push(`commands/${f} does not start with "${cmd.prefix}-"`);
      }
      if (cmd.install && !INSTALL_SCOPES.includes(cmd.install)) {
        fails.push(`commands.install must be one of ${INSTALL_SCOPES.join(', ')}`);
      }
      const dests = [];
      if (['tool', 'parent'].includes(cmd.install)) dests.push(path.join(dir, '.claude', 'commands'));
      if (cmd.install === 'parent') dests.push(path.join(parent, '.claude', 'commands'));
      for (const d of dests) {
        const stale = files.filter((f) => readText(path.join(d, f)) !== readText(path.join(src, f)));
        if (stale.length) {
          fails.push(
            `${stale.length} installed command(s) in ${path.relative(parent, d) || d} differ from commands/ ` +
              `(${stale.join(', ')}): run node scripts/install.mjs`,
          );
        }
      }
    }
  }

  // Vendored copies and outside reads.
  for (const v of m.vendored || []) {
    if (!v.path || !v.from) {
      fails.push('vendored entries need "path" and "from"');
      continue;
    }
    if (!fs.existsSync(at(v.path))) {
      fails.push(`vendored ${v.path} does not exist`);
      continue;
    }
    const from = path.resolve(dir, v.from);
    if (!fs.existsSync(from)) warns.push(`vendored ${v.path}: its source ${v.from} is gone`);
    else if (!v.forked && readText(from) !== readText(at(v.path))) {
      warns.push(`vendored ${v.path} differs from ${v.from}: resync it, or mark it "forked": true`);
    }
  }
  for (const r of m.reads || []) {
    if (!fs.existsSync(path.resolve(dir, r))) warns.push(`reads: ${r} does not exist`);
  }

  // Kit modules: the required ones are listed, each copy matches the kit,
  // and two may not share a path.
  if (m.kit !== undefined && !Array.isArray(m.kit)) fails.push('tool.json: "kit" must be a list of module names');
  const kit = Array.isArray(m.kit) ? m.kit : [];
  for (const k of KIT_REQUIRED) {
    if (!kit.includes(k)) fails.push(`kit: every tool uses "${k}", and tool.json does not list it`);
  }
  const dests = kit.map((k) => KIT[k]).filter(Boolean);
  if (new Set(dests).size !== dests.length) fails.push('tool.json: two kit modules write the same file');
  for (const k of kitState(dir, kit)) {
    if (k.state === 'unknown') fails.push(`kit: no module named "${k.module}" (known: ${Object.keys(KIT).join(', ')})`);
    else if (k.state !== 'same') {
      fails.push(`kit: ${k.dest} ${k.state === 'missing' ? 'is missing' : 'differs from the kit'}: run node tool-techne/scripts/kit.mjs sync ${path.basename(dir)}`);
    }
  }

  // Guard.
  if (m.guard) {
    if (!fs.existsSync(path.join(dir, 'scripts', 'hooks', 'tool-guard.mjs'))) fails.push('guard is set but scripts/hooks/tool-guard.mjs is missing');
    if (!JSON.stringify(hooks.PreToolUse || []).includes('tool-guard')) fails.push('guard is set but no PreToolUse hook runs tool-guard');
  } else if (m.shared) {
    warns.push('shared tool without the edit guard: one-off fixes can turn into tool changes');
  }

  return {dir, name, fails, warns, manifest: m};
}

/**
 * Checks every tool under root, including port clashes across tools.
 * @param {string} root The folder that holds the tools.
 * @return {!Array<!Object>} One result per tool, as checkTool returns.
 */
export function checkAll(root) {
  const dirs = discover(root);
  const ports = new Map();
  for (const d of dirs) {
    try {
      const m = readManifest(d);
      if (m && Number.isInteger(m.port) && !ports.has(m.port)) ports.set(m.port, m.name || path.basename(d));
    } catch {
      /* reported by checkTool */
    }
  }
  return dirs.map((d) => checkTool(d, {ports}));
}
