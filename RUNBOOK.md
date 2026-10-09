# Runbook

Tasks for whoever maintains tool-techne. To start a tool, see
[START-HERE.md](START-HERE.md).

## Start a tool

1. **AI** follow START-HERE.md: checks Node.js and git, asks about the tool
   in one round, confirms the choices.
2. **SCRIPT** `node scripts/new-tool.mjs ...`: scaffolds, commits, checks.
   It ends with `Standard check: OK`.
3. **AI** fills ROADMAP decisions, README and AGENTS.md with the person.

## Add a stack

1. **AI** make `stacks/<name>/` with the files the stack needs: its
   project file, version pin, a starter test, and `.gitignore.append` for
   anything it generates.
2. **AI** add it to `STACKS` in `scripts/lib/standard.mjs`: the profiles it
   supports and its `test` command. Add any stack-specific rule to
   `checkTool`, like the `engines.node` check for `node`.
3. **AI** add a test that scaffolds a tool in the stack and runs its
   `scripts/check.mjs`.
4. **AI** update START-HERE.md Step 5, GOING-FURTHER.md, README.md and
   TOOL-STANDARD.md.
5. **SCRIPT** `node scripts/check.mjs`.

## Change a kit module

1. **AI** edit `kit/<module>.mjs`.
2. **SCRIPT** copy it over tool-techne's own copy in `scripts/` (see `KIT`
   in `scripts/lib/standard.mjs` for the path).
3. **SCRIPT** `node scripts/check.mjs`.
4. **SCRIPT** `node scripts/kit.mjs sync --all` for tools beside it.

## Change the standard

1. **AI** edit TOOL-STANDARD.md.
2. **AI** add the check to `scripts/lib/standard.mjs`, and a test that
   scaffolds a tool, breaks the rule and sees the check fail.
3. **AI** if existing tools would fail, raise `STANDARD` and say what they
   must do.
4. **SCRIPT** `node scripts/check.mjs`, then
   `node scripts/check-standard.mjs --all`.

## Release

1. **AI** read every file changed since the last release for personal or
   job-specific content. This repo is public.
2. **SCRIPT** `node scripts/release.mjs X.Y.Z`: refuses uncommitted
   changes, runs the check, builds `dist/tool-techne.zip` with `tool-techne/`
   as its top folder, unzips it and runs the full check in the copy.
   Nothing is published.
3. **SCRIPT** `node scripts/release.mjs X.Y.Z --publish`: the same, then
   commits the version, tags, pushes, and creates the GitHub release with
   the ZIP attached. It asks you to type the version first. Needs the
   GitHub CLI. It uses git's saved GitHub sign-in when `gh` has none.

The README's download link,
`../../releases/latest/download/tool-techne.zip`, always gets the newest
release's ZIP, so it never needs editing.

## When something goes wrong

| What you see | Why | What to do |
| --- | --- | --- |
| `Stopped: git is not installed` | git missing, or the terminal was opened before installing it | Install git, open a new terminal |
| `FAIL first commit: git does not know your name` | No git identity on this computer | The two `git config --global` lines it prints, then commit in the new tool |
| `Stopped: the prefix ... is already used` | Another tool beside it has that prefix | Pass a different `--prefix` |
| `installed command(s) ... differ` | A command was edited in an installed copy | Edit `commands/` in the tool, then `node scripts/install.mjs` |
| `port N is also claimed` | Two tools on one port | Change the newer tool's `port` in tool.json |
| `kit: ... differs from the kit` | A kit copy was edited in a tool | Move the change into `kit/`, then `kit.mjs sync` |
| Commands in the docs say the folder does not exist | The folder is `tool-techne-main`, from GitHub's green Download ZIP | Rename it to `tool-techne` |
| `release.mjs`: `the unzipped copy fails its check` | Something works only inside a git repo, or a file the check needs is not committed | Read the output it shows. Commit any missing file, or make the script work without `.git` |
