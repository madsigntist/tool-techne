# Security

For anyone checking tool-techne before using it.

## Passwords and keys

tool-techne uses none and asks for none. It never reads `.env` or
`secrets/`. The secrets scan reads files only to look for key-shaped text,
and prints the file and line number of a match, not the key.

## Network

Only `scripts/release.mjs --publish`, which the maintainer runs: it pushes
to the git remote and creates a GitHub release through the GitHub CLI.
If the GitHub CLI has no sign-in of its own, it borrows the GitHub token
git already saved, for that run only. The token is passed in memory, never
written to a file or printed.

`install.mjs` in a tool downloads packages only when that tool lists them:
`npm install` from the npm registry for `package.json`, `pip install` from
PyPI for `requirements.txt`. A new tool lists none.

No other script makes a network request. The panel profile's server, in
tools that use it, listens on `127.0.0.1` only and refuses requests from
other sites.

## What it runs

- `node` and `git`, with fixed arguments and no shell.
- `npm install` from `scripts/install.mjs`, only when a tool's
  `package.json` lists dependencies. On Windows it goes through a shell,
  because npm is a script there. The arguments are fixed.
- A tool's own `test` command from its `tool.json`, through a shell, when
  that tool's `scripts/check.mjs` runs. This is the tool's own setting.
- `python -m venv` and `pip install` from `install.mjs`, only when a
  Python tool's `requirements.txt` lists packages.
- The git pre-commit hook, `.githooks/pre-commit`: runs
  `node scripts/check.mjs --quick`, read-only.
- Claude Code hooks, listed in `.claude/settings.json`: the register lint
  and the setup and standard checks. All read-only.

## What it changes

- `new-tool.mjs`: creates the new tool's folder, and adds one line to the
  parent folder's `.gitignore` if that folder is a git repo.
- `install.mjs`: copies slash commands into `.claude/commands/` (or where
  `--scope` says), sets `core.hooksPath` in the tool's own git config, and
  creates `.venv/` for a Python tool that lists packages.
- `kit.mjs sync`: overwrites kit copies in tools.
- `migrate.mjs`: changes files inside the one tool folder it is given, and
  runs that tool's own check and setup. It refuses a tool with uncommitted
  changes, so everything it does can be reviewed and undone with git. It
  never commits.
- `release.mjs`: writes `dist/`. With `--publish`: commits the version,
  tags, pushes, and creates the release.

Nothing outside the folder that holds tool-techne and its tools, except
`--scope user`, which writes to `~/.claude/commands/`.

## Data it keeps

None.

## Dependencies

None. Node.js built-in modules only.

## Open items

- The secrets scan matches known key shapes. It does not catch a password
  typed as an ordinary word.
