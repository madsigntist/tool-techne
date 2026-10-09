# tool-techne

Make your own tools with an AI assistant, even if you have never written
code.

Open this folder in your AI assistant and say what you want to make. It
asks you a few questions, sets up a new folder for your tool, and helps you
build it. Each tool starts with its own history, a place to write down
decisions, and checks that catch common mistakes, like an API key about to
be published.

*Techne* (TEK-nee) is Greek for craft: the know-how of making things.

Made by Michael Kelly.

## Get it

Pick one:

- **Download [tool-techne.zip](../../releases/latest/download/tool-techne.zip)**,
  the latest release. Unzip it into a folder where you will keep your tools.
  You get a folder named `tool-techne`.
- **Use this template**: the **Use this template** button makes your own
  copy on GitHub.
- **Clone it**: `git clone <this repo's URL>`

The green **Code** button's **Download ZIP** works too, but GitHub names
the folder `tool-techne-main`. Rename it to `tool-techne`, because every
command in these documents uses that name.

## What you need

- **Node.js** 18 or newer: https://nodejs.org (choose LTS)
- **git**: https://git-scm.com/downloads
- **An AI assistant.** Any of these works: Claude Code, GitHub Copilot,
  Cursor, Codex, Gemini CLI, or a browser chat like ChatGPT or Claude.

## Start

Open [START-HERE.md](START-HERE.md). It covers the rest.

## What you get

Each tool is its own folder beside this one:

```
your-folder/
  tool-techne/      reused for every tool
  plant-tracker/    a tool
```

A tool can be:

| Kind | What it is | Written in |
| --- | --- | --- |
| page | A page you open in your browser | HTML, CSS and JavaScript. Nothing to install |
| panel | A dashboard on your computer with buttons that run tasks | Node.js |
| cli | Commands you type in a terminal | Node.js |
| app | A service that runs all the time | Node.js |

Python is next. See [ROADMAP.md](ROADMAP.md).

## Updating

Download the new version and replace the `tool-techne` folder. Your tools
are separate folders and are not touched. To bring a tool's shared scripts
up to date afterward, run `node tool-techne/scripts/kit.mjs sync --all` from
the folder that holds your tools.

## Documents

| | |
| --- | --- |
| [START-HERE.md](START-HERE.md) | Start your first tool |
| [GOING-FURTHER.md](GOING-FURTHER.md) | The options, explained |
| [GLOSSARY.md](GLOSSARY.md) | Every term these documents use |
| [TOOL-STANDARD.md](TOOL-STANDARD.md) | The full standard every tool is built to |
| [RUNBOOK.md](RUNBOOK.md) | Tasks for whoever maintains tool-techne |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How tool-techne is put together |
| [ROADMAP.md](ROADMAP.md) | Decisions, and what is next |
| [DEFECT-REGISTER.md](DEFECT-REGISTER.md) | What has broken, and whether it can again |
| [SECURITY.md](SECURITY.md) | What it runs, what it changes, what it never does |

## License

MIT. See [LICENSE](LICENSE).
