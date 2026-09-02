# Brand Upload Desk

A live tracker for the team uploading brands to the store from Excel sheets.
One supervisor, two upload specialists, one shared board.

**Live page:** https://claude.ai/code/artifact/bad6057a-bd45-4577-b4f1-bd0972e2f763

Share it from the page's share menu, give the other two **edit** access, and
everyone works on the same board.

## The stages

Each brand moves through seven stages, in order — each with its own emoji
so the board reads at a glance:

| # | Stage | Means |
|---|-------|-------|
| 01 | 🆕 New | The brand and its files have arrived. Nothing started yet. |
| 02 | 📊 Excel sheet | Building the sheet and matching its columns to the store. |
| 03 | 🖼️ Images | Product photos cropped, named and linked to the right rows. |
| 04 | ✅ Ready | Sheet checked over and ready to go up. |
| 05 | 🚀 Uploading | The import is running on the store right now. |
| 06 | 🔍 Checking | Supervisor going through the products that went live. |
| 07 | 🎉 Done | Live on the store and signed off. |

Plus **🚧 Blocked**, off to the side, for anything stuck waiting on the brand
or on somebody else — with a field for what it is waiting on.

Per brand: who's on it, urgency, due date, season (SS26, FW25, Year-round…),
products done out of total, a six-point checklist to tick before it goes
live, notes, and a full record of what happened. This is a status tracker —
it doesn't hold the actual files or images, just where things stand.

## Everything is one click

The stage, who's on it, and how many products are done are all editable
**straight in the list** — no need to open anything. Each row also has a
**next step** button showing where the brand goes next (`→ Images`,
`→ Ready`), so moving work along is a single tap. Click the row itself for
the rest of the detail.

The list is down to four columns — **Brand, Stage, % done, Next step** —
with owner, category, season and due date folded into the brand row as small
tags, so there's less to scan. The percentage done is the headline number on
every row, not a detail you have to hunt for.

**Just mine** filters the board to your own brands. **What do these mean?**
spells out every stage in plain words.

Reaching **Done** gets a little celebration toast — 🎉 it's live.

## How it stays live

Data lives in the artifact's shared database, so a change one person makes
appears on the other two screens within a second — no refresh, no re-sending
the file. The top bar shows who else has it open, and a row says
"… has this open" when a teammate is inside that brand, so two people don't
overwrite each other. Whoever saves last wins.

## Signing in with a PIN

Each teammate has their own PIN. Tap your name, then enter it on the number
pad — get it right and you're in, get it wrong and it shakes and clears for
another go. It's remembered in your browser after that. Mahmoud (E-com
Specialist) is set up with PIN **0152300**; set PINs for the others from the
⚙ menu — leave a PIN blank to let that person in with just a tap.

This isn't real account security — it's there so edits are correctly
attributed, not to keep anyone out who has the link. Don't use it to protect
anything sensitive.

## Getting your brands in and out

**+ Add brands** takes a paste straight out of Excel. Copy the cells and
paste; columns are read as brand name, then how many products, then category
(the last two optional) — set season from the row or the detail panel
afterwards. A plain list of names works too. **Export to Excel** sends the
whole board — filters applied, season and PIN-signed history included — back
out as a CSV.

## Views

- **List** — the main table, sortable by stage, due date, recently changed,
  least finished, or A–Z. Stacks into cards on a phone.
- **Board** — the same brands in columns per stage, to see where work is
  piling up.
- **Recent changes** — every change by everyone, newest first, by day.

## Changing the file

The whole tracker is `brand-upload-tracker.html` — one file, no build step.
Edit it and republish to the same URL to update the live page for everyone.
