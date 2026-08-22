import "server-only";
import { config } from "./config";
import { buildCorrectionNote, buildPrompt } from "./prompts";
import { generateProductImage, type ReferencePayload } from "./openai/imageService";
import { runAccuracyCheck } from "./openai/vision";
import {
  makeThumbnail,
  measureCornerWhiteness,
  prepareReferenceForApi,
  processGeneratedImage,
} from "./image/process";
import {
  addResult,
  getResult,
  newId,
  requireSession,
  type StoredReference,
} from "./store";
import { buildFileName } from "./naming";
import { getShot } from "./shots";
import type {
  AccuracyReport,
  GeneratedImageMeta,
  GenerationSettings,
  ReferenceImage,
  ShotRequest,
} from "./types";

/**
 * The full server-side generation pipeline for ONE shot.
 *
 *  1. resolve + prepare reference images (cached per session)
 *  2. assemble the layered prompt
 *  3. call the Image API (edit when references exist, generate otherwise)
 *  4. whiten background -> pad to exact square -> adaptive compression
 *  5. optional Product Accuracy Check, with at most ONE corrective retry
 *  6. store and return metadata
 *
 * Each shot is an independent job. Nothing here ever asks the model for more
 * than one image, and no shot depends on another except for the optional
 * model-identity reference.
 */

export interface RunShotArgs {
  sessionId: string;
  shot: ShotRequest;
  /** All shots in the job — needed for deterministic file naming. */
  allShots: ShotRequest[];
  settings: GenerationSettings;
  /** Reference ids in the user's chosen order, with their assigned roles. */
  referenceOrder: Array<Pick<ReferenceImage, "id" | "role" | "order">>;
  correctionNote?: string;
  identityImageId?: string;
  signal?: AbortSignal;
}

export interface RunShotResult {
  meta: GeneratedImageMeta;
  prompt: string;
}

/** Ensure the API-ready and thumbnail derivatives exist, then cache them. */
async function ensureDerivatives(ref: StoredReference): Promise<StoredReference> {
  if (!ref.apiReady) ref.apiReady = await prepareReferenceForApi(ref.data);
  if (!ref.thumb) ref.thumb = await makeThumbnail(ref.data);
  return ref;
}

/**
 * Reference ordering communicates priority to the model. Roles that are
 * authoritative for fine detail are moved to the front so they carry the most
 * weight, while respecting the user's manual ordering inside each tier.
 */
const ROLE_PRIORITY: Record<ReferenceImage["role"], number> = {
  logo: 0,
  detail: 1,
  front: 2,
  back: 2,
  construction: 3,
  color: 4,
  general: 5,
  pose: 6,
};

function orderReferences(
  refs: StoredReference[],
  order: Array<Pick<ReferenceImage, "id" | "role" | "order">>,
  shot: ShotRequest
): StoredReference[] {
  const overrides = new Map(order.map((o) => [o.id, o]));

  for (const ref of refs) {
    const override = overrides.get(ref.meta.id);
    if (override) {
      ref.meta.role = override.role;
      ref.meta.order = override.order;
    }
  }

  const shotDef = getShot(shot.type);
  const wantsBack = /back|rear/.test(shot.type);
  const wantsDetail = shotDef.group === "Detail";

  return refs.slice().sort((a, b) => {
    const bias = (r: StoredReference) => {
      let p = ROLE_PRIORITY[r.meta.role];
      if (wantsBack && r.meta.role === "back") p -= 2;
      if (wantsBack && r.meta.role === "front") p += 1;
      if (wantsDetail && (r.meta.role === "detail" || r.meta.role === "logo")) p -= 1;
      return p;
    };
    const diff = bias(a) - bias(b);
    return diff !== 0 ? diff : a.meta.order - b.meta.order;
  });
}

export async function runShot(args: RunShotArgs): Promise<RunShotResult> {
  const started = Date.now();
  const session = requireSession(args.sessionId);

  const selected = args.referenceOrder
    .map((o) => session.references.get(o.id))
    .filter((r): r is StoredReference => Boolean(r));

  const pool = selected.length > 0 ? selected : [...session.references.values()];
  const ordered = orderReferences(pool, args.referenceOrder, args.shot);
  await Promise.all(ordered.map(ensureDerivatives));

  const payloads: ReferencePayload[] = ordered.map((ref, i) => ({
    data: ref.apiReady!,
    fileName: `reference-${i + 1}-${ref.meta.role}.png`,
  }));

  // Optional model-identity reference, always appended LAST so the product
  // references keep the dominant position.
  let hasIdentityReference = false;
  if (args.identityImageId) {
    const identity = getResult(args.sessionId, args.identityImageId);
    if (identity) {
      const identityPng = await prepareReferenceForApi(identity.data, 1024);
      payloads.push({ data: identityPng, fileName: "model-identity-reference.png" });
      hasIdentityReference = true;
    }
  }

  const referenceMetas: ReferenceImage[] = ordered.map((r) => r.meta);

  const basePrompt = buildPrompt({
    shot: args.shot,
    settings: args.settings,
    references: referenceMetas,
    hasIdentityReference,
    correctionNote: args.correctionNote,
  });

  const attempt = async (prompt: string) => {
    const generated = await generateProductImage({
      prompt,
      references: payloads,
      accuracyPriority: args.settings.accuracyPriority,
      signal: args.signal,
    });

    const processed = await processGeneratedImage(generated.data, {
      format: args.settings.format,
      quality: args.settings.quality,
    });

    return processed;
  };

  let processed = await attempt(basePrompt);
  let usedPrompt = basePrompt;
  let accuracy: AccuracyReport | undefined;

  if (args.settings.accuracyCheck) {
    const evaluate = (image: ProcessedOutput) =>
      evaluateAccuracy({
        image,
        ordered,
        shot: args.shot,
        settings: args.settings,
      });

    accuracy = await evaluate(processed);

    const critical = accuracy.issues.filter((i) => i.severity === "critical");

    // Exactly one automatic corrective retry — never a loop.
    if (!accuracy.passed && critical.length > 0) {
      try {
        const correctivePrompt = buildPrompt({
          shot: args.shot,
          settings: args.settings,
          references: referenceMetas,
          hasIdentityReference,
          correctionNote: [args.correctionNote, buildCorrectionNote(critical)]
            .filter(Boolean)
            .join("\n"),
        });

        const retried = await attempt(correctivePrompt);
        const secondReport = await evaluate(retried);

        // Keep the retry only when it did not make things worse.
        const before = critical.length;
        const after = secondReport.issues.filter((i) => i.severity === "critical").length;
        if (after <= before) {
          processed = retried;
          usedPrompt = correctivePrompt;
          accuracy = { ...secondReport, retried: true };
        } else {
          accuracy = { ...accuracy, retried: true };
        }
      } catch {
        // The retry failed outright: keep the first image and its report.
        accuracy = { ...accuracy, retried: true };
      }
    }
  }

  const fileName = buildFileName({
    shot: args.shot,
    allShots: args.allShots.length > 0 ? args.allShots : [args.shot],
    productCode: args.settings.productCode,
    namingMode: args.settings.namingMode,
    format: args.settings.format,
  });

  const meta: GeneratedImageMeta = {
    id: newId("img"),
    shotId: args.shot.id,
    shotType: args.shot.type,
    label: args.shot.label,
    fileName,
    format: processed.format,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
    url: "",
    createdAt: Date.now(),
    approved: false,
    accuracy,
    durationMs: Date.now() - started,
    previousVersionIds: [],
  };
  meta.url = `/api/image/${args.sessionId}/${meta.id}`;

  addResult(args.sessionId, { meta, data: processed.data });

  return { meta, prompt: usedPrompt };
}

type ProcessedOutput = Awaited<ReturnType<typeof processGeneratedImage>>;

interface EvaluateArgs {
  image: ProcessedOutput;
  ordered: StoredReference[];
  shot: ShotRequest;
  settings: GenerationSettings;
}

/**
 * Compare a delivered image against the references and against the hard
 * technical requirements. Deterministic checks (pure-white corners, exact
 * canvas size) are measured in code rather than trusted to a vision model.
 */
async function evaluateAccuracy(args: EvaluateArgs): Promise<AccuracyReport> {
  const report = await runAccuracyCheck({
    referenceThumbs: args.ordered
      .map((r) => r.thumb)
      .filter((t): t is Buffer => Boolean(t)),
    generatedThumb: await makeThumbnail(args.image.data),
    shot: args.shot,
    category: args.settings.category,
    userInstructions: args.settings.productInstructions,
  });

  const issues = report.issues.filter((i) => i.code !== "background-not-white");

  const { pureWhite } = await measureCornerWhiteness(args.image.data);
  if (!pureWhite) {
    issues.push({
      code: "background-not-white",
      severity: "critical",
      detail:
        "The background corners are not pure #FFFFFF. Render the product on a completely pure white background with no tint, gradient, texture or grey field.",
    });
  }

  const expected = config.output.size;
  if (args.image.width !== expected || args.image.height !== expected) {
    issues.push({
      code: "wrong-dimensions",
      severity: "minor",
      detail: `Delivered canvas is ${args.image.width}x${args.image.height} instead of ${expected}x${expected}.`,
    });
  }

  return {
    passed: !issues.some((i) => i.severity === "critical"),
    issues,
    retried: false,
    skippedReason: report.skippedReason,
  };
}
