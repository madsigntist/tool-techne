# Architecture

tool-techne is itself a tool: profile `cli`, stack `node`, no server, no
dependencies.

## Parts

| Path | What it is |
| --- | --- |
| `START-HERE.md` | The guided start. Works pasted into a chat AI, so it must not depend on any other file |
| `TOOL-STANDARD.md` | The standard, and the reason for each rule |
| `kit/` | Shared code, one file per module, copied into tools by `scripts/kit.mjs`. Never edited in a tool |
| `skeleton/core/` | Copied into every new tool. Text files carry `{{TOKENS}}` |
| `stacks/<stack>/` | Layered on for the chosen stack. `*.append` files are added to the end of the matching file |
| `profiles/panel/` | Layered on for `--profile panel`: `gui/server.mjs` (on `panel-core`), `gui/index.html`, `scripts/status.mjs`, the `<prefix>-panel` command |
| `profiles/guard/` | Layered on for `--guard`: the `<prefix>-tool` command and the hook entries |
| `scripts/new-tool.mjs` | The scaffolder |
| `scripts/check-standard.mjs` | The command line over `scripts/lib/standard.mjs` |
| `scripts/lib/standard.mjs` | Every checkable rule as functions, plus `PROFILES`, `STACKS` and `KIT`. Changes no file |
| `scripts/kit.mjs` | Syncs and reports kit copies |
| `test/standard.test.mjs` | Scaffolds real tools into a temp folder and breaks them one part at a time |
| `commands/`, `.github/prompts/` | The `/new-tool` wrappers for Claude Code and Copilot. Both say "follow START-HERE.md" |

tool-techne carries its own copies of the required kit modules in
`scripts/`, and its own check fails if they drift from `kit/`.

## Scaffold order

1. Refuse early: bad name, unknown profile or stack, a stack that does not
   support the profile, the folder exists, git missing, the prefix taken by
   a tool beside it.
2. Copy `skeleton/core/`, then `stacks/<stack>/`, then
   `profiles/<profile>/` if there is one, then `profiles/guard/`. A later
   layer overwrites an earlier file of the same path. Tokens are filled in
   file names and text files.
3. Merge what a copy cannot: `package.scripts.json` into `package.json`
   (only when the stack has one), `settings.hooks.json` into
   `.claude/settings.json`, and `test`, `kit`, `guard` and
   `docs.security` into `tool.json`.
4. Copy the kit modules.
5. If the parent folder is a git repo, add the tool to its `.gitignore`.
6. Install the commands, `git init`, first commit. A missing git identity
   is reported with the exact fix, and the scaffold is kept.
7. Run the standard check on the result.

## Tokens

| Token | From |
| --- | --- |
| `NAME` | `--name` |
| `TITLE` | `--title`, or the name in title case |
| `PURPOSE` | `--purpose`, or a bracketed placeholder |
| `PROFILE`, `PROFILE_LABEL` | `--profile`, and its plain description from `PROFILES` |
| `STACK`, `STACK_LABEL` | `--stack` or the profile's default, and its label from `STACKS` |
| `PREFIX` | `--prefix`, or the name's initials |
| `PORT`, `PORT_ENV` | next free from 4870 (panel) or 4900 (app), `null` otherwise |
| `NODE` | `--node`, or the running Node.js major version |
| `SHARED`, `DATE` | `--shared`, today |

## What the check reads

`tool.json`, `package.json`, `.claude/settings.json`, the documents named
in `tool.json`, the AI pointer files, `commands/` and its installed copies,
vendored files and their sources, and `git check-ignore` in a parent repo.
Nothing else.

## Write scope

`new-tool.mjs` writes the new tool's folder, one entry in a parent repo's
`.gitignore`, and the installed command copies. `kit.mjs sync` writes kit
copies into tools. The check writes nothing.
