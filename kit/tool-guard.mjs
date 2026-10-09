/**
 * Keeps one-off fixes from turning into tool changes.
 *
 * TOOL-KIT MODULE "tool-guard". The source is tool-techne/kit/. Never edit
 * a tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails
 * a tool whose copy differs from the source.
 *
 * Why. When someone points out a problem in one record ("this heading is
 * the wrong color"), the fix belongs in that record's files. Claude also
 * tended to change the tool itself at the same time. Once the tool is in
 * several people's hands, those one-off edits make each copy drift.
 *
 * So tool files are locked. Two hook events, one script:
 *
 *   UserPromptSubmit  When the PERSON types /<prefix>-tool, write the unlock
 *                     marker .claude/tool-unlock.json, good for UNLOCK_HOURS.
 *                     Only a typed prompt creates it: Claude cannot unlock
 *                     itself.
 *   PreToolUse        Edit, Write and NotebookEdit on a tool file are denied
 *                     while there is no fresh marker. The folders in
 *                     tool.json guard.open are never locked. The marker can
 *                     never be written or removed by a tool call, and a
 *                     shell command that names it is denied.
 *
 * Fails open: a hook that cannot read its input allows the call rather than
 * blocking all work.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MARKER = path.join(ROOT, '.claude', 'tool-unlock.json');
const UNLOCK_HOURS = 4;

let manifest = {};
try {
  manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tool.json'), 'utf8'));
} catch {
  process.exit(0);
}
const PREFIX = manifest.commands?.prefix || 'tool';
const UNLOCK_CMD = `${PREFIX}-tool`;
const OPEN = (manifest.guard?.open || ['data']).map((p) => path.normalize(p));

/**
 * Resolves symlinks in a path that may not exist yet, through its nearest
 * existing parent. Without this, a tool reached through a symlink (on macOS
 * every temp folder: /var is really /private/var) looks like it is outside
 * itself, and the guard lets every edit through.
 * @param {string} p An absolute path.
 * @return {string} It, with symlinks resolved.
 */
function real(p) {
  let head = p;
  const tail = [];
  while (!fs.existsSync(head)) {
    const up = path.dirname(head);
    if (up === head) return p;
    tail.unshift(path.basename(head));
    head = up;
  }
  return path.join(fs.realpathSync.native(head), ...tail);
}

/**
 * @param {string} p A path from a tool call, absolute or project-relative.
 * @return {{inTool: boolean, rel: string}} Whether it is inside the tool
 *     folder, and its path relative to it.
 */
function locate(p) {
  const abs = real(path.resolve(process.env.CLAUDE_PROJECT_DIR || ROOT, p));
  const rel = path.relative(real(ROOT), abs);
  return {inTool: !rel.startsWith('..') && !path.isAbsolute(rel), rel};
}

/** @return {boolean} Whether a fresh unlock marker exists. */
function unlocked() {
  try {
    const {at} = JSON.parse(fs.readFileSync(MARKER, 'utf8'));
    return Date.now() - Date.parse(at) < UNLOCK_HOURS * 3600 * 1000;
  } catch {
    return false;
  }
}

/**
 * @param {string} reason Shown to Claude.
 * @return {void}
 */
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason},
  }));
}

const MARKER_MSG = `The tool-edit unlock marker is created only by the person typing /${UNLOCK_CMD}. Do not create, edit or remove it.`;

let input = {};
try {
  // Windows PowerShell adds a byte-order mark when it pipes text.
  input = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^﻿/, '') || '{}');
} catch {
  process.exit(0);
}

const event = input.hook_event_name || '';

if (event === 'UserPromptSubmit') {
  const prompt = String(input.prompt || '');
  const typed = new RegExp(`^\\s*/${UNLOCK_CMD}\\b`).test(prompt) ||
    new RegExp(`<command-name>/?${UNLOCK_CMD}</command-name>`).test(prompt);
  if (typed) {
    fs.mkdirSync(path.dirname(MARKER), {recursive: true});
    fs.writeFileSync(MARKER, `${JSON.stringify({at: new Date().toISOString(), prompt: prompt.slice(0, 200)}, null, 2)}\n`);
  }
  process.exit(0);
}

if (event === 'PreToolUse') {
  const name = input.tool_name || '';
  const ti = input.tool_input || {};
  if (name === 'Bash' || name === 'PowerShell') {
    if (/tool-unlock\.json/.test(String(ti.command || ''))) deny(MARKER_MSG);
    process.exit(0);
  }
  const target = ti.file_path || ti.notebook_path || '';
  if (!target) process.exit(0);
  const {inTool, rel} = locate(target);
  if (!inTool) process.exit(0);
  if (rel === path.join('.claude', 'tool-unlock.json')) {
    deny(MARKER_MSG);
    process.exit(0);
  }
  if (OPEN.some((o) => rel === o || rel.startsWith(`${o}${path.sep}`))) process.exit(0);
  if (unlocked()) process.exit(0);
  deny(
    `${rel.split(path.sep).join('/')} is part of the ${manifest.title || 'tool'} itself, which is locked. ` +
      `A problem in one record is fixed in that record's files only (${OPEN.join(', ')}), never in the tool. ` +
      `If the tool itself should change, say so and stop: the person decides, and types /${UNLOCK_CMD} to unlock it.`,
  );
  process.exit(0);
}

process.exit(0);
