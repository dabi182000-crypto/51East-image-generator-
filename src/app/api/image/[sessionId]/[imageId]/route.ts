import { NextRequest, NextResponse } from "next/server";
import { deleteResult, getResult, getSession } from "@/lib/store";
import { FORMAT_MIME } from "@/lib/naming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ sessionId: string; imageId: string }>;
}

/** Serve a generated image. Inline by default, attachment with ?download=1. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { sessionId, imageId } = await ctx.params;
  const stored = getResult(sessionId, imageId);

  if (!stored) {
    return NextResponse.json({ error: "Image not found or session expired." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const body = new Uint8Array(stored.data);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": FORMAT_MIME[stored.meta.format],
      "Content-Length": String(stored.data.byteLength),
      "Cache-Control": "private, max-age=3600, immutable",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${
        stored.meta.fileName
      }"`,
    },
  });
}

/** Delete a generated image from the session. */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { sessionId, imageId } = await ctx.params;
  if (!getSession(sessionId)) {
    return NextResponse.json({ error: "Session expired." }, { status: 404 });
  }
  const removed = deleteResult(sessionId, imageId);
  return NextResponse.json({ removed });
}
