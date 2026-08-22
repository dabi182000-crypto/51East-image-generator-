import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Configuration probe for the UI banner. Deliberately reports only whether a
 * key is present — never the key itself or any prefix of it.
 */
export async function GET() {
  return NextResponse.json({
    ok: Boolean(config.openai.apiKey),
    imageModel: config.openai.imageModel,
    visionModel: config.openai.visionModel,
    outputSize: config.output.size,
    maxReferences: config.limits.maxReferenceImages,
  });
}
