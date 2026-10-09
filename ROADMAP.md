# Roadmap

## Start here (next session)

v1.1.0 adds the Python stack, the pre-commit hook, and CI on Windows,
macOS and Linux. What is left from phase 2 is testing the walkthrough on
assistants other than Claude, which needs a person with those accounts.

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
- 2026-10-09: **Releases ship a built `tool-techne.zip`.** GitHub's own
  Download ZIP names the folder `tool-techne-main`, and nothing in a repo
  can change that. The built ZIP's top folder is `tool-techne`. The README
  links to it with a relative link, so a fork links to its own releases.
- 2026-10-09: **Repo structure stays flat.** Nesting everything in a
  `tool-techne/` subfolder would fix the green button's ZIP but break
  clones and hide the README.
- 2026-10-09: **Python tests use `unittest`, not pytest.** It ships with
  Python, so a new Python tool installs nothing. A tool that wants pytest
  adds it to `requirements.txt` and changes its `test`.
- 2026-10-09: **Python is found by running it**, through `{python}` in the
  test command. On Windows `python3` is often a Store placeholder.
- 2026-10-09: **The pre-commit hook runs the quick check only** (register
  and secrets). The full check runs tests, which would make every commit
  slow enough that people skip the hook.
- 2026-10-09: **Node.js 22 is the floor.** 18 and 20 are past end of life,
  and CI runs 22 on every change, so the stated floor is the tested one.
- 2026-10-09: **No panel in Python.** `panel-core` is the security-critical
  half of a panel, and one copy is easier to keep right than two.

## Next

- **Walkthrough tested on other assistants**: GitHub Copilot, Gemini CLI,
  and a browser chat (ChatGPT or Claude on the web). Record what each got
  wrong in the register.

## Known gaps

- The `app` profile has no scaffold beyond empty `core/`, `modules/` and
  `deploy/`.
- The guard and the setup hook are Claude Code only. The pre-commit hook
  covers secrets for every assistant.
- The pointer files' effect in Gemini CLI and Copilot is not yet verified.
