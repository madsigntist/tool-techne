# Roadmap

## Start here (next session)

Phase 1 is built: a public, AI-neutral starter with `static` and `node`
stacks, a guided start, and a secrets gate. Phase 2 is next.

## Decisions (settled, do not reopen)

- 2026-10-09: **A template plus a scaffold script, not a written plan.** A
  plan in prose drifts. A skeleton that runs, and a check, do not.
- 2026-10-09: **AGENTS.md is the one instruction file.** CLAUDE.md,
  GEMINI.md and Copilot's file point to it. Most assistants now read
  AGENTS.md, and one file cannot disagree with itself.
- 2026-10-09: **Workflows are Markdown any AI can follow.** Slash commands
  and hooks are Claude Code extras on top, never the only path.
- 2026-10-09: **START-HERE.md stands alone.** A person using a browser chat
  pastes that one file. It cannot rely on the AI reading any other.
- 2026-10-09: **The kit stays in Node.js for every stack.** One copy of each
  check, not one per language. Node.js is the one thing everyone installs.
- 2026-10-09: **Stacks are added when someone asks.** `static` and `node`
  first, Python next. Each stack is upkeep.
- 2026-10-09: **`page` with `static` is the default for beginners.** Nothing
  to install, and anyone can open it.
- 2026-10-09: **Tools sit beside tool-techne, not inside it.** Updating means
  replacing one folder, and no tool is touched.
- 2026-10-09: **Kit copies, not a package.** A tool downloaded as a ZIP
  still works on its own.
- 2026-10-09: **The secrets scan is required in every tool.** People new to
  code paste keys into files, and a key pushed to a public repo is found by
  bots within minutes.
- 2026-10-09: **No plugin packaging.** Plugin commands are namespaced and
  cached, and a plugin does not load its instruction file. Revisit if
  tool-techne gets users who never edit it.
- 2026-10-09: **MIT license, author Michael Kelly.**

## Next (phase 2)

- **Python stack**: `stacks/python/` with `pyproject.toml`,
  `.python-version`, a starter test, `test: python -m pytest`, profiles
  `cli` and `app`.
- **git pre-commit hook** that runs `node scripts/check.mjs`, so the
  checks run with every assistant and with none. `install.mjs` sets
  `core.hooksPath`.
- **CI**: a GitHub Actions matrix (Windows, macOS, Linux) running
  `node scripts/check.mjs`, plus a scaffold of each stack and profile.
- **Walkthrough tested on three assistants**: Claude Code, GitHub Copilot,
  and a browser chat. Record what each got wrong in the register.

## Known gaps

- Tested on Windows only. The panel's Stop uses `taskkill` there and
  process groups elsewhere; the second path has not run here.
- The `app` profile has no scaffold beyond empty `core/`, `modules/` and
  `deploy/`.
- The guard and the setup hook are Claude Code only.
- The pointer files' effect in Gemini CLI and Copilot is not yet verified.
