# Architecture

<!-- The shape of the tool. An AI reads this only when it needs to, so
     detail belongs here, not in AGENTS.md. -->

{{PROFILE_LABEL}}, written in {{STACK_LABEL}}. `tool.json` holds the port,
the command prefix and where each document is.

## Parts

[The files and folders that matter, and what each one does.]

## Data

| Path | Written by | Read by |
| --- | --- | --- |
| `data/<record>/` | [script or panel] | [who] |

Files only a script may write: [list them. An AI reads them and never edits
them by hand.]

## Contracts

[Every file one part writes and another reads: what is in it, who writes
it, and what refuses to run without it.]

## Write scope

This tool writes only inside its own folder. It reads outside it only
through the paths in `tool.json` `reads`. Files copied in from elsewhere
are listed in `tool.json` `vendored`.
