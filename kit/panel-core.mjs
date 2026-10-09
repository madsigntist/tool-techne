/**
 * The safety-critical half of a control panel, shared by every panel tool.
 *
 * TOOL-KIT MODULE "panel-core". The source is tool-techne/kit/. Never edit
 * a tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails
 * a tool whose copy differs from the source.
 *
 * What lives here is what must be identical in every panel, because a bug
 * in it is a security bug in all of them:
 *   - localOnly(): refuses any Host that is not localhost (DNS rebinding)
 *     and any cross-origin POST, so a web page elsewhere cannot drive it.
 *   - readBody(): a size-capped JSON body.
 *   - createJobs(): one job at a time, spawned as `node <argv>` with no
 *     shell, output streamed back, Stop ending the whole process tree.
 *   - detach(): `--detach` relaunches the panel as its own process.
 *
 * What stays in each tool's gui/server.mjs: its ACTIONS table, input
 * validation, LIVE set, routes and anything it does when a job ends.
 */
import fs from 'node:fs';
import {spawn} from 'node:child_process';

/**
 * With `--detach`, relaunches this script as its own background process,
 * its output written to logFile, and reports that the caller should exit.
 *
 * Why: Claude Code kills a background command at its time limit (30
 * minutes by default, 2 hours at most, from v2.1.285). A panel started that
 * way died mid-job, and restarting it opened a second browser tab. A
 * detached panel outlives the command that launched it and runs until Shut
 * down. Node's own detach, so it behaves the same on Windows and macOS.
 * @param {string} logFile Where the panel's output goes, replaced per start.
 * @return {boolean} True in the launcher, which must exit. False in the
 *     panel itself, and whenever `--detach` was not passed.
 */
export function detach(logFile) {
  if (!process.argv.includes('--detach')) return false;
  const args = process.argv.slice(1).filter((a) => a !== '--detach');
  const fd = fs.openSync(logFile, 'w');
  const child = spawn(process.execPath, [...process.execArgv, ...args], {
    cwd: process.cwd(),
    env: {...process.env, PANEL_DETACHED: '1'},
    detached: true,
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(fd);
  console.log(`Panel started on its own (pid ${child.pid}). Output: ${logFile}`);
  return true;
}

/**
 * @param {!http.ServerResponse} res Response.
 * @param {number} code Status.
 * @param {!Object} obj JSON body.
 * @return {void}
 */
export function send(res, code, obj) {
  res.writeHead(code, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(obj));
}

/**
 * Refuses a request from anywhere but this machine. Call first in the
 * request handler; when it returns false the response is already sent.
 * @param {!http.IncomingMessage} req Request.
 * @param {!http.ServerResponse} res Response.
 * @return {boolean} Whether the request may go on.
 */
export function localOnly(req, res) {
  // A page on another site that resolves its own hostname to 127.0.0.1
  // still sends its own Host header, and is refused here.
  const host = (req.headers.host || '').split(':')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') {
    send(res, 403, {error: 'localhost only'});
    return false;
  }
  if (req.method === 'POST') {
    const origin = req.headers.origin || '';
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      send(res, 403, {error: 'cross-origin request refused'});
      return false;
    }
  }
  return true;
}

/**
 * Reads a JSON request body.
 * @param {!http.IncomingMessage} req Request.
 * @param {number=} limit Largest body accepted, in characters.
 * @return {!Promise<!Object>} Parsed body.
 */
export function readBody(req, limit = 1e5) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (d) => {
      s += d;
      if (s.length > limit) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try {
        resolve(s ? JSON.parse(s) : {});
      } catch {
        reject(new Error('body is not JSON'));
      }
    });
  });
}

/**
 * One job at a time, run as `node <argv>` from root.
 * @param {string} root The tool folder, the job's working directory.
 * @return {{
 *   running: function(): ?string,
 *   start: function(!http.ServerResponse, string, !Array<string>,
 *       function(?number)=): boolean,
 *   stop: function(): boolean,
 * }} The job controls.
 */
export function createJobs(root) {
  let job = null;

  /**
   * Ends the running job and every process it started. On Windows killing
   * the script leaves its children running, so taskkill /T ends the tree.
   * Fixed arguments, a numeric pid, no shell.
   * @return {boolean} Whether there was a job to stop.
   */
  function stop() {
    if (!job) return false;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(job.child.pid), '/T', '/F'], {stdio: 'ignore'});
    } else {
      try {
        process.kill(-job.child.pid, 'SIGTERM');
      } catch {
        job.child.kill('SIGTERM');
      }
    }
    return true;
  }

  /**
   * Starts a job, streaming its output into the response. Answers 409 when
   * one is already running.
   * @param {!http.ServerResponse} res Response to stream into.
   * @param {string} label Shown while it runs.
   * @param {!Array<string>} argv Script and arguments, validated already.
   * @param {function(?number)=} onClose Called with the exit code, or null
   *     when it was stopped, before the response ends.
   * @return {boolean} Whether it started.
   */
  function start(res, label, argv, onClose) {
    if (job) {
      send(res, 409, {error: `already running: ${job.label}. Wait, or press Stop.`});
      return false;
    }
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache'});
    res.write(`$ node ${argv.join(' ')}\n\n`);
    // Its own process group off Windows, so Stop can end everything it starts.
    const child = spawn(process.execPath, argv, {
      cwd: root,
      env: {...process.env, FORCE_COLOR: '0'},
      detached: process.platform !== 'win32',
    });
    job = {label, child, started: Date.now()};
    const out = (d) => res.write(d.toString().replace(/\x1b\[[0-9;]*m/g, ''));
    child.stdout.on('data', out);
    child.stderr.on('data', out);
    child.on('close', (code) => {
      const secs = Math.round((Date.now() - job.started) / 1000);
      job = null;
      if (onClose) {
        try {
          onClose(code);
        } catch {
          /* a follow-up must never leave the response open */
        }
      }
      res.end(`\n[exit ${code === null ? 'stopped' : code}, ${secs}s]\n`);
    });
    return true;
  }

  return {running: () => (job ? job.label : null), start, stop};
}
