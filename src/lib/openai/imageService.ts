import "server-only";
import { toFile } from "openai";
import type { Uploadable } from "openai/uploads";
import { config, supportsInputFidelity } from "@/lib/config";
import { getOpenAI, describeOpenAIError } from "./client";
import type { AccuracyPriority } from "@/lib/types";

/**
 * Thin, swappable wrapper around the OpenAI Image API.
 *
 * Everything model-specific lives here, so moving to a newer model means
 * changing OPENAI_IMAGE_MODEL — and, at most, this one file.
 *
 * Design rules enforced here:
 *  - one API call produces exactly ONE image (n = 1). Multi-shot sets are
 *    always separate calls so each shot has its own prompt and can be
 *    regenerated independently.
 *  - when reference images are present we use the image EDIT endpoint so the
 *    model works image-to-image from the real product.
 *  - PNG is requested from the API so post-processing starts from lossless
 *    pixels; the delivered format is decided by the Sharp pipeline.
 */

export interface ReferencePayload {
  /** PNG bytes, already downscaled by prepareReferenceForApi. */
  data: Buffer;
  fileName: string;
}

export interface GenerateImageArgs {
  prompt: string;
  references: ReferencePayload[];
  accuracyPriority: AccuracyPriority;
  /** Overrides for testing / future models. */
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  signal?: AbortSignal;
}

export interface GenerateImageResult {
  /** Raw PNG bytes returned by the model, before post-processing. */
  data: Buffer;
  model: string;
  usedEndpoint: "edits" | "generations";
  requestedSize: string;
  requestedQuality: string;
}

export class ImageGenerationError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "ImageGenerationError";
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

function resolveQuality(
  priority: AccuracyPriority,
  override?: GenerateImageArgs["quality"]
): "low" | "medium" | "high" | "auto" {
  if (override) return override;
  // Critical branding fidelity always asks the model for its best pass.
  if (priority === "critical") return "high";
  return config.openai.imageQuality;
}

export async function generateProductImage(
  args: GenerateImageArgs
): Promise<GenerateImageResult> {
  const client = getOpenAI();
  const model = config.openai.imageModel;
  const size = args.size ?? config.openai.imageSize;
  const quality = resolveQuality(args.accuracyPriority, args.quality);

  try {
    if (args.references.length > 0) {
      const files: Uploadable[] = await Promise.all(
        args.references.map((ref) =>
          toFile(ref.data, ref.fileName, { type: "image/png" })
        )
      );

      const params: Record<string, unknown> = {
        model,
        image: files,
        prompt: args.prompt,
        size,
        quality,
        n: 1,
        output_format: "png",
        background: "opaque",
      };

      // gpt-image-2 handles reference images at high fidelity natively and
      // rejects this parameter; older gpt-image models need it set explicitly.
      if (supportsInputFidelity(model)) {
        params.input_fidelity = args.accuracyPriority === "normal" ? "low" : "high";
      }

      // The params object is assembled dynamically (input_fidelity is only
      // valid on some models), so it is cast to the SDK's own parameter type
      // rather than being written inline.
      type EditParams = Parameters<typeof client.images.edit>[0];
      const response = await client.images.edit(params as unknown as EditParams, {
        signal: args.signal,
      });

      // `stream` is never set, so the response is always the non-streaming shape.
      return {
        data: extractImage(response as unknown as ImageResponseLike),
        model,
        usedEndpoint: "edits",
        requestedSize: size,
        requestedQuality: quality,
      };
    }

    const response = await client.images.generate(
      {
        model,
        prompt: args.prompt,
        size: size as "1024x1024",
        quality,
        n: 1,
        output_format: "png",
        background: "opaque",
      },
      { signal: args.signal }
    );

    return {
      data: extractImage(response as unknown as ImageResponseLike),
      model,
      usedEndpoint: "generations",
      requestedSize: size,
      requestedQuality: quality,
    };
  } catch (error) {
    throw new ImageGenerationError(describeOpenAIError(error), error);
  }
}

interface ImageResponseLike {
  data?: Array<{ b64_json?: string | null; url?: string | null }> | null;
}

function extractImage(response: ImageResponseLike): Buffer {
  const first = response.data?.[0];
  if (!first?.b64_json) {
    throw new ImageGenerationError(
      "OpenAI returned a response without image data. Try regenerating this shot."
    );
  }
  return Buffer.from(first.b64_json, "base64");
}
