import type { NamingMode, OutputFormat, ShotRequest } from "./types";
import { getShot } from "./shots";

/**
 * Deterministic output file naming.
 *
 * numeric      FA0971687.jpg, FA0971687_1.jpg, FA0971687_2.jpg, FA0971687_3.jpg
 * descriptive  FA0971687_model-front.jpg, FA0971687_product-front.jpg, ...
 *
 * Two-image sets (shorts, swimwear) use _front / _back in descriptive mode.
 */

export const FORMAT_EXTENSION: Record<OutputFormat, string> = {
  jpeg: "jpg",
  webp: "webp",
  png: "png",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  jpeg: "image/jpeg",
  webp: "image/webp",
  png: "image/png",
};

/** Strip anything that would be awkward in a filename, keep the user's casing. */
export function sanitizeCode(code: string): string {
  return code
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 64);
}

function descriptiveSlug(shot: ShotRequest, allShots: ShotRequest[]): string {
  // A pure front/back product pair reads better as _front / _back.
  const types = allShots.map((s) => s.type);
  const isSimplePair =
    allShots.length === 2 &&
    types.includes("product-front") &&
    types.includes("product-back");

  if (isSimplePair) {
    if (shot.type === "product-front") return "front";
    if (shot.type === "product-back") return "back";
  }

  if (shot.type === "custom") {
    const fromLabel = sanitizeCode(shot.label).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    return fromLabel || "custom";
  }
  return getShot(shot.type).slug;
}

export interface FileNameArgs {
  shot: ShotRequest;
  allShots: ShotRequest[];
  productCode: string;
  namingMode: NamingMode;
  format: OutputFormat;
  /** Appended when a previous version with the same name still exists. */
  versionSuffix?: string;
}

export function buildFileName(args: FileNameArgs): string {
  const ext = FORMAT_EXTENSION[args.format];
  const code = sanitizeCode(args.productCode);
  const index = Math.max(0, args.allShots.findIndex((s) => s.id === args.shot.id));
  const base = code || "product";
  const version = args.versionSuffix ? `-${args.versionSuffix}` : "";

  if (args.namingMode === "descriptive") {
    return `${base}_${descriptiveSlug(args.shot, args.allShots)}${version}.${ext}`;
  }

  // Numeric: first image has no suffix, then _1, _2, _3 ...
  const suffix = index === 0 ? "" : `_${index}`;
  return `${base}${suffix}${version}.${ext}`;
}

/** Ensure every name in a set is unique (used when building the ZIP). */
export function dedupeFileNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf(".");
    const stem = dot === -1 ? name : name.slice(0, dot);
    const ext = dot === -1 ? "" : name.slice(dot);
    return `${stem}-${count + 1}${ext}`;
  });
}
