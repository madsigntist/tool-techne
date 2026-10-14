# Plan a long feature

For a feature that will take more than one session: more than one sitting,
more than one AI assistant, or a model switch along the way. A short
feature follows [build-a-feature.md](build-a-feature.md) alone.

Each session starts with no memory of the last. The plan file is what
carries the work from one session to the next: what is done, what is next,
which model the next session needs, and what each session cost.

## Where the plan lives

**Outside this tool's git repo, somewhere that is backed up.** A folder
beside the tools works: `feature-work/<tool>/<feature>.md`, kept in a
private repo of your own or a synced folder.

- Not committed in the tool: a release ships what the tool's repo holds,
  and a plan names real records, accounts and people.
- Not only on one disk: a plan that is lost takes every session's notes
  with it.

If there is nowhere else, keep it in the tool folder as `FEATURE-WORK.md`
and add that name to `.gitignore`. Then back it up yourself.

This file is the one exception to "write only inside this folder" in
AGENTS.md: the assistant may write the plan where the person keeps it.

## What the plan holds

Copy this into a new file and fill it in with the person.

```markdown
# Feature: <name>

Working plan for <tool>. Not shipped. Settled things move into the tool's
own documents the session they are settled, so deleting this file loses
nothing:

| Settled thing | Its permanent home |
| --- | --- |
| A decision | ROADMAP.md, Decisions |
| How the feature works | README.md or RUNBOOK.md |
| New data or a new part | ARCHITECTURE.md |
| A new network destination or kind of data | SECURITY.md |
| Something that broke, and why | DEFECT-REGISTER.md |

## Rules for every session

- Branch: `<feature branch>`. Commit at the end of each session.
- Run `node scripts/check.mjs` before and after every change.
- Start a new session at every model switch, after any live run, and when
  a session has gone long.
- End every session with the handoff, unasked: say the session is done,
  name the assistant and model for the next one, fill in the Usage row,
  and give the next session's prompt in one code block. The prompt names
  every file by its full path. Anything the next session needs that exists
  only in the chat goes into this file first.

## Where we are (updated <date>)

<What is done, in two or three lines.>

| Next | Model | Needs first |
| --- | --- | --- |
| <session> | <model> | <what must be true first> |

Next session prompt:

    Read <full path to the tool>/AGENTS.md, then <full path to this file>.
    Run <session>. Work on the branch <branch>. Follow the Rules in this file.

## Usage

One row per session, at the handoff. Tokens or cost: `/cost` in Claude
Code; write "not shown" where the assistant gives none.

| Session | Assistant, model | Tokens or cost | Notes |
| --- | --- | --- | --- |

## Sessions

### Session 1: <name> (<model>)

Status: not started
Build: <what this session makes>
Done when: <how anyone can tell>

## Notes

Raw findings. Move each to its permanent home once settled.
```

## Choosing a model per session

Give the hard thinking to the stronger model and the following-a-pattern
work to the faster one. Investigating something unknown, a first run
against a live system, and reviewing another session's work go to the
stronger model. Building to a pattern already set and writing docs go to
the faster one. The Usage table shows whether the split is paying off.

## When the feature is done

Check every Notes entry and session finding is in its permanent home, then
ask the person before removing the plan. Moving it to a `done/` folder
beside it keeps the history.
