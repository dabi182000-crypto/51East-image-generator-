import { NextRequest, NextResponse } from "next/server";
import { assertServerConfig } from "@/lib/config";
import { ImageGenerationError } from "@/lib/openai/imageService";
import { runShot } from "@/lib/pipeline";
import { SessionNotFoundError } from "@/lib/store";
import {
  PRODUCT_CATEGORIES,
  REFERENCE_ROLES,
  SHOT_TYPES,
  type GenerationSettings,
  type ProductCategory,
  type ReferenceRole,
  type ShotRequest,
  type ShotType,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Image generation plus an optional corrective retry can be slow.
export const maxDuration = 300;

interface Body {
  sessionId?: string;
  shot?: Partial<ShotRequest>;
  allShots?: Array<Partial<ShotRequest>>;
  settings?: Partial<GenerationSettings>;
  references?: Array<{ id?: string; role?: string; order?: number }>;
  correctionNote?: string;
  identityImageId?: string;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function normaliseShot(raw: Partial<ShotRequest> | undefined, index: number): ShotRequest | null {
  if (!raw || typeof raw.id !== "string" || raw.id.length === 0) return null;
  const type = oneOf<ShotType>(raw.type, SHOT_TYPES, "product-front");
  return {
    id: raw.id,
    type,
    label: str(raw.label, `Shot ${index + 1}`).slice(0, 80),
    instructions: str(raw.instructions).slice(0, 2000) || undefined,
    customDescription: str(raw.customDescription).slice(0, 2000) || undefined,
    identityFromShotId: str(raw.identityFromShotId) || undefined,
  };
}

function normaliseSettings(raw: Partial<GenerationSettings> | undefined): GenerationSettings {
  return {
    category: oneOf<ProductCategory>(raw?.category, PRODUCT_CATEGORIES, "other"),
    productInstructions: str(raw?.productInstructions).slice(0, 4000),
    accuracyPriority: oneOf(raw?.accuracyPriority, ["normal", "high", "critical"] as const, "high"),
    quality: oneOf(raw?.quality, ["optimized", "high", "maximum"] as const, "optimized"),
    format: oneOf(raw?.format, ["jpeg", "webp", "png"] as const, "jpeg"),
    namingMode: oneOf(raw?.namingMode, ["numeric", "descriptive"] as const, "numeric"),
    productCode: str(raw?.productCode).slice(0, 64),
    accuracyCheck: raw?.accuracyCheck !== false,
    modelConsistency: raw?.modelConsistency !== false,
    useModel: Boolean(raw?.useModel),
    mode: oneOf(raw?.mode, ["ecommerce", "creative"] as const, "ecommerce"),
  };
}

/** Generate exactly ONE shot. The client calls this once per card. */
export async function POST(request: NextRequest) {
  try {
    assertServerConfig();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const shot = normaliseShot(body.shot, 0);
  if (!shot) {
    return NextResponse.json({ error: "A valid shot definition is required." }, { status: 400 });
  }

  const allShots = (body.allShots ?? [])
    .map((s, i) => normaliseShot(s, i))
    .filter((s): s is ShotRequest => Boolean(s));

  const settings = normaliseSettings(body.settings);

  const references = (body.references ?? [])
    .filter((r) => typeof r.id === "string")
    .map((r, i) => ({
      id: r.id as string,
      role: oneOf<ReferenceRole>(r.role, REFERENCE_ROLES, "general"),
      order: Number.isFinite(r.order) ? Number(r.order) : i,
    }));

  try {
    const result = await runShot({
      sessionId: body.sessionId,
      shot,
      allShots: allShots.length > 0 ? allShots : [shot],
      settings,
      referenceOrder: references,
      correctionNote: str(body.correctionNote).slice(0, 2000) || undefined,
      identityImageId: str(body.identityImageId) || undefined,
      signal: request.signal,
    });

    return NextResponse.json({ image: result.meta, prompt: result.prompt });
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ImageGenerationError) {
      return NextResponse.json({ error: error.userMessage }, { status: 502 });
    }
    console.error("[generate] unexpected failure", error);
    return NextResponse.json(
      { error: "Generation failed.", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
