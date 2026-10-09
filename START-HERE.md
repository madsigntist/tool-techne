# Start here

tool-techne helps you make your own tool with an AI assistant: a page, a
dashboard or a set of commands that does a job you do again and again. You
describe the job. The AI asks you a few questions, sets up the folder, and
helps you build it.

*Techne* (TEK-nee) is Greek for craft: the know-how of making things.

## If you are a person

1. **Get tool-techne**: download `tool-techne.zip` from the Releases page
   of the tool-techne GitHub repo, and unzip it where you will keep your
   tools. If your folder is called `tool-techne-main`, rename it to
   `tool-techne`.
2. **Install two free programs**, if you do not have them yet:
   - **Node.js**: https://nodejs.org. Choose the LTS version.
   - **git**: https://git-scm.com/downloads
   Your AI assistant can walk you through either one. Ask it.
3. **Open the `tool-techne` folder in your AI assistant.** In VS Code or
   Cursor: File, then Open Folder. In Claude Code: run `claude` in a
   terminal from inside the folder.
4. **Say what you want to make**, in your own words. For example: "Help me
   start a tool that keeps track of the plants I water."

Using an AI in a browser chat, like ChatGPT, Gemini or Claude on the web?
Upload or paste this file into the chat and say the same thing. It cannot
see your files, so it will tell you what to type and where.

Every new tool is made **beside** this folder, not inside it:

```
your-folder/
  tool-techne/      this folder, which you reuse for every tool
  plant-tracker/    your first tool
  next-idea/        your second
```

Want to know more first? Read [GOING-FURTHER.md](GOING-FURTHER.md). Words
you do not know are in [GLOSSARY.md](GLOSSARY.md).

---

## If you are an AI assistant

You are helping someone start a new tool with tool-techne, which was made
by Michael Kelly. Follow these steps in order. Do not skip one because it
seems obvious.

**How to talk to them.** Assume they have never written code unless they
show otherwise. Use plain words. The first time you use a technical term
(terminal, folder path, commit), explain it in a few words. Do one thing at
a time, and wait for them when a step needs them. Never put a password or
API key in a file other than `.env`.

### Step 1: Say hello, and find out what you can do

Open with one short line, like: "This is tool-techne, made by Michael
Kelly. I'll help you set up your first tool."

Then work out which of these you are:

- **Editor mode**: you can read files and run commands in their
  `tool-techne` folder (Claude Code, Copilot agent mode, Cursor, Codex,
  Gemini CLI and others). You run the commands below yourself, after saying
  what each one does.
- **Chat mode**: you cannot see their computer. You give them each command
  to paste, tell them where to paste it, and ask them to paste back what it
  printed. Tell them how to open a terminal in the `tool-techne` folder:
  - Windows: open the folder in File Explorer, click the address bar, type
    `cmd`, press Enter.
  - Mac: in Finder, right-click the folder, then Services, then New
    Terminal at Folder.
  - Linux: right-click in the folder, then Open in Terminal.

### Step 2: Check the folder name and the two programs

The folder must be named exactly `tool-techne`: every command here uses
that name. GitHub's green Download ZIP button names it `tool-techne-main`.
In editor mode, look at the folder you are in. In chat mode, ask them. If
it is anything else, walk them through renaming it: close the folder in
their editor first, rename it in File Explorer or Finder, then open it
again.

Run (or ask them to run):

```
node --version
git --version
git config user.email
```

- `node` must print v18 or higher. If it is missing or older, walk them
  through installing the LTS version from https://nodejs.org, one screen at
  a time. They must open a new terminal afterward.
- `git` must print a version. If not, walk them through
  https://git-scm.com/downloads. On Windows, the default for every
  installer screen is fine.
- If `git config user.email` prints nothing, ask for the name and email
  they want on their work, then run:
  ```
  git config --global user.name "Their Name"
  git config --global user.email "their@email"
  ```
  Explain: git labels each saved version with this. It can be any email
  they like.

Do not go on until all three work.

### Step 3: Ask how much detail they want

Ask: "Do you want me to keep this simple and make the technical choices for
you, or show you the options?"

### Step 4: Ask about the tool, in one round

Ask these together, in plain words, not one at a time:

1. **What should it do?** One or two sentences. (If they already said,
   don't ask again.)
2. **Will anyone else use it**, or only you?
3. **How do you picture using it?**
   - a. Open a page in my web browser
   - b. A dashboard on my computer with buttons that run tasks
   - c. Type commands in a terminal
   - d. Something that runs all the time in the background

If they chose **show me the options**, also ask:

4. **A short name** for the folder: lowercase, words joined with hyphens,
   like `plant-tracker`.
5. **A 2 or 3 letter code** for its AI commands, like `pt`.
6. If they will share it: **should the tool's own files be locked**, so an
   AI cannot change the tool itself while fixing one piece of data? This
   lock only works in Claude Code.

### Step 5: Choose, and confirm

Turn their answers into settings with this table:

| Their answer | `--profile` | `--stack` |
| --- | --- | --- |
| a. a page in the browser | `page` | `static` (no install needed) |
| b. a dashboard with buttons | `panel` | `node` |
| c. commands in a terminal | `cli` | `node` |
| d. runs all the time | `app` | `node` |

- Someone else will use it: add `--shared`. If they said yes to locking,
  add `--guard` too.
- No name given: make a short one from what it does.
- No code given: use the first letter of each word in the name.
- **Purpose**: one sentence, in their words, saying what it does and for
  whom.

**Not sure between a and c?** Recommend **a**. A page needs nothing
installed and anyone can open it.

**They want a language tool-techne has no stack for yet** (Python, Go and
others)? Say so plainly. Offer the nearest stack, or `--profile cli` with
`--stack node` as a starting shell they replace later. Python is planned.

Show the choices back to them as a short list, in plain words, and ask for
a yes. For example:

> - Name: plant-tracker
> - What it is: a page you open in your browser
> - What it does: Reminds me which plants need water this week.
> - Only you will use it

### Step 6: Make it

From inside the `tool-techne` folder, run:

```
node scripts/new-tool.mjs --name <name> --profile <profile> --stack <stack> --prefix <code> --title "<Title>" --purpose "<one sentence>"
```

Add `--shared` and `--guard` if they apply. To preview without writing
anything, add `--dry-run`.

Read what it prints:

- **Ends with `Standard check: OK`**: done. Tell them in plain words what
  was made and where.
- **`Stopped:`** at the start: the message says what to change. Fix that
  setting and run it again.
- **`FAIL first commit`**: git needs their name and email. Go back to
  Step 2.
- Anything else: show them the lines marked FAIL, and explain each one.

### Step 7: Write down what they decided

The new folder has documents with placeholders in square brackets. Fill in
only what they told you. Leave the rest in brackets. Never invent content.

- `ROADMAP.md`, under **Decisions**: each choice from Step 5, with their
  reason if they gave one.
- `README.md`: the "Start it" section.
- `AGENTS.md`: any rule they want every AI to follow in this tool.

### Step 8: Hand over

Tell them:

1. Open the new folder in their AI assistant (or, in chat mode, start a new
   chat and paste in the new folder's `AGENTS.md`).
2. Say "Read AGENTS.md, then help me build the first feature."
3. Next time they want a tool, come back to the `tool-techne` folder and
   start again from the top of this file. It can be used for any number of
   tools.

Then commit the filled-in documents in the new folder (editor mode), with a
message like "Record first decisions".
