import type {
  DetectResponse,
  GeneratedImageMeta,
  GenerationSettings,
  ReferenceImage,
  ReferenceRole,
  ShotRequest,
} from "@/lib/types";

/** Typed fetch helpers. All OpenAI traffic happens server-side. */

async function readError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await response.json();
    if (body && typeof body.error === "string") message = body.error;
  } catch {
    /* non-JSON error body */
  }
  throw new Error(message);
}

export async function uploadReferences(
  files: File[],
  roles: ReferenceRole[],
  sessionId?: string
): Promise<{ sessionId: string; references: ReferenceImage[] }> {
  const form = new FormData();
  if (sessionId) form.set("sessionId", sessionId);
  files.forEach((file, i) => {
    form.append("files", file);
    form.append("roles", roles[i] ?? "general");
  });

  const response = await fetch("/api/upload", { method: "POST", body: form });
  if (!response.ok) await readError(response, "Upload failed.");
  return response.json();
}

export async function deleteReference(sessionId: string, referenceId: string): Promise<void> {
  const params = new URLSearchParams({ sessionId, referenceId });
  const response = await fetch(`/api/upload?${params}`, { method: "DELETE" });
  if (!response.ok) await readError(response, "Could not remove that reference.");
}

export async function detectCategoryRequest(sessionId: string): Promise<DetectResponse> {
  const response = await fetch("/api/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) await readError(response, "Category detection failed.");
  return response.json();
}

export interface GenerateArgs {
  sessionId: string;
  shot: ShotRequest;
  allShots: ShotRequest[];
  settings: GenerationSettings;
  references: Array<Pick<ReferenceImage, "id" | "role" | "order">>;
  correctionNote?: string;
  identityImageId?: string;
  signal?: AbortSignal;
}

export async function generateShot(
  args: GenerateArgs
): Promise<{ image: GeneratedImageMeta; prompt: string }> {
  const { signal, ...body } = args;
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) await readError(response, "Generation failed.");
  return response.json();
}

export async function deleteImage(sessionId: string, imageId: string): Promise<void> {
  const response = await fetch(`/api/image/${sessionId}/${imageId}`, { method: "DELETE" });
  if (!response.ok) await readError(response, "Could not delete that image.");
}

export async function downloadZip(
  sessionId: string,
  imageIds: string[],
  archiveName: string
): Promise<void> {
  const response = await fetch("/api/zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, imageIds, archiveName }),
  });
  if (!response.ok) await readError(response, "Could not build the ZIP.");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${archiveName || "product-images"}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Run tasks with a bounded concurrency window. */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      await tasks[index]();
    }
  });
  await Promise.all(workers);
}
