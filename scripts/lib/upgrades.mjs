/**
 * The steps that move a tool from one standard version to the next.
 *
 * Each step is idempotent: run twice, it changes nothing the second time.
 * Each returns the list of what it changed, in plain words. upgrade.mjs
 * runs every step above a tool's tool.json "standard"; migrate.mjs runs
 * them all after moving a tool over, so it lands on the current standard.
 *
 * Adding a standard version: raise STANDARD in standard.mjs, add a step
 * here with `to` set to it, and say in TOOL-STANDARD.md what it adds.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {KIT, KIT_DIR, KIT_REQUIRED} from './standard.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKELETON = path.join(HERE, 'skeleton', 'core');

/**
 * @param {string} dir A tool folder.
 * @param {string} rel A path inside it.
 * @param {string} line A line the file must contain.
 * @return {boolean} Whether it was added.
 */
function ensureLine(dir, rel, line) {
  const file = path.join(dir, rel);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (text.split(/\r?\n/).includes(line)) return false;
  fs.writeFileSync(file, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`);
  return true;
}

/**
 * Writes a file only if it is missing.
 * @param {string} dir A tool folder.
 * @param {string} rel A path inside it.
 * @param {string} text Its content.
 * @return {boolean} Whether it was written.
 */
function ensureFile(dir, rel, text) {
  const file = path.join(dir, rel);
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text);
  return true;
}

export const UPGRADES = [
  {
    to: 2,
    title: 'pre-commit hook, AI pointer files, release script, feature guide, kit refresh',
    /**
     * @param {string} dir A tool folder.
     * @param {!Object} m Its tool.json, changed in place.
     * @return {!Array<string>} What changed.
     */
    apply(dir, m) {
      const done = [];
      const title = m.title || m.name;

      // Kit: the required modules and the release script, then fresh copies.
      const kit = Array.isArray(m.kit) ? [...m.kit] : [];
      for (const k of [...KIT_REQUIRED, 'release']) if (!kit.includes(k)) kit.push(k);
      if (kit.length !== (m.kit || []).length) done.push(`kit now lists: ${kit.join(', ')}`);
      m.kit = kit;
      for (const k of kit.filter((x) => KIT[x])) {
        const to = path.join(dir, KIT[k]);
        const src = path.join(KIT_DIR, `${k}.mjs`);
        const same = fs.existsSync(to) && fs.readFileSync(to, 'utf8').replace(/\r\n/g, '\n') === fs.readFileSync(src, 'utf8');
        if (!same) {
          fs.mkdirSync(path.dirname(to), {recursive: true});
          fs.copyFileSync(src, to);
          done.push(`kit copy refreshed: ${KIT[k]}`);
        }
      }

      // The pre-commit hook, which runs with any AI or none.
      const hook = path.join(dir, '.githooks', 'pre-commit');
      if (!fs.existsSync(hook) || !fs.readFileSync(hook, 'utf8').includes('check.mjs')) {
        fs.mkdirSync(path.dirname(hook), {recursive: true});
        fs.copyFileSync(path.join(SKELETON, '.githooks', 'pre-commit'), hook);
        done.push('added .githooks/pre-commit');
      }
      fs.chmodSync(hook, 0o755);

      // Every AI assistant finds AGENTS.md.
      if (fs.existsSync(path.join(dir, 'AGENTS.md'))) {
        if (ensureFile(dir, 'GEMINI.md',
          `# ${title}\n\nRead AGENTS.md in this folder and follow it. It holds every instruction for\nworking on this tool.\n\n@AGENTS.md\n`)) {
          done.push('added GEMINI.md');
        }
        if (ensureFile(dir, path.join('.github', 'copilot-instructions.md'),
          `# ${title}\n\nRead AGENTS.md at the root of this folder and follow it. It holds every\ninstruction for working on this tool.\n`)) {
          done.push('added .github/copilot-instructions.md');
        }
      }

      // Claude Code hooks: register lint on Stop, setup check on SessionStart.
      const sp = path.join(dir, '.claude', 'settings.json');
      const settings = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, 'utf8')) : {};
      const skel = JSON.parse(fs.readFileSync(path.join(SKELETON, '.claude', 'settings.json'), 'utf8'));
      settings.hooks = settings.hooks || {};
      let hooksChanged = false;
      if (!JSON.stringify(settings.hooks.Stop || []).includes('lint-register')) {
        settings.hooks.Stop = [...(settings.hooks.Stop || []), ...skel.hooks.Stop];
        hooksChanged = true;
      }
      if (!JSON.stringify(settings.hooks.SessionStart || []).match(/setup-check|install\.mjs/)) {
        settings.hooks.SessionStart = [...(settings.hooks.SessionStart || []), ...skel.hooks.SessionStart];
        hooksChanged = true;
      }
      if (hooksChanged) {
        fs.mkdirSync(path.dirname(sp), {recursive: true});
        fs.writeFileSync(sp, `${JSON.stringify(settings, null, 2)}\n`);
        done.push('Claude Code register and setup hooks added');
      }

      // The workflow any AI follows to add a feature, in plain Markdown.
      const guide = path.join('guides', 'build-a-feature.md');
      if (ensureFile(dir, guide, fs.readFileSync(path.join(SKELETON, guide), 'utf8'))) done.push(`added ${guide}`);

      // Release ZIPs are built into dist/, which git must not keep.
      if (ensureLine(dir, '.gitignore', 'dist/')) done.push('.gitignore: dist/');

      return done;
    },
  },
];

/**
 * Runs every step above the tool's standard, updating tool.json in place.
 * @param {string} dir A tool folder.
 * @param {!Object} m Its parsed tool.json, changed in place.
 * @return {!Array<{to: number, title: string, done: !Array<string>}>} What
 *     each step changed.
 */
export function applyUpgrades(dir, m) {
  const ran = [];
  for (const step of UPGRADES) {
    if ((m.standard || 1) >= step.to) continue;
    const done = step.apply(dir, m);
    m.standard = step.to;
    ran.push({to: step.to, title: step.title, done});
  }
  return ran;
}
