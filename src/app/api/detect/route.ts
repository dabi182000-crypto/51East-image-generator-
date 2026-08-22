import { NextRequest, NextResponse } from "next/server";
import { makeThumbnail } from "@/lib/image/process";
import { detectCategory } from "@/lib/openai/vision";
import { SessionNotFoundError, listReferences } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Automatic product-category detection from the uploaded references. */
export async function POST(request: NextRequest) {
  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  try {
    const references = listReferences(body.sessionId);
    if (references.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one reference image first." },
        { status: 400 }
      );
    }

    const thumbs = await Promise.all(
      references.slice(0, 6).map(async (ref) => {
        if (!ref.thumb) ref.thumb = await makeThumbnail(ref.data);
        return ref.thumb;
      })
    );

    const detected = await detectCategory(thumbs);
    return NextResponse.json(detected);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Category detection failed.", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
