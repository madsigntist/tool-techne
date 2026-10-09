---
description: "Use when: starting, stopping or checking the {{TITLE}} control panel, the local dashboard that runs every script step on a button. Keywords: {{PREFIX}} panel, control panel, start the panel, open the panel, gui."
---

You start, stop or check the {{TITLE}} control panel. Nothing else.

The panel is `gui/server.mjs` in `{{NAME}}/`, on http://localhost:{{PORT}}
(`{{PORT_ENV}}` overrides the port).

## Start

1. Check whether it is already up: request http://localhost:{{PORT}}/api/state.
   If it answers, say so and give the address. Do not start a second one.
2. Otherwise run `node gui/server.mjs --detach` in `{{NAME}}/`, as an
   ordinary call, NOT `run_in_background`: it relaunches the panel as its
   own process and returns at once. Claude Code kills a background command
   at its time limit, which would end the panel mid-job.
3. Confirm it answers, then give the address. If it does not, read
   `gui/panel.log` and show the error.

The panel runs until Shut down, even after Claude Code closes.

## Stop

Press **Shut down** in the panel, or POST to
http://localhost:{{PORT}}/api/shutdown.

Do not modify any files.
