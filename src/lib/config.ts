import "server-only";

/**
 * Centralised, environment-driven configuration.
 *
 * Every value that could reasonably change (model name, native resolution,
 * output canvas, limits) lives here so that the rest of the codebase never
 * reads process.env directly.
 */

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim().length > 0 ? raw.trim() : fallback;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return !/^(false|0|no|off)$/i.test(raw.trim());
}

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    organization: process.env.OPENAI_ORG_ID || undefined,
    project: process.env.OPENAI_PROJECT_ID || undefined,
    /** Image generation / editing model. Configurable, defaults to gpt-image-2. */
    imageModel: str("OPENAI_IMAGE_MODEL", "gpt-image-2"),
    /** Vision model used for category detection and the accuracy check. */
    visionModel: str("OPENAI_VISION_MODEL", "gpt-4.1-mini"),
    /** Native square size requested from the API before post-processing. */
    imageSize: str("OPENAI_IMAGE_SIZE", "1024x1024"),
    imageQuality: str("OPENAI_IMAGE_QUALITY", "high") as
      | "low"
      | "medium"
      | "high"
      | "auto",
    timeoutMs: int("OPENAI_TIMEOUT_MS", 180_000),
    maxRetries: int("OPENAI_MAX_RETRIES", 1),
  },
  generation: {
    concurrency: int("GENERATION_CONCURRENCY", 3),
  },
  output: {
    /** Mandatory final canvas: OUTPUT_SIZE x OUTPUT_SIZE. */
    size: int("OUTPUT_SIZE", 1500),
    whiteCleanupEnabled: bool("WHITE_CLEANUP_ENABLED", true),
    whiteCleanupThreshold: int("WHITE_CLEANUP_THRESHOLD", 247),
  },
  limits: {
    maxReferenceImages: int("MAX_REFERENCE_IMAGES", 12),
    maxReferenceBytes: int("MAX_REFERENCE_BYTES", 20_000_000),
    sessionTtlMs: int("SESSION_TTL_MS", 3 * 60 * 60 * 1000),
  },
} as const;

/**
 * Models that accept the `input_fidelity` parameter. gpt-image-2 processes
 * reference images at high fidelity automatically and rejects the parameter,
 * so it is only sent to the models that support it.
 */
const INPUT_FIDELITY_MODELS = ["gpt-image-1", "gpt-image-1.5", "gpt-image-1-mini"];

export function supportsInputFidelity(model: string): boolean {
  return INPUT_FIDELITY_MODELS.some((m) => model.startsWith(m));
}

export function assertServerConfig(): void {
  if (!config.openai.apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Copy .env.example to .env.local and add your key."
    );
  }
}
