# {{TITLE}}

{{PURPOSE}}

<!-- The README is for someone meeting the tool: what it is, how to set it
     up, how to start it. Step-by-step tasks go in RUNBOOK.md. Delete this
     comment once the sections below are filled in. -->

## What you need

- Node.js 18 or newer: https://nodejs.org
- git: https://git-scm.com/downloads

## Set it up

Open a terminal in this folder and run:

```
node scripts/install.mjs
```

It checks what is installed and sets up the rest. It is safe to run again.

## Start it

[How to start it. A page: open index.html in your browser. A panel: run
`npm run gui`, then open http://localhost:{{PORT}}.]

## Check it

```
node scripts/check.mjs
```

Runs every check. Run it before each commit.

## Working on it with an AI assistant

Open this folder in your AI assistant (Claude Code, GitHub Copilot, Cursor,
Gemini, Codex and others). It reads AGENTS.md first, which tells it how this
tool works.

## Documents

| | |
| --- | --- |
| [RUNBOOK.md](RUNBOOK.md) | Doing each task, start to finish |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How it is put together |
| [ROADMAP.md](ROADMAP.md) | Decisions made so far, and what is next |
| [DEFECT-REGISTER.md](DEFECT-REGISTER.md) | What has broken, and whether it can happen again |

Started from tool-techne.
