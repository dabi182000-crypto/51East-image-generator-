import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { processGeneratedImage } from "@/lib/image/process";
import { SessionNotFoundError, addResult, newId, requireSession } from "@/lib/store";
import { buildFileName } from "@/lib/naming";
import {
  SHOT_TYPES,
  type GeneratedImageMeta,
  type NamingMode,
  type OutputFormat,
  type QualityPreset,
  type ShotType,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Replace a generated shot with an image the user supplies themselves. The
 * upload goes through the identical output pipeline, so a hand-picked image is
 * still delivered as an exact square on pure white with the same naming.
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const sessionId = form.get("sessionId");
  const file = form.get("file");

  if (typeof sessionId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "sessionId and file are required." }, { status: 400 });
  }
  if (file.size > config.limits.maxReferenceBytes) {
    return NextResponse.json({ error: "That image is too large." }, { status: 400 });
  }

  try {
    requireSession(sessionId);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }

  const shotId = typeof form.get("shotId") === "string" ? (form.get("shotId") as string) : "manual";
  const shotType = oneOf<ShotType>(form.get("shotType"), SHOT_TYPES, "custom");
  const label = typeof form.get("label") === "string" ? (form.get("label") as string) : "Replaced";
  const format = oneOf<OutputFormat>(form.get("format"), ["jpeg", "webp", "png"] as const, "jpeg");
  const quality = oneOf<QualityPreset>(
    form.get("quality"),
    ["optimized", "high", "maximum"] as const,
    "optimized"
  );
  const namingMode = oneOf<NamingMode>(
    form.get("namingMode"),
    ["numeric", "descriptive"] as const,
    "numeric"
  );
  const productCode = typeof form.get("productCode") === "string" ? (form.get("productCode") as string) : "";
  const shotIndex = Number.parseInt(String(form.get("shotIndex") ?? "0"), 10) || 0;

  let processed;
  try {
    processed = await processGeneratedImage(Buffer.from(await file.arrayBuffer()), {
      format,
      quality,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "That file could not be processed as an image.", detail: (error as Error).message },
      { status: 400 }
    );
  }

  const shot = { id: shotId, type: shotType, label };
  const allShots = Array.from({ length: Math.max(shotIndex + 1, 1) }, (_, i) =>
    i === shotIndex ? shot : { id: `placeholder-${i}`, type: shotType, label: `Shot ${i + 1}` }
  );

  const meta: GeneratedImageMeta = {
    id: newId("img"),
    shotId,
    shotType,
    label,
    fileName: buildFileName({ shot, allShots, productCode, namingMode, format }),
    format: processed.format,
    width: processed.width,
    height: processed.height,
    bytes: processed.bytes,
    url: "",
    createdAt: Date.now(),
    approved: false,
    durationMs: 0,
    previousVersionIds: [],
  };
  meta.url = `/api/image/${sessionId}/${meta.id}`;

  addResult(sessionId, { meta, data: processed.data });

  return NextResponse.json({ image: meta });
}
