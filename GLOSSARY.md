# Glossary

Every term the tool-techne documents use, in plain words.

## AGENTS.md

The instruction file every AI assistant reads first when it opens a tool's
folder. It says what the tool is and the rules for working on it. Files like
`CLAUDE.md` and `GEMINI.md` point to it, so there is one file to keep up to
date.

## AI assistant

A program you talk to that can write and explain code: Claude, ChatGPT,
GitHub Copilot, Cursor, Gemini and others. Some can work on the files on
your computer (editor mode). Others only chat in a browser (chat mode).

## Check

A script that looks for a specific mistake and fails loudly when it finds
one. `node scripts/check.mjs` runs every check a tool has.

## Commit

A saved point in your tool's history. You can always go back to it. Each
commit has a short message saying what changed.

## Defect register

A file (`DEFECT-REGISTER.md`) that lists what has broken in a tool, why, and
whether anything stops it happening again.

## Folder path

The address of a folder on your computer, like
`C:\Users\you\tools\plant-tracker` on Windows or
`/Users/you/tools/plant-tracker` on a Mac.

## Gate

A check that stops work going forward until the problem is fixed. A rule
asks people to remember. A gate does not need anyone to remember.

## git

A free program that keeps the history of a folder: every commit, who made
it and when. Each tool has its own history, called a repository.

## Kit

Scripts every tool needs in exactly the same form, like the secrets check.
They live once in `tool-techne/kit/` and are copied into each tool.

## Node.js

A free program that runs JavaScript outside a web browser. tool-techne's
scripts need it, and so does any tool written in the Node.js stack.

## Panel

A kind of tool: a page on your own computer with buttons, each running one
of the tool's scripts. Only your computer can open it.

## Port

A number that tells your browser which program on your computer to talk
to. A panel uses one, like `http://localhost:4870`. Two tools cannot share
a port.

## Prefix

A short code, like `pt`, at the start of each of a tool's AI commands, so
commands from different tools never clash.

## Profile

How a tool is used: a page, a panel, commands (cli) or a service that
always runs (app).

## Repository (repo)

A folder whose history git keeps. Each tool is its own repository, and so
is tool-techne.

## Secret

A password, API key or private key. Secrets go in a file named `.env`,
which git is told never to keep. The secrets check fails if one turns up
anywhere else.

## Slash command

A shortcut some AI assistants understand, typed like `/new-tool`. Each one
points the AI at a guide written in plain Markdown, so assistants without
slash commands can follow the same guide.

## Stack

What a tool is written in: `static` (HTML, CSS and JavaScript in a page,
nothing to install) or `node` (Node.js).

## Standard

The list of things every tool built with tool-techne has, and the reason
for each. It lives in `TOOL-STANDARD.md`.

## Terminal

A window where you type commands instead of clicking. On Windows it is
called Command Prompt or PowerShell. On a Mac, Terminal.

## tool.json

A small file in every tool that records its name, kind, port and where its
documents are. Scripts read it, so these facts are written in one place.
