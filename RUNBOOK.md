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

1. **SCRIPT** `node scripts/check.mjs` passes.
2. **AI** read every changed file for personal or job-specific content.
   This repo is public.
3. **SCRIPT** bump `version` in `package.json`, commit, tag `vX.Y.Z`, push
   with tags.

## When something goes wrong

| What you see | Why | What to do |
| --- | --- | --- |
| `Stopped: git is not installed` | git missing, or the terminal was opened before installing it | Install git, open a new terminal |
| `FAIL first commit: git does not know your name` | No git identity on this computer | The two `git config --global` lines it prints, then commit in the new tool |
| `Stopped: the prefix ... is already used` | Another tool beside it has that prefix | Pass a different `--prefix` |
| `installed command(s) ... differ` | A command was edited in an installed copy | Edit `commands/` in the tool, then `node scripts/install.mjs` |
| `port N is also claimed` | Two tools on one port | Change the newer tool's `port` in tool.json |
| `kit: ... differs from the kit` | A kit copy was edited in a tool | Move the change into `kit/`, then `kit.mjs sync` |
