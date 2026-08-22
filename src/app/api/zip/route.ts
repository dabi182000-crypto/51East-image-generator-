import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { SessionNotFoundError, getResult, requireSession } from "@/lib/store";
import { dedupeFileNames, sanitizeCode } from "@/lib/naming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Body {
  sessionId?: string;
  imageIds?: string[];
  archiveName?: string;
}

/**
 * Build a ZIP containing ONLY the individual generated images — no manifests,
 * no folders, no contact sheets.
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.sessionId || !Array.isArray(body.imageIds) || body.imageIds.length === 0) {
    return NextResponse.json(
      { error: "sessionId and a non-empty imageIds array are required." },
      { status: 400 }
    );
  }

  try {
    requireSession(body.sessionId);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }

  const found = body.imageIds
    .map((id) => getResult(body.sessionId as string, id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  if (found.length === 0) {
    return NextResponse.json({ error: "None of those images are available." }, { status: 404 });
  }

  const zip = new JSZip();
  const names = dedupeFileNames(found.map((r) => r.meta.fileName));
  found.forEach((result, i) => {
    zip.file(names[i], result.data);
  });

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    // JPEG/WebP payloads are already compressed; keep this cheap and fast.
    compressionOptions: { level: 1 },
  });

  const stem = sanitizeCode(body.archiveName ?? "") || "product-images";

  return new NextResponse(new Uint8Array(archive), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(archive.byteLength),
      "Content-Disposition": `attachment; filename="${stem}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
