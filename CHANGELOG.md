# Changelog

What changed in each release, for people using tool-techne. Defects and
their causes are in [DEFECT-REGISTER.md](DEFECT-REGISTER.md).

## Unreleased

- **Sessions start from a one-page brief, and session documents have a
  size budget.** A new kit module, `brief` (`scripts/brief.mjs`), prints
  ROADMAP's first section, the decision count, the register's index and
  every row that can recur; new tools carry it and run it from the
  SessionStart hook. `check-standard.mjs` warns on a ROADMAP over 40 KB or
  with more than 10 ticked boxes, a register over 150 KB, and a Decisions
  heading past the third section; `tool.json` `docMaxKB` raises a budget.
  `--list` shows each tool's sizes. ROADMAP's order is now where to start,
  then Decisions, as the skeleton already had it. Existing tools add
  `"brief"` to `kit` and run `kit.mjs sync`.
- **The feature plan template is leaner.** The check runs once at the
  start and after each change, not before and after; the next-session
  prompt starts from the brief instead of re-reading AGENTS.md; a "Waiting
  on the person" table blocks the next session when something has waited
  longer than one; finished session blocks shrink to one line; token counts
  are asked for, not written as "not shown".
- **Fix: the standard lists `check-colors`, and the example manifest says
  standard 2.**
- **`"guard": false` is a decided no.** A shared tool whose person has
  chosen no edit guard sets it, and the standing warning stops. `null`
  still means undecided and still warns.

- **Every tool with a port owns a hundred, panels included.** A new
  panel takes the first port of the next unused hundred, as an app does,
  instead of the next free port from 4870. `check-standard --all` fails
  two tools in one hundred (two panels on 4870 and 4871 sat a digit
  apart). A tool alone in a lower hundred keeps its port. `nextAppPort`
  and `PANEL_PORT_START` are gone: `nextPort(used)` serves both.

- **Each app owns a hundred of ports.** A new `app` takes the first port
  of the next unused hundred (4900, then 5100: round thousands are
  skipped), and panels skip app hundreds. `check-standard --all` fails a
  tool whose port sits in another app's hundred. Before, a second app took
  4901, beside the first.

- **Fix: the parent repo's ignore entry for a new tool is anchored**
  (`/<name>/`). Unanchored, it also hid `feature-work/<name>/` plans from
  the parent repo. A workspace with older entries can add the leading
  slash by hand.

- **Principles** at the top of TOOL-STANDARD.md. New tools' AGENTS.md and
  `guides/build-a-feature.md` ask which of correct, cheaper or safe a
  feature serves, and give every new choice a default. Existing tools can
  copy the two rules from `skeleton/core/AGENTS.md`.

- **A plan for long features**, `guides/plan-a-long-feature.md` in new
  tools: one file outside the tool's repo carries a feature across
  sessions, assistants and model switches, with a usage row per session.
  Existing tools can copy the guide from `skeleton/core/guides/`.

- On Windows, a panel's jobs no longer open a console window over the
  browser. `panel-core` and `setup-check` start every child process with
  `windowsHide: true`; a detached panel has no console, so without it
  Windows gave each job a new one.

## 1.3.1

- `vendor.mjs sync --commit` commits the updated copies in each tool, and
  only those files. `--hook` makes it quiet for a Claude Code hook, so a
  change to a shared document can reach every tool without anyone
  remembering to sync.
- A copy edited in place in a tool is held and reported, never overwritten.

## 1.3.0

- **Tool standard 2.** `node tool-techne/scripts/upgrade.mjs <tool>` (or
  `--all`) brings a tool made with an earlier tool-techne up to date, with
  its check run before and after. It never commits.
- **Share a tool.** Every tool now has `scripts/release.mjs`: it builds a
  ZIP someone else can use with nothing around it, and proves that by
  running the tool's check in an unzipped copy. `releaseExclude` in
  tool.json leaves out folders of your own records or client work.
  `--publish` puts the release on GitHub.
- **A feature guide** in every tool, `guides/build-a-feature.md`: the steps
  any AI follows to add something, test first.
- **Shared documents.** `vendor.mjs` keeps files a tool copies from
  elsewhere (like a standards document) in step with their source. A
  source that is not on the computer, as in a handed-over copy, is no
  longer reported.
- `agentsMaxLines` in tool.json sets a tool's own limit for AGENTS.md.

## 1.2.2

- `migrate.mjs` accepts a tool that already keeps its rules in AGENTS.md.
- Fixed: the list of changed files cut the first letter off one path.

## 1.2.1

- `secretsIgnore` in tool.json: folders of harvested third-party data the
  secrets scan skips, with every run saying how many files it skipped.

## 1.2.0

- `migrate.mjs` moves a tool from an older tool standard onto this one.
- `setupExtra`: a tool's own setup steps, run by the standard installer.
- A second register format, and a tool may keep its own register lint.

## 1.1.0

- **Python** tools (command line and background service).
- A **pre-commit hook** in every tool, so every commit is checked for
  passwords and keys with any AI assistant or none.
- CI on Windows, macOS and Linux. Node.js 22 is the minimum.
- START-HERE checks the kind of tool fits the job before choosing (a page
  cannot remind anyone), and warns about OneDrive and Downloads folders.
- Fixed: the edit guard let edits through on macOS.

## 1.0.0

- First release: the guided start for any AI, page and Node.js tools, the
  tool standard, and the checks that keep each tool to it.
