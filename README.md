# Product Studio

**Multi-brand AI e-commerce product photography.** Upload real photographs of a product, and generate clean, accurate, catalogue-ready images — each one an individual file, exactly 1500 × 1500 px, on a pure `#FFFFFF` background.

The reference images are the source of truth. The engine reproduces the actual product; it never redesigns it, and it makes no assumptions about which brand the product belongs to.

---

## Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [How it works](#how-it-works)
- [Category shot presets](#category-shot-presets)
- [Reference roles and hierarchy](#reference-roles-and-hierarchy)
- [Output guarantees](#output-guarantees)
- [File naming](#file-naming)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Production build & deployment](#production-build--deployment)
  - [One-click: Render](#one-click-render)
  - [Docker](#docker-anywhere-else)
- [Security](#security)
- [Extending](#extending)
- [Troubleshooting](#troubleshooting)

---

## What it does

1. **Upload references** — supplier shots, phone photos, flat lays, front, back, detail, logo, embroidery and colour references. Assign a role to each one (or let the app work it out), and reorder them to set priority.
2. **Confirm the category** — detected automatically from the images, always overridable from a dropdown.
3. **Add instructions** — free text that overrides everything the engine infers (`"Pocket must have exactly one button."`, `"Do not include the paper hang tag."`).
4. **Generate** — each requested shot is a **separate** API call with its own layered prompt. Images appear as soon as they finish, not when the whole set finishes.
5. **Review** — every card can be regenerated (with an optional correction note), replaced, deleted, approved or downloaded on its own. Previous versions stay accessible until you approve a new one.
6. **Download** — individually, or as a ZIP containing only the individual images.

Never a collage. Never a 2 × 2 grid. Four requested images means four separate files.

---

## Quick start

**Requirements:** Node.js 20.9+ and an OpenAI API key with access to the image model.

```bash
git clone <your-repo-url> product-studio
cd product-studio

npm install

cp .env.example .env.local
# open .env.local and set OPENAI_API_KEY

npm run dev
```

Open <http://localhost:3000>.

A banner at the top of the page tells you whether the key was picked up. Run `npm run verify` at any time to exercise the image pipeline, presets, naming and prompt engine offline — it needs no API key and makes no network calls.

---

## Environment variables

Everything lives in `.env.local` (never committed). `.env.example` is the documented template.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | **Required.** Server-side only. |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2` | Image generation / editing model. Change this to move to a newer model without touching code. |
| `OPENAI_VISION_MODEL` | `gpt-4.1-mini` | Used for category detection and the accuracy check. |
| `OPENAI_BASE_URL` | — | Custom endpoint (Azure, proxy, gateway). |
| `OPENAI_ORG_ID` / `OPENAI_PROJECT_ID` | — | Optional scoping. |
| `OPENAI_IMAGE_SIZE` | `1024x1024` | Native square size requested from the API before post-processing. |
| `OPENAI_IMAGE_QUALITY` | `high` | `low` \| `medium` \| `high` \| `auto`. |
| `OPENAI_TIMEOUT_MS` | `180000` | Per-request timeout. |
| `GENERATION_CONCURRENCY` | `3` | Server-side concurrency hint. |
| `OUTPUT_SIZE` | `1500` | Final canvas. Every delivered file is `OUTPUT_SIZE` × `OUTPUT_SIZE`. |
| `WHITE_CLEANUP_ENABLED` | `true` | Toggle background whitening. |
| `WHITE_CLEANUP_THRESHOLD` | `247` | Pixels brighter than this **and** connected to the border snap to pure white. |
| `MAX_REFERENCE_IMAGES` | `12` | Per session. |
| `MAX_REFERENCE_BYTES` | `20000000` | Per file. |
| `SESSION_TTL_MS` | `10800000` | How long uploaded references and results are retained. |

> The image model is read only from `OPENAI_IMAGE_MODEL`. `input_fidelity` is sent only to models that accept it (`gpt-image-1`, `gpt-image-1.5`, `gpt-image-1-mini`); `gpt-image-2` handles reference images at high fidelity natively.

---

## How it works

### The prompt is layered, and the layers are always the same

Every generation is assembled from ordered blocks in `src/lib/prompts.ts`:

```
1. MASTER PRODUCT FIDELITY PROMPT   identical for every product and brand
2. LOGO / TEXT ACCURACY             Normal | High (default) | Critical
3. REFERENCE MANIFEST + HIERARCHY   what each uploaded image governs
4. CATEGORY PROMPT                  garment / footwear / beauty specifics
5. SHOT PROMPT                      this single frame only
6. TECHNICAL OUTPUT REQUIREMENTS    one image, pure white, square, uncropped
7. NEGATIVE CONSTRAINTS             what must never appear
8. USER INSTRUCTIONS                product-level, then shot-level
9. CORRECTION NOTE                  regeneration / QC retry only
```

The master prompt tells the model, in substance: *use all uploaded references as the source of truth; reproduce the same actual product rather than a similar one; preserve its real colour, proportions, construction, stitching, material, embroidery, graphics, labels, logos, typography, pocket placement, buttons and hardware; invent, remove, move and redesign nothing; and when references disagree, prefer dedicated detail references for details, dedicated colour references for colour, and the clearest source for construction.*

### The generation pipeline

```
upload & validate references
      ↓
detect / confirm category  →  resolve shot preset
      ↓
for each shot, independently:
      build layered prompt
      call the Image API (edits when references exist, n = 1, PNG out)
      ↓
      snap border-connected near-white pixels to #FFFFFF
      proportional contain-resize onto an exact 1500×1500 white canvas
      adaptive compression to the selected quality band
      ↓
      optional Product Accuracy Check
      one corrective retry maximum, never a loop
      ↓
      store, return, and render the card immediately
```

### Product Accuracy Check

On by default. Each finished image is compared against the references for wrong colour, missing or misspelled logos, incorrect artwork or embroidery, missing neck labels, wrong button or pocket counts, wrong pattern, invented elements, wrong sleeve length, wrong shape, cropping, non-white background, poor resolution and wrong dimensions.

Pure-white corners and exact canvas dimensions are measured **in code**, not asked of a model. If a critical check fails, the shot is regenerated exactly once with a corrective prompt naming the specific faults; the better of the two results is kept. After that, the image and its report are shown to you — there is no endless retry loop.

### Model consistency

When a set contains both a model-front and a model-back shot, the front is generated first and the finished image is then passed as an **additional, last-ranked** reference for the back request, purely for model identity, body proportions, skin tone and lighting. Product references always outrank it, and the shot prompt explicitly forbids copying the front construction onto the back.

---

## Category shot presets

| Category | Default shots | Model? |
| --- | --- | --- |
| T-shirts, polos, shirts, sweatshirts, hoodies, jackets, dresses, skirts, trousers | Model Front · Product Front · Model Back · Detail Close-up | yes |
| Shorts, Swim Shorts | Product Front · Product Back (identical product scale) | no |
| Bikini, Swimwear | Product Front · Product Back | no |
| Sneakers, Shoes, High Heels, Sandals | Hero 3/4 · Side Profile · Rear · Detail | no |
| Perfume, Beauty | Hero · 3/4 · Secondary · Detail | no |
| Handbag, Accessories | Hero 3/4 · Front · Back · Detail | no |
| Other Product | Hero 3/4 · Side · Rear · Detail | no |

Every preset can be overridden. The **Advanced shot builder** lets you add, remove, relabel and reorder shots from the full catalogue: Model Front/Back/¾, Product Front/Back/Side/¾, Flat Lay, Ghost Mannequin, Close-up, Logo Detail, Embroidery Detail, Pocket Detail, Collar Detail, Fabric Detail, Shoe Side, Shoe Rear, Perfume Hero and Custom. Each shot also takes its own free-text instruction.

Categories that default to product-only offer a **Use a human model** toggle (except bikini and swimwear, which are always product-only); apparel categories can drop the model the same way.

---

## Reference roles and hierarchy

Roles: `General`, `Front`, `Back`, `Detail`, `Logo / Embroidery`, `Colour`, `Construction`, `Pose / Composition`.

Resolution order, enforced in both the prompt and the order references are sent:

1. Written user instructions override every automatic inference.
2. Detail / logo references govern logos, embroidery, text and small construction.
3. Colour references govern colour **only** — nothing else is taken from them.
4. Front references govern the front; back references govern the back.
5. General references supply everything else.
6. Pose references influence framing and pose only.

Reference order is also biased per shot — a back shot promotes back and construction references, a detail shot promotes logo and detail references — while respecting your manual ordering within each tier. Backgrounds, props, models and styling from reference photos are explicitly excluded: only the product is reproduced.

---

## Output guarantees

- **Exactly `1500 × 1500`**, 1:1, every file, regardless of what the API returns natively.
- **Pure `#FFFFFF`.** Near-white pixels connected to the image border are snapped to `255,255,255`. Interior near-white areas are deliberately left alone, so a white shirt on white keeps its edges, folds and texture instead of dissolving. A safety valve aborts the fill if it would consume more than 93 % of the frame.
- **Never stretched, never cropped.** Proportional contain-resize, centred, padded with white.
- **Adaptive compression.** `Optimized` (default) walks a quality ladder from 90 down to a floor of 78 and stops as soon as it lands under ~700 KB — typically 300–700 KB for a 1500 × 1500 JPEG. `High` never goes below 89. `Maximum` is quality 100. JPEGs use 4:4:4 chroma so coloured logo text stays crisp; detail is never sacrificed to hit a byte target.
- **Formats:** JPEG (default), WebP, PNG.

---

## File naming

Set an optional SKU / Oracle / product code, then pick a mode.

**Numeric**

```
FA0971687.jpg
FA0971687_1.jpg
FA0971687_2.jpg
FA0971687_3.jpg
```

**Descriptive**

```
FA0971687_model-front.jpg
FA0971687_product-front.jpg
FA0971687_model-back.jpg
FA0971687_detail.jpg
```

Two-image sets (shorts, swimwear) become `FA0971687_front.jpg` / `FA0971687_back.jpg`. Without a code, files fall back to `product…`. Names inside a ZIP are de-duplicated automatically.

---

## Project structure

```
src/
  app/
    layout.tsx                    root layout + metadata
    page.tsx                      server component; passes non-secret config down
    globals.css                   Tailwind v4 theme and tokens
    api/
      health/route.ts             config probe (never returns the key)
      upload/route.ts             POST references · DELETE one reference
      detect/route.ts             automatic category detection
      generate/route.ts           generate ONE shot
      zip/route.ts                ZIP of the individual images
      image/
        replace/route.ts          swap a shot for a user-supplied image
        [sessionId]/[imageId]/    serve · download · delete a result
  components/
    Studio.tsx                    top-level client orchestrator
    ReferencePanel.tsx            drag-and-drop upload, roles, reordering
    SettingsPanel.tsx             category, instructions, fidelity, output
    ShotBuilder.tsx               presets + advanced shot builder
    ResultCard.tsx                per-shot status, actions, history, QC report
    ui.tsx                        buttons, fields, toggles, badges
  lib/
    config.ts                     all env access, in one place
    types.ts                      shared domain types (isomorphic)
    categories.ts                 category catalogue + presets
    shots.ts                      shot catalogue + identity linking
    prompts.ts                    the layered prompt engine
    naming.ts                     deterministic file naming
    store.ts                      in-memory session store (swappable)
    pipeline.ts                   per-shot orchestration + QC + retry
    image/process.ts              Sharp: whitening, canvas, compression
    openai/
      client.ts                   SDK singleton + error normalisation
      imageService.ts             the ONLY model-specific module
      vision.ts                   category detection + accuracy check
    client/api.ts                 typed browser fetch helpers
scripts/
  verify-pipeline.ts              offline test suite (no API key needed)
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on :3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | Offline suite: pipeline, presets, naming, prompt layers |

---

## Production build & deployment

### One-click: Render

The repo ships a [`render.yaml`](./render.yaml) blueprint — an always-on Docker
web service, pinned to a single instance, with a health check on `/api/health`.

1. Push this branch to your GitHub account (it is already there).
2. In Render, choose **New → Blueprint** and point it at the repository.
3. Set `OPENAI_API_KEY` in the dashboard when prompted. It is marked
   `sync: false`, so the key is never committed to git.
4. Deploy. Render builds the Dockerfile and gives you a URL.

Stay on a paid instance type. Free instances sleep when idle and are torn down
mid-request, which kills a generation halfway through.

### Docker, anywhere else

```bash
docker build -t product-studio .
docker run --rm -p 3000:3000 -e OPENAI_API_KEY=sk-... product-studio
```

The image is a multi-stage build on `node:22-slim`: Debian ships the glibc
libvips binaries `sharp` expects, and the runtime stage carries only the
standalone server output — no build toolchain, no devDependencies — running as
an unprivileged user.

### From source

```bash
npm ci
npm run build
npm start          # PORT=3000 by default
```

The app is a standard Next.js App Router project and runs anywhere Node 20.9+ runs — Fly, Render, Railway, a container, a VM.

**Pick a host that runs one long-lived Node process.** Uploaded references and generated results live in that process's memory (see below), so the app wants a persistent server, not per-request serverless functions.

Three deployment notes:

- **Sessions are in-process.** References and results live in memory for `SESSION_TTL_MS`. That is the right trade-off for a single instance, and it is why a split-per-request serverless platform is a poor fit: `/api/upload` can store the session on one instance while `/api/generate` runs on another, and every generation then fails with *"This upload session has expired."* On such a platform, either enable sticky sessions or replace `src/lib/store.ts` with a Redis/S3/database implementation — no other module touches storage.
- **Give image generation a long timeout.** One shot routinely takes 30–120 seconds, and a corrective retry doubles it. `/api/generate` declares `maxDuration = 300`, which needs a plan that actually permits five-minute requests — the default 10–60 second function limit on entry-level serverless tiers will cut generations off mid-flight.
- **`sharp` is a native module.** It is already declared in `serverExternalPackages`. On Alpine images install `vips-dev`, or use a Debian-based Node image.

For a first deployment, a small always-on container (Railway, Render, Fly, or any VM running `npm start` behind a reverse proxy) is the least surprising choice.

---

## Also in this repository: the Product Image Formatter

[`formatter/`](./formatter) is a separate, self-contained browser tool — one
HTML file, no dependencies, no server, no API key. It reformats product photos
you **already have**: whitens the background, fits each one onto an exact square
canvas, applies SKU-based filenames, and hands back the batch as a ZIP.

Open `formatter/index.html` and it runs. It is the right tool when a supplier
sent usable photographs and they simply need to meet a marketplace's format
rules; the generator above is for when you need photographs that do not exist
yet. The two share no code and neither depends on the other.

`.github/workflows/pages.yml` publishes that directory — and only that
directory — to GitHub Pages.

---

## Security

- The API key is read only in `src/lib/config.ts`, which is marked `server-only`. It never reaches the browser bundle, never appears in a response, and never appears in a log line.
- `/api/health` reports whether a key is present — never the key or any prefix of it.
- Uploads are validated for MIME type, byte size, count and decodability before anything is stored.
- Every request body is normalised and clamped server-side; category, shot type, role, format, quality and naming values are all validated against allow-lists rather than trusted.
- Generated images are served from session-scoped URLs with `Cache-Control: private`.
- Baseline security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) are set in `next.config.ts`.
- `robots` is set to `noindex`.

There is no built-in authentication — this is an internal tool. Put it behind your own SSO, a reverse proxy or platform access control before exposing it publicly.

---

## Extending

**Move to a newer image model.** Change `OPENAI_IMAGE_MODEL`. If the new model needs different parameters, `src/lib/openai/imageService.ts` is the only file to touch.

**Add a product category.** Add an entry to `CATEGORY_DEFINITIONS` in `src/lib/categories.ts` and a category prompt in `CATEGORY_PROMPTS` in `src/lib/prompts.ts`. The dropdown, presets and detection list update themselves.

**Add a shot type.** Add an entry to `SHOT_DEFINITIONS` in `src/lib/shots.ts` and a `case` in `shotPrompt()` in `src/lib/prompts.ts`.

**Creative Campaign mode.** The architecture is already in place: `settings.mode` is threaded through the pipeline and read in `technicalPrompt()`. The MVP keeps the strict e-commerce rules — extend that branch when you want styled campaign imagery.

**Persistent storage.** Replace `src/lib/store.ts`. Its exported functions are the entire storage contract.

---

## Troubleshooting

**"OPENAI_API_KEY missing" banner.** `.env.local` must exist at the project root and the dev server must be restarted after editing it.

**403 from OpenAI.** Your project does not have access to the configured image model. Check `OPENAI_IMAGE_MODEL` and your organization's model access. Some organizations must complete identity verification before image models are enabled.

**A shot times out.** Raise `OPENAI_TIMEOUT_MS`, or lower `OPENAI_IMAGE_QUALITY`. Individual shots can be regenerated without touching the rest of the set.

**Background is not pure white.** Raise `WHITE_CLEANUP_THRESHOLD` toward 252 for a more aggressive fill, or lower it if a light-coloured product is being eaten. The accuracy check flags this as critical and triggers the corrective retry automatically.

**Files are too large / too small.** Switch the quality control between Optimized, High and Maximum, or tune the ladders in `QUALITY_PROFILES` in `src/lib/image/process.ts`.

**Session expired.** References are held for `SESSION_TTL_MS` (3 hours by default). Re-upload, or raise the value.
