/**
 * Control panel for {{TITLE}}: every script step on a button.
 *
 * Why this exists. Running a script through an AI assistant costs tokens for
 * nothing: it reads the command, runs it, and reads the output back. Here
 * the scripts run directly. Only the steps that need judgment go to
 * the AI, and for those the panel shows the exact command to paste.
 *
 * SAFETY
 *   - Listens on 127.0.0.1 only, and rejects any request whose Host is not
 *     localhost, so a web page elsewhere cannot drive it (DNS rebinding).
 *     Cross-origin POSTs are refused.
 *   - Runs a FIXED list of this tool's own scripts. Nothing from the browser
 *     reaches a shell: input is validated and passed as argv.
 *   - One job at a time.
 *   - Actions in LIVE touch something outside this machine and need the
 *     record's name typed back to confirm.
 *   - Files are served read-only from data/, never outside it.
 *
 * Usage:
 *   npm run gui            then open http://localhost:{{PORT}}
 *   node gui/server.mjs --detach
 *                          runs on its own until Shut down, output in
 *                          gui/panel.log. What /{{PREFIX}}-panel uses.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createJobs, detach, localOnly, readBody, send} from './panel-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const PORT = Number(process.env.{{PORT_ENV}}) || {{PORT}};

if (detach(path.join(ROOT, 'gui', 'panel.log'))) process.exit(0);
const RECORD_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * The actions the panel may run, each building an argv from validated
 * input. A value that fails validation throws, and nothing runs.
 */
const ACTIONS = {
  status: (a) => ['scripts/status.mjs', ...(a.record ? ['--record', record(a.record)] : [])],
};

/** Actions that change something live. The body must carry confirm === record. */
const LIVE = new Set([]);

/**
 * @param {*} v A record folder name, which must exist under data/.
 * @return {string} The name.
 */
function record(v) {
  if (typeof v !== 'string' || !RECORD_RE.test(v)) throw new Error('record: lowercase letters, digits and - only');
  if (!fs.existsSync(path.join(DATA, v))) throw new Error(`no such record: data/${v}`);
  return v;
}

const jobs = createJobs(ROOT);

/**
 * Runs an action, streaming its output into the HTTP response.
 * @param {string} action Key of ACTIONS.
 * @param {!Object} b Request body.
 * @param {!http.ServerResponse} res Response to stream into.
 * @return {void}
 */
function run(action, b, res) {
  const build = ACTIONS[action];
  if (!build) return send(res, 400, {error: `unknown action ${action}`});
  if (jobs.running()) return send(res, 409, {error: `already running: ${jobs.running()}. Wait, or press Stop.`});
  if (LIVE.has(action) && (!b.record || b.confirm !== b.record)) {
    return send(res, 400, {error: `${action} is live. Type the record name to confirm.`});
  }
  let argv;
  try {
    argv = build(b);
  } catch (e) {
    return send(res, 400, {error: e.message});
  }
  jobs.start(res, `${action}${b.record ? ` ${b.record}` : ''}`, argv);
}

/** @return {!Array<string>} Every record folder under data/. */
function records() {
  if (!fs.existsSync(DATA)) return [];
  return fs.readdirSync(DATA).filter((d) => RECORD_RE.test(d) && fs.statSync(path.join(DATA, d)).isDirectory());
}

const server = http.createServer(async (req, res) => {
  if (!localOnly(req, res)) return;
  const u = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      return fs.createReadStream(path.join(ROOT, 'gui', 'index.html')).pipe(res);
    }
    if (req.method === 'GET' && u.pathname === '/api/state') {
      return send(res, 200, {records: records(), actions: Object.keys(ACTIONS), live: [...LIVE], running: jobs.running()});
    }
    if (req.method === 'POST' && u.pathname === '/api/run') {
      const b = await readBody(req);
      return run(String(b.action || ''), b, res);
    }
    if (req.method === 'POST' && u.pathname === '/api/stop') {
      return send(res, 200, {stopped: jobs.stop()});
    }
    if (req.method === 'POST' && u.pathname === '/api/shutdown') {
      jobs.stop();
      send(res, 200, {shutdown: true});
      setTimeout(() => process.exit(0), 300);
      return;
    }
    return send(res, 404, {error: 'not found'});
  } catch (e) {
    return send(res, 400, {error: e.message});
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  {{TITLE}} control panel: http://localhost:${PORT}\n`);
  console.log('  Runs this tool\'s scripts directly. No AI tokens are used.');
  console.log(process.env.PANEL_DETACHED ? '  Shut down in the panel to stop.\n' : '  Ctrl+C to stop.\n');
});
