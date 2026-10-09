# Going further

[START-HERE.md](START-HERE.md) makes the choices for you. This page explains
them, for when you want to choose yourself. The full rules are in
[TOOL-STANDARD.md](TOOL-STANDARD.md).

## Kinds of tool (profiles)

| Profile | Pick it when | Example |
| --- | --- | --- |
| `page` | You want to open it and use it, nothing to install or start | A packing list, a budget page, a recipe scaler |
| `panel` | The tool runs jobs on your computer, and you want buttons for them | Resize every photo in a folder, then rename them |
| `cli` | You are happy typing commands, or it will run on a schedule | A script that backs up a folder every night |
| `app` | It has to run all the time | A bot that answers messages |

Not sure? Start with `page`. You can make a second tool later.

## Languages (stacks)

| Stack | Profiles | Needs |
| --- | --- | --- |
| `static` | page | A browser. Node.js only for the checks |
| `node` | panel, cli, app | Node.js |

Python is planned. A tool in another language is possible today: start a
`cli` tool in `node` and replace the code, keeping the documents and
checks. Its `tool.json` `test` field then holds that language's test
command.

## Sharing a tool

Add `--shared` when anyone other than you will use the tool. It adds a
`SECURITY.md` for whoever checks the tool before using it.

Add `--guard` as well to lock the tool's own files. When someone asks an AI
to fix one record ("this entry has the wrong date"), the AI fixes that
record's files and cannot change the tool itself. Typing `/<prefix>-tool`
unlocks the tool for four hours. The lock is a Claude Code hook, so it only
works in Claude Code.

## What every tool gets

- **Its own history** (a git repository) from the first minute.
- **AGENTS.md**, read by every AI assistant, plus pointer files for those
  that look elsewhere (`CLAUDE.md`, `GEMINI.md`,
  `.github/copilot-instructions.md`).
- **Documents with one job each**: README (what it is), RUNBOOK (doing each
  task), ARCHITECTURE (how it fits together), ROADMAP (decisions and what is
  next).
- **A defect register**, for what broke and why.
- **One check command**, `node scripts/check.mjs`: the register is
  current, no secrets are about to be committed, and the tests pass.

## Claude Code extras

Claude Code runs hooks, and tool-techne adds a few:

- When you open a tool, it checks the tool is set up and says what is
  missing.
- When Claude finishes a reply, it checks the defect register is current.
- When you open tool-techne, it checks every tool beside it against the
  standard, and says nothing unless one fails.

Other assistants skip these. Run `node scripts/check.mjs` yourself before
committing, or ask your assistant to.

## Keeping tools up to date

Shared scripts (the kit) are copied into each tool. After updating
tool-techne, run this from the folder that holds your tools:

```
node tool-techne/scripts/kit.mjs status       which tools have old copies
node tool-techne/scripts/kit.mjs sync --all   update them
node tool-techne/scripts/check-standard.mjs --all
```

Documents are never updated this way. They are each tool's own.

## Checking every tool

```
node tool-techne/scripts/check-standard.mjs --list    every tool, its kind and port
node tool-techne/scripts/check-standard.mjs --all     every tool against the standard
```
