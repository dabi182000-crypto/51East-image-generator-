import "server-only";
import OpenAI from "openai";
import { assertServerConfig, config } from "@/lib/config";

let cached: OpenAI | null = null;

/**
 * Lazily-constructed singleton OpenAI client.
 *
 * The API key is read from the server-only config module and never leaves the
 * server process. Nothing in `src/components` or any "use client" module may
 * import this file.
 */
export function getOpenAI(): OpenAI {
  if (cached) return cached;
  assertServerConfig();

  cached = new OpenAI({
    apiKey: config.openai.apiKey,
    baseURL: config.openai.baseURL,
    organization: config.openai.organization,
    project: config.openai.project,
    timeout: config.openai.timeoutMs,
    maxRetries: config.openai.maxRetries,
  });

  return cached;
}

/** Normalise SDK errors into a message that is safe to show a user. */
export function describeOpenAIError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    if (status === 401) return "OpenAI rejected the API key. Check OPENAI_API_KEY.";
    if (status === 403) {
      return "This OpenAI project is not allowed to use the configured image model. Verify OPENAI_IMAGE_MODEL and your organization's model access.";
    }
    if (status === 429) {
      return "OpenAI rate limit or quota reached. Wait a moment and regenerate this shot.";
    }
    if (status === 400) {
      return `OpenAI rejected the request: ${error.message}`;
    }
    if (status >= 500) {
      return "OpenAI had a server error while generating this image. Try regenerating.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError" || /timeout/i.test(error.message)) {
      return "The image request timed out. Try regenerating, or raise OPENAI_TIMEOUT_MS.";
    }
    return error.message;
  }
  return "Unknown error while contacting OpenAI.";
}
