# Brand Upload Desk

A dead-simple shared tracker for the brands going up on the store.

**Live page:** https://claude.ai/code/artifact/bad6057a-bd45-4577-b4f1-bd0972e2f763

Share it from the page's share menu, give the team edit access, and everyone
works on the same list — no accounts, no sign-in, just open the link.

## What it is

Per brand: a name, who's on it, its season, one of three stages, and a
percentage.

- **Starting** — nothing done yet
- **In progress** — being worked on
- **Uploaded** — live on the store (jumps to 100% automatically)

Click a name to rename it, click "by ..." to credit whoever's doing it,
click the season pill to set it (SS26, FW25, Year-round...), click a stage
button to move it, type a number to set the percentage. That's the whole
tool.

## Adding brands

Type a name in the box and hit Enter, or paste a list of names (one per
line) to add several at once.

## Saving

There's no save button and no account to sign into. Every change writes
straight to the artifact's shared database the moment you make it, and it
shows up on everyone else's screen within a second. The "Saved
automatically" pill at the top confirms it's connected.

## About "linked to GitHub"

The tracker's **code** lives in this repo (`tracker/brand-upload-tracker.html`)
and gets deployed by publishing it as an artifact — that part is exactly
"linked to GitHub."

The **data** (the brand list itself) is a different matter. This page runs
in everyone's browser with no server behind it, so having it commit rows to
GitHub on every edit would mean embedding a GitHub access token in a page
anyone with the link can open — which would hand that token to anyone who
looks. That's not something to build, so the data is kept in the artifact's
own shared, auto-saving database instead. It updates live for everyone with
the link and needs nothing to log into — functionally the same "just works,
never lose it" outcome as auto-saving to GitHub, without shipping a
credential to every viewer's browser.

## Changing the file

The whole tracker is `brand-upload-tracker.html` — one file, no build step.
Edit it and republish to the same URL to update the live page for everyone.
