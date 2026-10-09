# tool-techne

Instructions for any AI assistant working in this folder. `CLAUDE.md`,
`GEMINI.md` and `.github/copilot-instructions.md` all point here.

## What the person probably wants

**If they want to start a tool, or are not sure what to do: follow
[START-HERE.md](START-HERE.md)** from the section "If you are an AI
assistant". That is what most people open this folder for.

The rest of this file is for changing tool-techne itself: the standard, the
scaffold, the stacks or the checks.

## Read first

| File | When |
| --- | --- |
| [TOOL-STANDARD.md](TOOL-STANDARD.md) | The standard. Changing it changes every future tool |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How skeleton/, stacks/, profiles/ and kit/ fit together |
| [ROADMAP.md](ROADMAP.md) | Settled decisions. Do not reopen them |
| [DEFECT-REGISTER.md](DEFECT-REGISTER.md) | What has broken |

## Rules

- **The standard, the scaffold and the check move together.** A new rule
  in TOOL-STANDARD.md that can be checked gets a check in
  `scripts/lib/standard.mjs` and a positive-control test in
  `test/standard.test.mjs` in the same change. A rule that cannot be
  checked says so in the standard.
- **Raise `STANDARD` for a rule existing tools would fail.** Then say in
  TOOL-STANDARD.md what a tool must do to move up.
- **A fix to shared code goes in `kit/`**, then `node scripts/kit.mjs sync
  --all`, and tool-techne's own copies are updated the same way. Never fix a
  copy in place: the check fails it, and the fix would not reach other
  tools.
- **The check never changes a file.** It reports.
- **The scaffolder reads only from inside tool-techne.** Nothing from the
  home folder or any other install: a file that exists only on the
  author's computer breaks every download (register 1.3). The tests run
  with an empty home folder to catch it.
- **skeleton/ and stacks/ files are templates.** `{{TOKENS}}` are filled by
  `new-tool.mjs`. `skeleton/core/tool.json` is not valid JSON until filled.
- **Nothing personal or job-specific in skeleton/, stacks/ or kit/.** This
  repo is public. No client names, employers, internal URLs or credentials,
  in files or in examples.
- **Plain language in every file a newcomer reads**: START-HERE.md,
  GOING-FURTHER.md, GLOSSARY.md, README.md and the skeleton docs. A term a
  newcomer would not know goes in GLOSSARY.md.
- **Any AI, not one.** Workflows are Markdown any AI can follow. Claude Code
  hooks and slash commands are extras on top, never the only way a step
  works.
- **American English. No em dashes.**

## Before done

- `node scripts/check.mjs` passes: register lint, secrets scan, the
  positive-control tests, and tool-techne against its own standard.
- A fix with a root cause has a row in DEFECT-REGISTER.md.
