/**
 * Shared domain types. Imported by both server and client code, so this module
 * must stay free of any Node-only imports.
 */

export const REFERENCE_ROLES = [
  "general",
  "front",
  "back",
  "detail",
  "logo",
  "color",
  "construction",
  "pose",
] as const;

export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

export const REFERENCE_ROLE_LABELS: Record<ReferenceRole, string> = {
  general: "General Product Reference",
  front: "Front Reference",
  back: "Back Reference",
  detail: "Detail Reference",
  logo: "Logo / Embroidery Reference",
  color: "Color Reference",
  construction: "Construction Reference",
  pose: "Pose / Composition Reference",
};

export interface ReferenceImage {
  id: string;
  name: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  role: ReferenceRole;
  /** Position in the user-controlled ordering. Lower comes first. */
  order: number;
}

/** Client-side view of a reference (adds a preview URL). */
export interface ReferenceImageView extends ReferenceImage {
  previewUrl: string;
}

export const PRODUCT_CATEGORIES = [
  "mens-tshirt",
  "womens-tshirt",
  "womens-fitted-tshirt",
  "polo",
  "shirt",
  "sweatshirt",
  "hoodie",
  "jacket",
  "dress",
  "skirt",
  "trousers",
  "shorts",
  "swim-shorts",
  "bikini",
  "swimwear",
  "sneakers",
  "shoes",
  "high-heels",
  "sandals",
  "handbag",
  "perfume",
  "beauty",
  "accessories",
  "other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const SHOT_TYPES = [
  "model-front",
  "model-back",
  "model-three-quarter",
  "product-front",
  "product-back",
  "product-side",
  "product-three-quarter",
  "flat-lay",
  "ghost-mannequin",
  "close-up",
  "logo-detail",
  "embroidery-detail",
  "pocket-detail",
  "collar-detail",
  "fabric-detail",
  "shoe-side",
  "shoe-rear",
  "perfume-hero",
  "custom",
] as const;

export type ShotType = (typeof SHOT_TYPES)[number];

export type AccuracyPriority = "normal" | "high" | "critical";
export type QualityPreset = "optimized" | "high" | "maximum";
export type OutputFormat = "jpeg" | "webp" | "png";
export type NamingMode = "numeric" | "descriptive";
export type GenerationMode = "ecommerce" | "creative";

/** A single requested shot in the job. */
export interface ShotRequest {
  /** Stable client-generated id, also used to address the result. */
  id: string;
  type: ShotType;
  /** Display label; defaults to the shot-type label, editable in Advanced Mode. */
  label: string;
  /** Optional per-shot user instruction. */
  instructions?: string;
  /** Free-text description used when type === "custom". */
  customDescription?: string;
  /**
   * Id of another shot in the same job whose generated image should be passed
   * as a model-identity reference (used for model-back continuity).
   */
  identityFromShotId?: string;
}

export interface GenerationSettings {
  category: ProductCategory;
  productInstructions: string;
  accuracyPriority: AccuracyPriority;
  quality: QualityPreset;
  format: OutputFormat;
  namingMode: NamingMode;
  productCode: string;
  accuracyCheck: boolean;
  modelConsistency: boolean;
  /** Allow a human model for categories that default to product-only. */
  useModel: boolean;
  mode: GenerationMode;
}

export interface AccuracyIssue {
  code: string;
  severity: "critical" | "minor";
  detail: string;
}

export interface AccuracyReport {
  passed: boolean;
  issues: AccuracyIssue[];
  /** Populated when a corrective retry was performed. */
  retried: boolean;
  /** Set when QC could not run (e.g. model unavailable). */
  skippedReason?: string;
}

export interface GeneratedImageMeta {
  id: string;
  shotId: string;
  shotType: ShotType;
  label: string;
  fileName: string;
  format: OutputFormat;
  width: number;
  height: number;
  bytes: number;
  /** Server route that serves the binary. */
  url: string;
  createdAt: number;
  approved: boolean;
  accuracy?: AccuracyReport;
  /** Millisecond wall time of the whole pipeline for this shot. */
  durationMs: number;
  /** ids of superseded versions, newest first. */
  previousVersionIds: string[];
}

export type ShotStatus = "idle" | "queued" | "generating" | "checking" | "done" | "error";

export interface ShotState {
  request: ShotRequest;
  status: ShotStatus;
  error?: string;
  result?: GeneratedImageMeta;
  history: GeneratedImageMeta[];
}

export interface UploadResponse {
  sessionId: string;
  references: ReferenceImage[];
}

export interface DetectResponse {
  category: ProductCategory;
  confidence: number;
  reasoning: string;
  suggestedRoles?: Record<string, ReferenceRole>;
}

export interface GenerateRequestBody {
  sessionId: string;
  shot: ShotRequest;
  settings: GenerationSettings;
  references: Array<Pick<ReferenceImage, "id" | "role" | "order">>;
  /** Extra corrective note supplied when the user clicks Regenerate. */
  correctionNote?: string;
  /** Result image id to use as a model-identity reference. */
  identityImageId?: string;
}

export interface GenerateResponseBody {
  image: GeneratedImageMeta;
  /** The fully assembled prompt, returned for transparency/debugging. */
  prompt: string;
}

export interface ApiError {
  error: string;
  detail?: string;
}
