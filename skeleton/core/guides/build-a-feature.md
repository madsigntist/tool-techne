# Build a feature

The steps any AI assistant follows to add something to this tool. Follow
them in order, one at a time, and show the person each result.

## 1. Say what it does, in plain words

Write two or three sentences with the person: what they will be able to do
afterward, and how they will know it works. For example: "I can add a
plant with how often it needs water. The page lists the plants due today
at the top."

Ask about anything you would otherwise guess. If the feature needs
something this kind of tool cannot do (a page cannot act while it is
closed), say so now, before any code.

## 2. Write down how you will check it

Before writing the feature, add a test that fails because the feature is
not there yet. Run the tests and show the person it fails. A test that
passes before the work is done is not testing the work.

If this kind of check cannot be automated (it is about how something
looks), write the exact steps the person will follow to check it by eye,
and add them to RUNBOOK.md.

## 3. Build the smallest version that passes

Change as little as you can. Follow AGENTS.md and the documents it points
to. Explain each change in a sentence as you make it.

## 4. Run the check

```
node scripts/check.mjs
```

It must end with "Everything passed." If it does not, fix the cause and run
it again. Never weaken a test or a check to get it to pass.

## 5. Show it working

Show the person the feature itself, not only the passing check: open the
page, run the command, or press the button, and show what it does.

## 6. Write down anything decided

If you and the person chose between options, add one line to ROADMAP.md
under Decisions, with the reason. If something broke on the way and you
fixed its cause, add a row to DEFECT-REGISTER.md.

## 7. Commit

```
git add -A
git commit -m "<what the person can now do>"
```

The pre-commit hook checks the commit for passwords and keys before saving
it. Tell the person the commit is a saved point they can go back to.
