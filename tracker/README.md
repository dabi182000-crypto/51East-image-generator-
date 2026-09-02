# Brand Upload Desk

A live tracker for the team uploading brands to the store from Excel sheets.
One supervisor, two upload specialists, one shared board.

**Live page:** https://claude.ai/code/artifact/bad6057a-bd45-4577-b4f1-bd0972e2f763

Share it from the page's share menu, give the other two **edit** access, and
everyone works on the same board.

## What it tracks

Each brand moves through seven stages, in order:

| # | Stage | Means |
|---|-------|-------|
| 01 | Intake | Catalogue and assets received from the brand |
| 02 | Sheet prep | Excel built, attributes mapped to store fields |
| 03 | Images | Product images cropped, named and linked |
| 04 | Ready to upload | Sheet validated, waiting for the import window |
| 05 | Uploading | Import running against the store |
| 06 | QC review | Supervisor checking the live rows |
| 07 | Live | Published and signed off |

Plus **Blocked**, off to the side, for anything waiting on the brand or on
someone else — with a field for what it is waiting on.

Per brand: owner, priority, deadline, SKU rows prepared out of total, a link to
the Excel sheet, a six-point QC checklist, notes, and a full change history.

## How it stays live

Data lives in the artifact's shared database, so a change one person makes
appears on the other two screens within a second — no refresh, no re-sending
the file. The top bar shows who else has the desk open, and a row shows
"… has it open" when a teammate is inside that brand, so two people do not
overwrite each other. Saves are last-write-wins.

Identity is a name you pick from the team list, kept in your browser. It signs
your edits and shows your initials to the others. It is not a login — anyone
with the link can pick any name — so it records who did what, it does not
restrict who can do what.

## Getting your brands in

**+ Add brands** takes a paste straight out of Excel. Copy the cells and paste;
columns are read as brand, SKU count, category, deadline (last three optional).
A plain list of names works too. **Export CSV** sends the whole board — filters
applied — back out to a sheet.

## Views

- **Pipeline** — the manifest table, sortable by stage order, deadline, last
  update, least complete, or name.
- **Board** — the same brands as columns per stage, for a glance at where the
  work is piled up.
- **Activity** — every change by everyone, newest first, grouped by day.

## Changing the file

The whole tracker is `brand-upload-tracker.html` — one file, no build step.
Edit it and republish to the same URL to update the live page for everyone.
