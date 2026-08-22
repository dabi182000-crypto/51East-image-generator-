import "server-only";
import { config } from "@/lib/config";
import { getOpenAI, describeOpenAIError } from "./client";
import { PRODUCT_CATEGORIES } from "@/lib/types";
import type {
  AccuracyIssue,
  AccuracyReport,
  ProductCategory,
  ShotRequest,
} from "@/lib/types";
import { categoryLabel } from "@/lib/categories";

/**
 * Vision helpers: automatic category detection and the post-generation
 * Product Accuracy Check. Both are best-effort — if the vision model is
 * unavailable the pipeline degrades gracefully instead of failing the job.
 */

function dataUrl(buffer: Buffer, mime = "image/jpeg"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Tolerant JSON extraction: models occasionally wrap JSON in prose or fences. */
function parseJsonLoose<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

async function askVision(prompt: string, images: Buffer[]): Promise<string> {
  const client = getOpenAI();
  const response = await client.responses.create({
    model: config.openai.visionModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...images.map((img) => ({
            type: "input_image" as const,
            image_url: dataUrl(img),
            detail: "high" as const,
          })),
        ],
      },
    ],
  });
  return response.output_text ?? "";
}

// ---------------------------------------------------------------------------
// Category detection
// ---------------------------------------------------------------------------

const CATEGORY_LIST = PRODUCT_CATEGORIES.map((id) => `${id} (${categoryLabel(id)})`).join(", ");

export interface DetectedCategory {
  category: ProductCategory;
  confidence: number;
  reasoning: string;
}

export async function detectCategory(thumbnails: Buffer[]): Promise<DetectedCategory> {
  const prompt = `You are classifying a product for an e-commerce photography pipeline.

Look at every supplied reference photograph. They all show the SAME single product from different angles or in different levels of detail.

Choose exactly one category id from this list:
${CATEGORY_LIST}

Guidance:
- A close-fitting women's tee with visible waist shaping is "womens-fitted-tshirt"; a straight-cut women's tee is "womens-tshirt".
- Board shorts or trunks with a drawstring waistband are "swim-shorts"; non-swim shorts are "shorts".
- A two-piece swim set is "bikini"; a one-piece is "swimwear".
- Use "other" only when nothing else genuinely fits.

Respond with JSON only, no prose:
{"category":"<id>","confidence":<0-1 number>,"reasoning":"<one short sentence>"}`;

  try {
    const text = await askVision(prompt, thumbnails.slice(0, 6));
    const parsed = parseJsonLoose<DetectedCategory>(text);
    const valid =
      parsed && (PRODUCT_CATEGORIES as readonly string[]).includes(parsed.category)
        ? parsed
        : null;

    if (!valid) {
      return { category: "other", confidence: 0, reasoning: "Could not classify automatically." };
    }
    return {
      category: valid.category,
      confidence: Math.max(0, Math.min(1, Number(valid.confidence) || 0)),
      reasoning: String(valid.reasoning ?? "").slice(0, 300),
    };
  } catch (error) {
    return {
      category: "other",
      confidence: 0,
      reasoning: describeOpenAIError(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Product Accuracy Check
// ---------------------------------------------------------------------------

const CHECK_CODES = [
  "wrong-color",
  "missing-logo",
  "incorrect-logo-wording",
  "incorrect-chest-artwork",
  "incorrect-embroidery",
  "missing-neck-label",
  "incorrect-exterior-neck-tag",
  "incorrect-button-count",
  "incorrect-pockets",
  "wrong-pattern",
  "invented-elements",
  "wrong-sleeve-length",
  "wrong-garment-shape",
  "cropping",
  "background-not-white",
  "poor-resolution",
  "wrong-dimensions",
  "collage",
] as const;

interface RawCheck {
  passed?: boolean;
  issues?: Array<{ code?: string; severity?: string; detail?: string }>;
}

export interface AccuracyCheckArgs {
  referenceThumbs: Buffer[];
  generatedThumb: Buffer;
  shot: ShotRequest;
  category: ProductCategory;
  userInstructions?: string;
}

export async function runAccuracyCheck(args: AccuracyCheckArgs): Promise<AccuracyReport> {
  const prompt = `You are a strict quality-control reviewer for e-commerce product photography.

The FIRST ${args.referenceThumbs.length} image(s) are the REFERENCE photographs of the real product — they are the source of truth.
The LAST image is a GENERATED photograph that is supposed to show that exact same product.

Product category: ${categoryLabel(args.category)}
Requested shot: ${args.shot.label}${
    args.shot.instructions ? `\nShot instructions: ${args.shot.instructions}` : ""
  }${args.userInstructions ? `\nUser product instructions: ${args.userInstructions}` : ""}

Check the generated image against the references for these problems only:
${CHECK_CODES.join(", ")}

Rules for judging:
- Only report a problem you can actually SEE. Do not speculate.
- A different camera angle, a different pose, or the presence/absence of a model is NOT an error — only product fidelity and technical output matter.
- Details that are genuinely not visible from the requested angle are not "missing".
- Mark severity "critical" only for: wrong product colour, a missing or misspelled or invented logo, clearly wrong artwork or embroidery, clearly wrong pocket or button construction, invented product elements, a background that is not pure white, the product being cropped by the frame edge, or the image being a collage/grid.
- Everything else is "minor".

Respond with JSON only, no prose:
{"passed": <true|false>, "issues":[{"code":"<code>","severity":"critical|minor","detail":"<one sentence naming what is wrong and how to fix it>"}]}
"passed" is false only when at least one critical issue exists.`;

  try {
    const text = await askVision(prompt, [...args.referenceThumbs.slice(0, 5), args.generatedThumb]);
    const parsed = parseJsonLoose<RawCheck>(text);

    if (!parsed) {
      return { passed: true, issues: [], retried: false, skippedReason: "QC response unreadable." };
    }

    const issues: AccuracyIssue[] = (parsed.issues ?? [])
      .filter((i) => i && typeof i.detail === "string" && i.detail.trim().length > 0)
      .map((i) => ({
        code: String(i.code ?? "issue"),
        severity: i.severity === "critical" ? "critical" : "minor",
        detail: String(i.detail).slice(0, 400),
      }));

    const hasCritical = issues.some((i) => i.severity === "critical");
    return { passed: !hasCritical, issues, retried: false };
  } catch (error) {
    return {
      passed: true,
      issues: [],
      retried: false,
      skippedReason: describeOpenAIError(error),
    };
  }
}
