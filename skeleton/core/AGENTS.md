# {{TITLE}}

{{PURPOSE}}

Instructions for any AI assistant working on this tool. `CLAUDE.md`,
`GEMINI.md` and `.github/copilot-instructions.md` all point here, so this is
the one file to change.

It is {{PROFILE_LABEL}}, written in {{STACK_LABEL}}. It was started from
tool-techne, and meets its tool standard (`tool.json` says which version).

## Who you are working with

The person may be new to code. Unless they ask for more detail:

- Use plain words. The first time you use a technical term, say what it
  means in one line.
- Before you run a command, say what it does and why.
- Do one thing at a time, and show them the result before moving on.
- When something fails, say what went wrong in one sentence, then what you
  will do about it.
- Ask before installing anything or changing anything outside this folder.

## Read first

| File | When |
| --- | --- |
| [RUNBOOK.md](RUNBOOK.md) | Doing any task that repeats |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Changing how the parts fit together |
| [ROADMAP.md](ROADMAP.md) | Before suggesting a change of direction. Settled decisions are listed there. Do not argue them again |
| [guides/build-a-feature.md](guides/build-a-feature.md) | Adding anything to the tool: follow it step by step |
| [DEFECT-REGISTER.md](DEFECT-REGISTER.md) | After fixing anything that broke |

## Rules

<!-- Only rules an AI would get wrong without being told. Each one short,
     with the reason. Detail goes in ARCHITECTURE.md. This file is read at
     the start of every session, so keep it under 250 lines. -->

- **Write only inside this folder.** Read outside it only through the paths
  in `tool.json` `reads`.
- **No passwords or keys in files git keeps.** They go in `.env`, which is
  never committed. `scripts/check-secrets.mjs` fails the check if one gets
  through.
- **Scripts do the repeatable work.** If a step needs no judgment, write it
  as a script the person can run, instead of doing it by hand each time.
- **Commit after each change that works**, with a one-line message saying
  what changed. Explain to the person that a commit is a saved point they
  can go back to.
- **A pre-commit hook checks every commit** for secrets and a stale defect
  register. If it stops a commit, fix what it reports. Never use
  `--no-verify` to get past it unless the person decides to, knowing why.
- **Workflows live in `guides/`**, as plain Markdown any AI can follow. A
  slash command in `commands/` is a short file that says which guide to
  follow. Its name starts with `{{PREFIX}}-`.

## Before you say it is done

- `node scripts/check.mjs` passes. Show the person the summary at the end.
- If you fixed something that broke, add a row to DEFECT-REGISTER.md saying
  why it broke.
- If you added a check, prove it works: put the problem back, watch the
  check fail, then fix it again.
