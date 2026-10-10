# Changelog

What changed in each release, for people using tool-techne. Defects and
their causes are in [DEFECT-REGISTER.md](DEFECT-REGISTER.md).

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
