import "server-only";
import sharp from "sharp";
import { config } from "@/lib/config";
import type { OutputFormat, QualityPreset } from "@/lib/types";

/**
 * Server-side output pipeline.
 *
 *   raw model output
 *     -> border-connected near-white cleanup  (guarantees a true #FFFFFF field)
 *     -> proportional contain-resize onto an exact OUTPUT_SIZE white canvas
 *     -> adaptive compression to hit a sensible file-size band
 *
 * The product is never cropped and never stretched: it is scaled
 * proportionally and centred, and the remaining canvas is pure white.
 */

export interface ProcessOptions {
  format: OutputFormat;
  quality: QualityPreset;
  /** Override the final canvas size (defaults to config.output.size). */
  size?: number;
}

export interface ProcessedImage {
  data: Buffer;
  format: OutputFormat;
  width: number;
  height: number;
  bytes: number;
  /** Encoder quality actually used (undefined for lossless PNG). */
  encoderQuality?: number;
  /** True when the near-white background cleanup was applied. */
  whitened: boolean;
}

interface QualityProfile {
  /** Encoder qualities attempted from best to worst. */
  ladder: number[];
  /** Soft upper bound in bytes; the first quality under it wins. */
  targetMaxBytes: number;
  /** Never go below this quality even if the target is missed. */
  floor: number;
  /** PNG compression effort. */
  pngCompression: number;
}

const QUALITY_PROFILES: Record<QualityPreset, QualityProfile> = {
  // ~300-700 KB band for a 1500x1500 catalogue JPEG.
  optimized: {
    ladder: [90, 88, 86, 84, 82, 80, 78],
    targetMaxBytes: 700 * 1024,
    floor: 78,
    pngCompression: 9,
  },
  high: {
    ladder: [95, 93, 91, 89],
    targetMaxBytes: 1_600 * 1024,
    floor: 89,
    pngCompression: 9,
  },
  maximum: {
    ladder: [100],
    targetMaxBytes: Number.POSITIVE_INFINITY,
    floor: 100,
    pngCompression: 6,
  },
};

const WHITE = { r: 255, g: 255, b: 255 } as const;

/**
 * Snap every near-white pixel that is connected to the image border to pure
 * white. Interior near-white areas (a white garment, a white sole, a white
 * label) are deliberately left untouched, so white-on-white products keep
 * their edge definition and texture.
 */
export async function whitenBackground(input: Buffer): Promise<{ data: Buffer; whitened: boolean }> {
  if (!config.output.whiteCleanupEnabled) return { data: input, whitened: false };

  const image = sharp(input, { failOn: "none" }).flatten({ background: WHITE }).removeAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels < 3) return { data: input, whitened: false };

  const threshold = Math.min(255, Math.max(200, config.output.whiteCleanupThreshold));
  const total = width * height;
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;
  let filled = 0;

  const isNearWhite = (idx: number): boolean => {
    const o = idx * channels;
    return data[o] >= threshold && data[o + 1] >= threshold && data[o + 2] >= threshold;
  };

  const push = (idx: number) => {
    if (visited[idx]) return;
    visited[idx] = 1;
    if (!isNearWhite(idx)) return;
    stack[sp++] = idx;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  const touched: number[] = [];
  while (sp > 0) {
    const idx = stack[--sp];
    touched.push(idx);
    filled++;

    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) push(idx - 1);
    if (x < width - 1) push(idx + 1);
    if (y > 0) push(idx - width);
    if (y < height - 1) push(idx + width);
  }

  // Safety valve: if almost the entire frame flooded, the product itself is
  // white and merged with the background. Leave the pixels alone rather than
  // erasing the product.
  if (filled === 0 || filled / total > 0.93) {
    return { data: await sharp(data, { raw: info }).png().toBuffer(), whitened: false };
  }

  for (const idx of touched) {
    const o = idx * channels;
    data[o] = 255;
    data[o + 1] = 255;
    data[o + 2] = 255;
  }

  const out = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  return { data: out, whitened: true };
}

/**
 * Scale proportionally (never stretched, never cropped) and centre on an exact
 * square pure-white canvas.
 */
export async function fitToSquareCanvas(input: Buffer, size: number): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .flatten({ background: WHITE })
    .resize({
      width: size,
      height: size,
      fit: "contain",
      position: "centre",
      background: WHITE,
      withoutEnlargement: false,
      kernel: "lanczos3",
    })
    .toColorspace("srgb")
    .toBuffer();
}

/**
 * Encode with an adaptive quality ladder: start at the best quality for the
 * preset and step down only until the size target is met, never below the
 * preset's floor. Fine detail (embroidery, text, weave) is never sacrificed
 * just to chase a byte count.
 */
export async function encodeAdaptive(
  canvas: Buffer,
  format: OutputFormat,
  preset: QualityPreset
): Promise<{ data: Buffer; encoderQuality?: number }> {
  const profile = QUALITY_PROFILES[preset];

  if (format === "png") {
    const data = await sharp(canvas)
      .png({ compressionLevel: profile.pngCompression, palette: false })
      .toBuffer();
    return { data };
  }

  let best: { data: Buffer; encoderQuality: number } | null = null;

  for (const quality of profile.ladder) {
    const pipeline = sharp(canvas);
    const data =
      format === "webp"
        ? await pipeline.webp({ quality, effort: 4 }).toBuffer()
        : await pipeline
            .jpeg({
              quality,
              chromaSubsampling: "4:4:4", // keeps coloured logo text crisp
              mozjpeg: true,
              progressive: true,
            })
            .toBuffer();

    best = { data, encoderQuality: quality };
    if (data.byteLength <= profile.targetMaxBytes) break;
    if (quality <= profile.floor) break;
  }

  // Unreachable in practice: the ladder always has at least one entry.
  if (!best) {
    const data = await sharp(canvas).jpeg({ quality: 85 }).toBuffer();
    return { data, encoderQuality: 85 };
  }
  return best;
}

/** Full post-processing pipeline for one generated image. */
export async function processGeneratedImage(
  raw: Buffer,
  options: ProcessOptions
): Promise<ProcessedImage> {
  const size = options.size ?? config.output.size;

  const { data: cleaned, whitened } = await whitenBackground(raw);
  const canvas = await fitToSquareCanvas(cleaned, size);
  const { data, encoderQuality } = await encodeAdaptive(canvas, options.format, options.quality);

  const meta = await sharp(data).metadata();

  return {
    data,
    format: options.format,
    width: meta.width ?? size,
    height: meta.height ?? size,
    bytes: data.byteLength,
    encoderQuality,
    whitened,
  };
}

/** Metadata probe used when validating uploaded references. */
export async function probeImage(
  buffer: Buffer
): Promise<{ width: number; height: number; format: string }> {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  if (!meta.width || !meta.height || !meta.format) {
    throw new Error("Unreadable image file.");
  }
  return { width: meta.width, height: meta.height, format: meta.format };
}

/**
 * Downscale a reference before sending it to the API. Keeps request payloads
 * (and therefore latency and cost) sane without throwing away the detail the
 * model needs to copy logos and stitching.
 */
export async function prepareReferenceForApi(buffer: Buffer, maxEdge = 1536): Promise<Buffer> {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);

  let pipeline = sharp(buffer, { failOn: "none" }).flatten({ background: WHITE });
  if (longest > maxEdge) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3",
    });
  }
  return pipeline.png({ compressionLevel: 6 }).toBuffer();
}

/** Small, cheap JPEG used for vision QC and category detection. */
export async function makeThumbnail(buffer: Buffer, maxEdge = 768): Promise<Buffer> {
  return sharp(buffer, { failOn: "none" })
    .flatten({ background: WHITE })
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

/** Sample the four corners to verify the delivered background is pure white. */
export async function measureCornerWhiteness(
  buffer: Buffer
): Promise<{ pureWhite: boolean; samples: Array<[number, number, number]> }> {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const inset = Math.max(2, Math.floor(Math.min(width, height) * 0.01));
  const points: Array<[number, number]> = [
    [inset, inset],
    [width - 1 - inset, inset],
    [inset, height - 1 - inset],
    [width - 1 - inset, height - 1 - inset],
  ];

  const samples = points.map(([x, y]) => {
    const o = (y * width + x) * channels;
    return [data[o], data[o + 1], data[o + 2]] as [number, number, number];
  });

  const pureWhite = samples.every(([r, g, b]) => r === 255 && g === 255 && b === 255);
  return { pureWhite, samples };
}
