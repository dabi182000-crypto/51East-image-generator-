import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { probeImage } from "@/lib/image/process";
import {
  addReference,
  createSession,
  getSession,
  newId,
  removeReference,
} from "@/lib/store";
import { REFERENCE_ROLES, type ReferenceImage, type ReferenceRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
]);

function parseRole(value: FormDataEntryValue | null): ReferenceRole {
  const raw = typeof value === "string" ? value : "";
  return (REFERENCE_ROLES as readonly string[]).includes(raw)
    ? (raw as ReferenceRole)
    : "general";
}

/** Upload one or more reference images into a (new or existing) session. */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const providedSessionId = form.get("sessionId");
  const existing =
    typeof providedSessionId === "string" ? getSession(providedSessionId) : undefined;
  const session = existing ?? createSession();

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No image files were uploaded." }, { status: 400 });
  }

  if (session.references.size + files.length > config.limits.maxReferenceImages) {
    return NextResponse.json(
      {
        error: `Too many reference images. This session allows up to ${config.limits.maxReferenceImages}.`,
      },
      { status: 400 }
    );
  }

  const roles = form.getAll("roles");
  const added: ReferenceImage[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (file.size > config.limits.maxReferenceBytes) {
      return NextResponse.json(
        {
          error: `"${file.name}" is larger than the ${Math.round(
            config.limits.maxReferenceBytes / 1_000_000
          )} MB limit.`,
        },
        { status: 400 }
      );
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `"${file.name}" is not a supported image type.` },
        { status: 400 }
      );
    }

    const data = Buffer.from(await file.arrayBuffer());

    let probed: { width: number; height: number; format: string };
    try {
      probed = await probeImage(data);
    } catch {
      return NextResponse.json(
        { error: `"${file.name}" could not be read as an image.` },
        { status: 400 }
      );
    }

    const meta: ReferenceImage = {
      id: newId("ref"),
      name: file.name || `reference-${i + 1}`,
      mimeType: file.type || `image/${probed.format}`,
      bytes: data.byteLength,
      width: probed.width,
      height: probed.height,
      role: parseRole(roles[i] ?? null),
      order: session.references.size + i,
    };

    addReference(session.id, { meta, data });
    added.push(meta);
  }

  const references = [...session.references.values()]
    .map((r) => r.meta)
    .sort((a, b) => a.order - b.order);

  return NextResponse.json({ sessionId: session.id, references, added });
}

/** Remove a single reference from a session. */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const referenceId = searchParams.get("referenceId");

  if (!sessionId || !referenceId) {
    return NextResponse.json(
      { error: "sessionId and referenceId are required." },
      { status: 400 }
    );
  }
  if (!getSession(sessionId)) {
    return NextResponse.json({ error: "Session expired." }, { status: 404 });
  }

  const removed = removeReference(sessionId, referenceId);
  return NextResponse.json({ removed });
}
