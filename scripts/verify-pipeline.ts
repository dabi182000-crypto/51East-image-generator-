/**
 * Offline smoke test for the output pipeline and the prompt engine.
 *
 * Makes no network calls and needs no API key — it synthesises images that
 * mimic what the model returns (off-white backgrounds, non-square framing,
 * white-on-white products) and asserts the delivered files meet every hard
 * requirement: exact square canvas, pure #FFFFFF corners, sane file size,
 * correct naming, and a complete layered prompt.
 *
 *   npm run verify
 */

import assert from "node:assert/strict";
import sharp from "sharp";
import { processGeneratedImage, measureCornerWhiteness } from "../src/lib/image/process";
import { buildPrompt } from "../src/lib/prompts";
import { buildFileName } from "../src/lib/naming";
import { buildPresetShots } from "../src/lib/shots";
import { CATEGORY_DEFINITIONS, presetShots } from "../src/lib/categories";
import { PRODUCT_CATEGORIES } from "../src/lib/types";
import type { GenerationSettings, ReferenceImage } from "../src/lib/types";

const OUT = Number(process.env.OUTPUT_SIZE ?? 1500);

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL ${name}\n       ${(error as Error).message}`);
  }
}

/** A near-white (250,250,250) background with a coloured product blob. */
async function fakeGeneration(width: number, height: number, bg = 250) {
  const blob = await sharp({
    create: {
      width: Math.round(width * 0.5),
      height: Math.round(height * 0.5),
      channels: 3,
      background: { r: 32, g: 96, b: 60 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: { width, height, channels: 3, background: { r: bg, g: bg, b: bg } },
  })
    .composite([{ input: blob, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** A white product on a near-white background — the hardest case. */
async function whiteOnWhite(size = 1024) {
  const svg = Buffer.from(
    `<svg width="${size}" height="${size}">
       <rect width="100%" height="100%" fill="#fafafa"/>
       <rect x="${size * 0.25}" y="${size * 0.2}" width="${size * 0.5}" height="${size * 0.6}"
             rx="24" fill="#ffffff" stroke="#e2e2e2" stroke-width="3"/>
     </svg>`
  );
  return sharp(svg).png().toBuffer();
}

const SETTINGS: GenerationSettings = {
  category: "swim-shorts",
  productInstructions: "Pocket must have exactly one button. Do not include the paper hang tag.",
  accuracyPriority: "critical",
  quality: "optimized",
  format: "jpeg",
  namingMode: "numeric",
  productCode: "FA0971687",
  accuracyCheck: true,
  modelConsistency: true,
  useModel: false,
  mode: "ecommerce",
};

async function main() {
  console.log("\nOutput pipeline\n");

  await test(`landscape input is padded to exactly ${OUT}x${OUT}`, async () => {
    const raw = await fakeGeneration(1536, 1024);
    const result = await processGeneratedImage(raw, { format: "jpeg", quality: "optimized" });
    assert.equal(result.width, OUT);
    assert.equal(result.height, OUT);
  });

  await test("near-white background is snapped to pure #FFFFFF", async () => {
    const raw = await fakeGeneration(1024, 1024, 250);
    const result = await processGeneratedImage(raw, { format: "jpeg", quality: "optimized" });
    const { pureWhite, samples } = await measureCornerWhiteness(result.data);
    assert.ok(pureWhite, `corners were ${JSON.stringify(samples)}`);
  });

  await test("white product on white background is preserved, not erased", async () => {
    const raw = await whiteOnWhite();
    const result = await processGeneratedImage(raw, { format: "png", quality: "maximum" });
    const { data, info } = await sharp(result.data).removeAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
    // The product outline must still exist somewhere in the interior.
    let nonWhite = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) nonWhite++;
    }
    assert.ok(nonWhite > 500, `only ${nonWhite} non-white pixels survived`);
  });

  await test("optimized JPEG lands in a sensible size band", async () => {
    const raw = await fakeGeneration(1024, 1024);
    const result = await processGeneratedImage(raw, { format: "jpeg", quality: "optimized" });
    assert.ok(result.bytes < 900 * 1024, `${Math.round(result.bytes / 1024)} KB is too large`);
    assert.ok(result.encoderQuality !== undefined && result.encoderQuality >= 78);
  });

  await test("front and back are padded to an identical canvas", async () => {
    const front = await processGeneratedImage(await fakeGeneration(1024, 1024), {
      format: "jpeg",
      quality: "optimized",
    });
    const back = await processGeneratedImage(await fakeGeneration(1024, 1024), {
      format: "jpeg",
      quality: "optimized",
    });
    assert.equal(front.width, back.width);
    assert.equal(front.height, back.height);
  });

  await test("webp and png outputs are also exact squares", async () => {
    for (const format of ["webp", "png"] as const) {
      const result = await processGeneratedImage(await fakeGeneration(900, 1200), {
        format,
        quality: "high",
      });
      assert.equal(result.width, OUT, `${format} width`);
      assert.equal(result.height, OUT, `${format} height`);
    }
  });

  console.log("\nShot presets\n");

  await test("shorts default to two product-only shots", () => {
    assert.deepEqual(presetShots("swim-shorts", false), ["product-front", "product-back"]);
  });

  await test("t-shirts default to four individual shots", () => {
    const shots = presetShots("mens-tshirt", true);
    assert.equal(shots.length, 4);
    assert.deepEqual(shots, ["model-front", "product-front", "model-back", "close-up"]);
  });

  await test("footwear and perfume default to four product-only shots", () => {
    assert.equal(presetShots("sneakers", false).length, 4);
    assert.equal(presetShots("perfume", false).length, 4);
  });

  await test("no preset ever asks for the same shot twice", () => {
    for (const category of PRODUCT_CATEGORIES) {
      for (const useModel of [true, false]) {
        const shots = presetShots(category, useModel);
        assert.equal(
          shots.length,
          new Set(shots).size,
          `${category} (useModel=${useModel}) repeats a shot: ${shots.join(", ")}`
        );
      }
    }
  });

  await test("turning the model off on a model-first category keeps the image count", () => {
    // Categories that default to product-only (shorts, swimwear) legitimately
    // gain shots when a model is switched on; the reverse must not lose any.
    for (const def of CATEGORY_DEFINITIONS.filter((c) => c.defaultUsesModel)) {
      const withoutModel = presetShots(def.id, false);
      assert.equal(
        withoutModel.length,
        def.defaultShots.length,
        `${def.id}: ${def.defaultShots.length} shots with a model, ${withoutModel.length} without`
      );
    }
  });

  await test("model-back is linked to model-front for identity continuity", () => {
    const shots = buildPresetShots("mens-tshirt", true, true);
    const front = shots.find((s) => s.type === "model-front")!;
    const back = shots.find((s) => s.type === "model-back")!;
    assert.equal(back.identityFromShotId, front.id);
    assert.equal(front.identityFromShotId, undefined);
  });

  console.log("\nFile naming\n");

  await test("numeric naming produces CODE, CODE_1, CODE_2, CODE_3", () => {
    const shots = buildPresetShots("mens-tshirt", true, true);
    const names = shots.map((shot) =>
      buildFileName({
        shot,
        allShots: shots,
        productCode: "FA0971687",
        namingMode: "numeric",
        format: "jpeg",
      })
    );
    assert.deepEqual(names, [
      "FA0971687.jpg",
      "FA0971687_1.jpg",
      "FA0971687_2.jpg",
      "FA0971687_3.jpg",
    ]);
  });

  await test("descriptive naming uses shot slugs", () => {
    const shots = buildPresetShots("mens-tshirt", true, true);
    const names = shots.map((shot) =>
      buildFileName({
        shot,
        allShots: shots,
        productCode: "FA0971687",
        namingMode: "descriptive",
        format: "jpeg",
      })
    );
    assert.deepEqual(names, [
      "FA0971687_model-front.jpg",
      "FA0971687_product-front.jpg",
      "FA0971687_model-back.jpg",
      "FA0971687_detail.jpg",
    ]);
  });

  await test("two-image shorts sets use _front / _back", () => {
    const shots = buildPresetShots("swim-shorts", false, true);
    const names = shots.map((shot) =>
      buildFileName({
        shot,
        allShots: shots,
        productCode: "FA0971687",
        namingMode: "descriptive",
        format: "jpeg",
      })
    );
    assert.deepEqual(names, ["FA0971687_front.jpg", "FA0971687_back.jpg"]);
  });

  console.log("\nPrompt engine\n");

  const references: ReferenceImage[] = [
    { id: "a", name: "front.jpg", mimeType: "image/jpeg", bytes: 1, width: 1, height: 1, role: "front", order: 0 },
    { id: "b", name: "logo.jpg", mimeType: "image/jpeg", bytes: 1, width: 1, height: 1, role: "logo", order: 1 },
    { id: "c", name: "colour.jpg", mimeType: "image/jpeg", bytes: 1, width: 1, height: 1, role: "color", order: 2 },
  ];
  const shots = buildPresetShots("swim-shorts", false, true);
  const prompt = buildPrompt({
    shot: shots[1],
    settings: SETTINGS,
    references,
    hasIdentityReference: false,
    correctionNote: "The back pocket flap is missing.",
  });

  await test("prompt contains every required layer", () => {
    for (const marker of [
      "SOURCE OF TRUTH",
      "LOGO AND TEXT ACCURACY — CRITICAL",
      "REFERENCE HIERARCHY",
      "CATEGORY — SWIM SHORTS",
      "SHOT — PRODUCT ONLY, BACK",
      "TECHNICAL OUTPUT REQUIREMENTS",
      "MUST NOT APPEAR",
      "ADDITIONAL PRODUCT INSTRUCTIONS",
      "CORRECTION",
    ]) {
      assert.ok(prompt.includes(marker), `missing layer: ${marker}`);
    }
  });

  await test("prompt forbids collages and demands pure white", () => {
    assert.ok(/never a collage/i.test(prompt));
    assert.ok(prompt.includes("#FFFFFF"));
    assert.ok(/Return exactly ONE photograph/.test(prompt));
  });

  await test("matched-scale rule is applied to swim shorts", () => {
    assert.ok(/EXACTLY the same product scale/.test(prompt));
  });

  await test("prompt carries no brand-specific assumptions", () => {
    for (const banned of ["MC2", "Saint Barth", "saintbarth"]) {
      assert.ok(!prompt.toLowerCase().includes(banned.toLowerCase()), `leaked: ${banned}`);
    }
  });

  await test("user instructions are included verbatim", () => {
    assert.ok(prompt.includes("Pocket must have exactly one button."));
    assert.ok(prompt.includes("The back pocket flap is missing."));
  });

  console.log(
    `\n${failed === 0 ? "PASS" : "FAIL"} — ${passed} passed, ${failed} failed\n`
  );
  process.exit(failed === 0 ? 0 : 1);
}

void main();
