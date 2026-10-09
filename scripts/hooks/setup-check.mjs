/**
 * SessionStart: tells Claude when this copy of the tool is not set up yet.
 *
 * TOOL-KIT MODULE "setup-check". The source is tool-techne/kit/. Never edit
 * a tool's copy: edit the source, then run
 * `node tool-techne/scripts/kit.mjs sync --all`. The standard check fails
 * a tool whose copy differs from the source.
 *
 * Runs the tool's report-only setup check: tool.json "setupCheck" (an argv
 * run with node, from the tool folder), or scripts/install.mjs --check when
 * that is not set. On a set-up copy it says nothing. Lines of the form
 * "    - problem" in its output are quoted back.
 * When something is missing, it asks Claude to run the installer before
 * anything else, and shows the person one line.
 *
 * Never fails a session: any error here is silent.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

try {
  const {title, setupCheck, setupFix, setupHint} = JSON.parse(fs.readFileSync(path.join(ROOT, 'tool.json'), 'utf8'));
  const argv = Array.isArray(setupCheck) && setupCheck.length ? setupCheck : ['scripts/install.mjs', '--check'];
  const r = spawnSync(process.execPath, argv, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
  });
  if (r.status === 0) process.exit(0);
  const problems = (r.stdout || '')
    .split('\n')
    .filter((l) => /^\s+-\s/.test(l))
    .map((l) => l.trim().replace(/^-\s*/, ''));
  const list = problems.length ? problems.join('; ') : 'the setup check did not pass';
  process.stdout.write(JSON.stringify({
    systemMessage: `${title} is not set up yet (${list}). Claude will set it up first.`,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        `FIRST RUN: ${title} is not set up (${list}). Before anything else, tell the person in one ` +
        'line, run `' + (setupFix || 'node scripts/install.mjs') + '`, and report what it printed. If it lists something it ' +
        'cannot fix itself (Node.js not installed), say exactly what to install and stop.' +
        (setupHint ? ` ${setupHint}` : ''),
    },
  }));
} catch {
  /* a setup check must never block a session */
}
process.exit(0);
