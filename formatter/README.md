# Product Image Formatter

Batch-format product photos into listing-ready files: an exact square canvas, a
genuinely pure `#FFFFFF` background, and consistent SKU-based filenames.

It is a single HTML file with no dependencies and no build step. Everything —
decoding, background cleanup, resizing, encoding, and the ZIP — happens on a
canvas in the browser. **No photo is ever uploaded anywhere.**

## Use it

Open `index.html`. That is the whole installation.

- Double-click the file, or
- serve the folder (`python3 -m http.server`), or
- publish it (see *Hosting* below).

Then: drop in photos → set the SKU and canvas size → **Format** → save the files
individually or as one ZIP. Click any result to inspect its corner pixels.

## What it does to each photo

1. **Whiten.** A flood fill starts at the frame edge and snaps every connected
   near-white pixel (≥ 247 on all channels) to pure `#FFFFFF`. Near-white areas
   *enclosed* by the product — a white sole, a white label — are deliberately
   left alone, so a white garment keeps its edge definition instead of
   dissolving into the canvas. If more than 93% of the frame floods, the product
   itself is white and merged with the background, so the fill is abandoned
   rather than erasing the product.
2. **Fit.** The result is scaled proportionally and centred on an exact square
   white canvas, with an optional 4% margin. Never cropped, never stretched.
3. **Encode.** Quality steps down a ladder only until the file meets its size
   target, so fine detail survives instead of being compressed away to hit a
   byte count. `Optimized` aims for ≈300–700 KB; `High` and `Max` trade size for
   fidelity. PNG is always lossless.

Every result is measured after encoding: the four corners are sampled and
reported, so you can confirm the background really is `255,255,255` rather than
trusting that it is.

## Settings

| Setting | Notes |
| --- | --- |
| SKU / product code | Names every file. Leave blank to keep the original filenames. |
| Naming — Numeric | `FA0971687.jpg`, `FA0971687_1.jpg`, `FA0971687_2.jpg` … |
| Naming — Descriptive | `FA0971687_front.jpg` — the suffix comes from each photo's own filename. |
| Canvas size | 1000–2560 px square. 1500 suits Zalando and About You; 2000 suits Amazon and Shopify. |
| Format | JPEG, WebP or PNG. |
| Compression | `Optimized`, `High`, `Max`. |
| Whiten the background | Off leaves the photo's own background untouched; only the padding is white. |
| Breathing room | An even 4% margin around the product. |

Colliding filenames are de-duplicated automatically (`name-2.jpg`) before
anything is written, so a batch never silently overwrites itself.

## Hosting

Any static host works, because there is no server side. This repository already
carries the workflow: `.github/workflows/pages.yml` publishes **this directory
only** to GitHub Pages on every push to `main`. Turn it on once under
**Settings → Pages → Source: GitHub Actions**.

Note that GitHub Pages on a **private** repository requires a paid GitHub plan.
On a free plan the repository must be public for Pages to serve it. Nothing in
this tool phones home either way.

## Browser support

Needs `<canvas>`, `toBlob`, and `<dialog>` — any current Chrome, Edge, Firefox
or Safari. Which input formats decode is up to the browser: JPEG, PNG and WebP
are universal; HEIC works in Safari and in Chrome on recent macOS/Windows, and
is skipped with a message elsewhere.

## Related

The rest of this repository is the AI product-photography generator, which
writes *new* photographs of a product from reference images. That one needs an
OpenAI API key and a running Node server, and is deployed via `render.yaml` or
the `Dockerfile` at the repository root. This tool needs neither — it reformats
photos you already have.
