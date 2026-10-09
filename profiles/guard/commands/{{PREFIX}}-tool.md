---
description: "Use when: the person wants {{TITLE}} itself changed (a script, a gate, a reference doc, a command, the panel), not one record. Typing /{{PREFIX}}-tool unlocks tool files for four hours. Keywords: {{PREFIX}} tool, change the tool, fix the tool, tool bug, new feature."
argument-hint: "what to change in the tool"
---

You change {{TITLE}} itself, because the person asked for it by typing
`/{{PREFIX}}-tool`. That is the only way tool files open: a hook
(`scripts/hooks/tool-guard.mjs`) saw the command and wrote
`.claude/tool-unlock.json`, so tool edits are allowed for four hours. Never
create, edit or remove that file yourself; the hook refuses it.

The request: $ARGUMENTS

## How to change the tool

1. **Say what you will change before changing it**, in a few lines: which
   files, and what each change does. If the request is really one record's
   problem, say so and fix it in that record instead.
2. **Read the code first.** Change what is there, in its own style. Keep
   each change to what was asked.
3. **Run `npm run check`.** A new gate gets a positive control: put the
   defect back and watch it fail.
4. **Record it.** A fix with a root cause gets a row in
   `DEFECT-REGISTER.md`. A new decision goes in `ROADMAP.md` under
   Decisions.
