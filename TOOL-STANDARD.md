# Tool standard

What every tool started from tool-techne is built to, and why. A tool is
anything that runs again: a page, a dashboard that drives scripts, a
long-running service, a set of commands. A one-off piece of work is not a
tool.

`scripts/check-standard.mjs` checks the parts of this that can be checked.
The rest is judgment, and this file says which is which.

Standard version: **2**. A tool's `tool.json` records the version it meets,
and `node tool-techne/scripts/upgrade.mjs <tool>` brings it up to date.

## Core: every tool

### 1. Its own repo, from the first commit

- `git init` and a first commit before any feature work. `new-tool.mjs`
  does it. **Checked.**
- If the folder that holds the tools is itself a git repo, its
  `.gitignore` lists the tool, so that repo never tracks it. **Checked.**
- Push to a remote when there is one. The standard does not require it.

### 2. `tool.json` at the root

The manifest every script and check reads. It costs less to read than any
document, and it is the one place a port, a command prefix or a document
path is written down.

```json
{
  "standard": 1,
  "name": "folder-name",
  "title": "Human name",
  "purpose": "One sentence: what it does and for whom.",
  "profile": "page | panel | cli | app",
  "stack": "static | node | python",
  "shared": false,
  "port": 4870,
  "portEnv": "XX_PORT",
  "commands": { "prefix": "xx", "install": "tool" },
  "docs": {
    "readme": "README.md",
    "runbook": "RUNBOOK.md",
    "architecture": "ARCHITECTURE.md",
    "roadmap": "ROADMAP.md",
    "agents": "AGENTS.md",
    "register": "DEFECT-REGISTER.md"
  },
  "check": "node scripts/check.mjs",
  "test": "node --test",
  "reads": [],
  "vendored": [],
  "kit": ["check", "check-secrets", "install", "lint-register-table", "setup-check"],
  "guard": null
}
```

| Field | Meaning |
| --- | --- |
| `profile`, `stack` | How it is used and what it is written in. The stack must support the profile. **Checked** |
| `shared` | Used by anyone other than its author. Requires `SECURITY.md`, recommends the guard. **Checked** |
| `port` | `null` for a tool with no server. Unique among the tools in the same folder. **Checked** |
| `commands.install` | Where `scripts/install.mjs` copies the slash commands: `tool`, `parent`, `user` or `none`. Installed copies must match the source. **Checked** |
| `docs` | Where each document lives. Every path must exist. **Checked** |
| `check` | The one command that runs every gate. Must exist. **Checked** |
| `test` | The tool's own test command, in its stack's language. `check` runs it |
| `reads` | Paths outside the folder the tool reads. Read-only, always |
| `vendored` | Files copied in from elsewhere: `{ "path", "from", "forked" }`. A copy that differs from its source is reported unless `forked: true` |
| `kit` | The kit modules the tool uses (section 3). Each copy must match the kit. **Checked** |
| `guard` | `null`, or `{ "open": ["data"] }` for the edit guard |

### 3. Shared code comes from the kit

Code every tool needs in exactly the same form lives once, in
`tool-techne/kit/`, and is copied into each tool by
`node tool-techne/scripts/kit.mjs sync`. Each copy must match the kit.
**Checked.** A fix is made in the kit and synced to every tool, never made
in one tool's copy.

| Module | Lands at | For | Required |
| --- | --- | --- | --- |
| `check` | `scripts/check.mjs` | the one check command | yes |
| `check-secrets` | `scripts/check-secrets.mjs` | no secrets in what git keeps | yes |
| `install` | `scripts/install.mjs` | setup: Node.js, git, dependencies, commands | yes |
| `lint-register-table` | `scripts/lint-register.mjs` | a register with one table row per defect (the starter's shape) | one of these, or the tool's own |
| `lint-register-fields` | `scripts/lint-register.mjs` | a register with one two-column table per defect | one of these, or the tool's own |
| `setup-check` | `scripts/hooks/setup-check.mjs` | Claude Code: says on opening what is not set up | |
| `tool-guard` | `scripts/hooks/tool-guard.mjs` | the edit guard | |
| `panel-core` | `gui/panel-core.mjs` | the panel's localhost check, job runner and detach | |
| `release` | `scripts/release.mjs` | a ZIP of the tool, verified to work on its own, and publishing it | in new tools |

The kit is written in Node.js whatever the tool's stack, so tool-techne
keeps one copy of each check instead of one per language. Copies, not a
package, so every tool works on its own after a ZIP download.

### 4. Write scope is the folder

A tool writes only inside its own folder. It reads outside it only through
`reads`. Code from elsewhere is copied in and listed in `vendored`, never
imported across folders.

### 5. Documents: one job per file

| File | Reader | Holds | Never holds |
| --- | --- | --- | --- |
| `README.md` | someone meeting the tool | what it is, setup, how to start it | the step-by-step |
| `RUNBOOK.md` | the person running it | each task start to finish, and what to do when something goes wrong | reasons |
| `ARCHITECTURE.md` | the AI, when it needs it | the parts, the data, who writes what | rules |
| `ROADMAP.md` | the next session | **Decisions** first, then where to start, next steps, known gaps | finished work as history |
| `AGENTS.md` | every AI assistant, every session | how to work with the person, the rules that are not obvious, a read-first table | explanation that belongs in ARCHITECTURE |
| `DEFECT-REGISTER.md` | everyone | what broke, why, and whether it can again | dates as sections |
| `SECURITY.md` | whoever checks a shared tool | passwords and keys, network, what it runs and changes | |

Every document in `docs` must exist. **Checked.** Whether each holds only
its own job is judgment.

**AGENTS.md stays focused.** It is read every session, so it holds the
rules most sessions need, and detail goes in ARCHITECTURE. Over 250 lines
is reported. A tool whose rules are genuinely needed most sessions sets
its own limit with `tool.json` `agentsMaxLines`, and says why in its
ROADMAP decisions. **Checked (warning).**

**ROADMAP opens with settled decisions.** A decision not written down gets
argued again. A missing heading is reported. **Checked (warning).**

### 6. Every AI assistant finds the instructions

`AGENTS.md` is the one instruction file. Others point to it:

| File | Read by |
| --- | --- |
| `CLAUDE.md`, containing `@AGENTS.md` | Claude Code, which imports the file |
| `GEMINI.md` | Gemini CLI |
| `.github/copilot-instructions.md` | GitHub Copilot |

Codex, Cursor and others read `AGENTS.md` directly. A missing pointer, or
one that does not name AGENTS.md, is reported. **Checked (warning).**

Workflows a tool repeats are written as plain Markdown in `guides/`, which
any assistant can follow. A slash command in `commands/` is a short file
that points at its guide.

### 7. Defect register from day one

Every tool runs again, so every tool keeps one. `scripts/lint-register.mjs`
fails when its counts are wrong, and a Claude Code Stop hook runs it.
**Checked.** The lint is one of the two kit modules, or the tool's own when
it also counts the tool's own numbers (built pages, gate scripts). A tool's
own lint is left out of `kit`, so no sync replaces it.

### 8. One check command

`node scripts/check.mjs` runs every gate: the register lint, the secrets
scan, and the tool's `test` command. `--quick` runs only the first two.

**A pre-commit hook runs the quick check before every commit**:
`.githooks/pre-commit`, turned on by `scripts/install.mjs` (git does not
carry that setting with a folder, so setup sets it). It works with every AI
assistant and with none, which Claude Code hooks do not. A missing hook, or
one not turned on, is reported. **Checked (warning).**

- **Prefer a gate to a rule.** A rule needs someone to remember it. A gate
  does not.
- **Positive-control a new gate.** Put the defect back and watch it fail.
  A gate that has only ever passed has not been tested.

### 9. No secrets in what git keeps

Passwords and keys go in `.env` or `secrets/`, both ignored by git, with a
committed `.env.example` showing what is needed. `check-secrets` fails on a
committed `.env`, anything in `secrets/`, key files, and text shaped like a
real key. **Checked**, by the tool's own check.

A tool that collects third-party data (pages harvested from a live site,
which carry that site's own public browser keys) lists those folders in
`tool.json` `secretsIgnore`, as patterns like `sites/*/_source/**`. Each run
says how many files it skipped. Never list a folder where the tool's own
settings or credentials could land.

A tool pushed to GitHub also turns on GitHub's secret scanning and push
protection (free for public repos). The tool's own scan runs first, before
anything leaves the computer; GitHub's catches more kinds of key. Not
checked: it is a repository setting.

### 10. Runtime pinned

A `node` tool sets `engines.node` in `package.json` (**checked**) and has a
matching `.nvmrc` (**checked, warning**). New tools start at Node.js 22,
the oldest version tool-techne is tested on.

A `python` tool sets `requires-python` in `pyproject.toml` (**checked**)
and has a `.python-version` (**checked, warning**). New tools start at
Python 3.10.

A `static` tool runs in any browser and pins nothing.

### 11. Setup that explains itself

`scripts/install.mjs` installs everything and is safe to run again.
`--check` reports and changes nothing. In Claude Code a SessionStart hook
runs it, and says nothing unless something is missing.

A step only one tool needs (a browser download, a file that must exist)
goes in the tool's own script, listed in `tool.json` `setupExtra`. The
standard installer runs each one after its own steps, passing `--check`
through. Each listed script must exist. **Checked.**

### 12. Data has a place

`data/` holds what the tool saves while it runs, one folder per record. It
is ignored by git. Files only a script may write are named in
ARCHITECTURE.md. An AI reads them and never edits them by hand.

### 13. Scripts do the mechanical work, the AI does judgment

Anything that can run without judgment is a script, and costs no AI tokens.
The AI is for reading, deciding and writing. RUNBOOK labels each step with
which one it is.

## Profiles

A tool picks one. The core above still applies.

### page: a page you open in your browser

Stack `static`. One `index.html` with its style and script inside it, until
it is big enough to split. No server, no port, nothing to install. Its
tests check what every page needs: a language, a title, a viewport, alt
text on images, one `h1`.

### panel: a local dashboard that runs the tool's scripts

Stack `node`.

- `gui/server.mjs` on `node:http`, no framework. `gui/index.html`, one
  file.
- Listens on `127.0.0.1` only, refuses any Host that is not localhost, and
  refuses cross-origin POSTs. A page elsewhere cannot drive it.
- Buttons map to a fixed `ACTIONS` table. Each entry checks its input and
  builds an argument list. Scripts run without a shell.
- One job at a time. Stop ends the whole process tree.
- Actions that touch something outside the computer go in a `LIVE` set and
  need the record's name typed to confirm.
- Port: the next free one from 4870 up.

### cli: commands you type

Stack `node` or `python`. No port.

### app: a service that runs all the time

Stack `node` or `python`. Starts with `core/`, `modules/` and `deploy/`. Modules never
import each other. Port: the next free one from 4900 up.

## Stacks

| Stack | Profiles | `test` |
| --- | --- | --- |
| `static` | page | `node --test` |
| `node` | cli, panel, app | `node --test` |
| `python` | cli, app | `{python} -m unittest discover -s tests -t .` |

In a `test` command, `{python}` becomes this computer's Python 3: the one in
the tool's `.venv/` if it has one, otherwise `python`, `python3` or
`py -3`, whichever runs and reports Python 3. On Windows `python3` is often
a Microsoft Store placeholder, so a name alone is not trusted. Python tests
use the standard library's `unittest`, so a new tool installs nothing.
Packages go in `requirements.txt`, and `install.mjs` puts them in `.venv/`.

A stack is a folder in `stacks/` plus an entry in `STACKS` in
`scripts/lib/standard.mjs`. A file in a stack ending `.append` is added to
the end of the matching skeleton file instead of replacing it.

## Options

### guard: lock the tool against one-off fixes

For a `shared` tool. When someone reports a problem in one record, the fix
belongs in that record, not in the tool. Without a lock an AI may change
both, and every copy of the tool drifts.

- Tool files are read-only to Claude until the person types
  `/<prefix>-tool`, which unlocks them for four hours. Claude cannot unlock
  itself.
- `guard.open` lists the folders that are always editable.
- Claude Code only: it is built on hooks.

Recommended for a `shared` tool. **Checked (warning).**

### commands: slash commands

- Source is `commands/` in the tool. Every file starts with the tool's
  prefix. **Checked.**
- `scripts/install.mjs` copies them where `commands.install` says. Never
  edit an installed copy. **Checked.**

## The tools check

```
node tool-techne/scripts/check-standard.mjs              this folder
node tool-techne/scripts/check-standard.mjs <tool>       one tool
node tool-techne/scripts/check-standard.mjs --all        every tool beside tool-techne
node tool-techne/scripts/check-standard.mjs --list       names, kinds, stacks, ports
node tool-techne/scripts/check-standard.mjs --registers  every tool's register lint
node tool-techne/scripts/kit.mjs status                  which kit copies differ
node tool-techne/scripts/kit.mjs sync --all              copy the kit into every tool
```

## Bringing an existing tool over

A tool built to an older standard (it has a `tool.json`) moves over with:

```
node tool-techne/scripts/migrate.mjs <tool folder>
```

It runs the tool's own check first and stops if that fails. Then it moves
CLAUDE.md to AGENTS.md word for word (or keeps both, when CLAUDE.md already
imports AGENTS.md), updates `tool.json`, keeps the tool's
own gates in `test` and its own installer in `setupExtra`, copies the kit,
adds the hooks, and runs the check again. It does not commit: it lists the
files it changed, and every other file that mentions CLAUDE.md, for a
person to review. `--dry-run` says what it would do.

## Sharing a tool

`node scripts/release.mjs <version>` builds `dist/<name>.zip` from the last
commit, unzips it somewhere empty, installs its dependencies there, and
runs the full check in that copy. If the tool quietly depends on anything
outside itself, that is where it shows. `tool.json` `releaseExclude` lists
folders that hold the person's own records or client work, left out of the
ZIP. `--publish` tags, pushes and creates the GitHub release.

Files a tool copies from elsewhere, like a standards document kept once
beside the tools, are listed in `vendored`. The check reports a copy whose
source changed, and `node tool-techne/scripts/vendor.mjs sync <tool>`
updates it. A source that is not on the computer at all, as in a
handed-over copy, is not reported. **Checked (warning).**

## Upgrading a tool

`node tool-techne/scripts/upgrade.mjs <tool>` (or `--all`) runs every
upgrade step since the standard the tool's `tool.json` records, with the
tool's check before and after. Each step is idempotent. It never commits.

| Standard | What the upgrade adds |
| --- | --- |
| 2 | the pre-commit hook, the AI pointer files, the release script and `dist/` in .gitignore, `guides/build-a-feature.md`, fresh kit copies, the Claude Code register and setup hooks |

## Changing the standard

Raise `standard` here and in `scripts/lib/standard.mjs`, add the upgrade
step in `scripts/lib/upgrades.mjs`, add the check with a positive-control
test, and add a row to the upgrade table above.
