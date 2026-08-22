import type { ProductCategory, ShotRequest, ShotType } from "./types";
import { getCategory, presetShots } from "./categories";

export interface ShotDefinition {
  id: ShotType;
  label: string;
  /** Slug used by descriptive file naming. */
  slug: string;
  /** True when the shot renders a human model. */
  usesModel: boolean;
  group: "Model" | "Product" | "Detail" | "Specialised";
  hint: string;
}

export const SHOT_DEFINITIONS: ShotDefinition[] = [
  {
    id: "model-front",
    label: "Model Front",
    slug: "model-front",
    usesModel: true,
    group: "Model",
    hint: "Studio model wearing the product, front view.",
  },
  {
    id: "model-back",
    label: "Model Back",
    slug: "model-back",
    usesModel: true,
    group: "Model",
    hint: "Same model, back view. Uses the front shot for identity continuity.",
  },
  {
    id: "model-three-quarter",
    label: "Model 3/4",
    slug: "model-three-quarter",
    usesModel: true,
    group: "Model",
    hint: "Model at a three-quarter turn.",
  },
  {
    id: "product-front",
    label: "Product Front",
    slug: "product-front",
    usesModel: false,
    group: "Product",
    hint: "Product only, straight front view, nothing cropped.",
  },
  {
    id: "product-back",
    label: "Product Back",
    slug: "product-back",
    usesModel: false,
    group: "Product",
    hint: "Product only, straight back view at identical scale to the front.",
  },
  {
    id: "product-side",
    label: "Product Side",
    slug: "product-side",
    usesModel: false,
    group: "Product",
    hint: "Clean side profile.",
  },
  {
    id: "product-three-quarter",
    label: "Product 3/4",
    slug: "product-three-quarter",
    usesModel: false,
    group: "Product",
    hint: "Hero three-quarter angle.",
  },
  {
    id: "flat-lay",
    label: "Flat Lay",
    slug: "flat-lay",
    usesModel: false,
    group: "Product",
    hint: "Top-down flat presentation.",
  },
  {
    id: "ghost-mannequin",
    label: "Ghost Mannequin",
    slug: "ghost-mannequin",
    usesModel: false,
    group: "Product",
    hint: "Invisible-mannequin 3D garment volume.",
  },
  {
    id: "close-up",
    label: "Close-up",
    slug: "detail",
    usesModel: false,
    group: "Detail",
    hint: "Automatically picks the most important product feature.",
  },
  {
    id: "logo-detail",
    label: "Logo Detail",
    slug: "logo-detail",
    usesModel: false,
    group: "Detail",
    hint: "Macro of the brand logo exactly as supplied.",
  },
  {
    id: "embroidery-detail",
    label: "Embroidery Detail",
    slug: "embroidery-detail",
    usesModel: false,
    group: "Detail",
    hint: "Macro of embroidery with real thread texture.",
  },
  {
    id: "pocket-detail",
    label: "Pocket Detail",
    slug: "pocket-detail",
    usesModel: false,
    group: "Detail",
    hint: "Macro of the pocket and its construction.",
  },
  {
    id: "collar-detail",
    label: "Collar Detail",
    slug: "collar-detail",
    usesModel: false,
    group: "Detail",
    hint: "Macro of the collar / neck construction and labels.",
  },
  {
    id: "fabric-detail",
    label: "Fabric Detail",
    slug: "fabric-detail",
    usesModel: false,
    group: "Detail",
    hint: "Macro of weave, knit or material texture.",
  },
  {
    id: "shoe-side",
    label: "Shoe Side",
    slug: "shoe-side",
    usesModel: false,
    group: "Specialised",
    hint: "Clean lateral profile of the shoe.",
  },
  {
    id: "shoe-rear",
    label: "Shoe Rear",
    slug: "shoe-rear",
    usesModel: false,
    group: "Specialised",
    hint: "Heel / rear counter view.",
  },
  {
    id: "perfume-hero",
    label: "Perfume Hero",
    slug: "hero",
    usesModel: false,
    group: "Specialised",
    hint: "Straight-on hero of the bottle or beauty product.",
  },
  {
    id: "custom",
    label: "Custom",
    slug: "custom",
    usesModel: false,
    group: "Specialised",
    hint: "Describe the shot yourself.",
  },
];

const SHOT_MAP = new Map<ShotType, ShotDefinition>(SHOT_DEFINITIONS.map((s) => [s.id, s]));

export function getShot(id: ShotType): ShotDefinition {
  return SHOT_MAP.get(id) ?? SHOT_MAP.get("custom")!;
}

export function shotLabel(id: ShotType): string {
  return getShot(id).label;
}

export function shotUsesModel(shot: ShotRequest): boolean {
  return getShot(shot.type).usesModel;
}

let counter = 0;
export function newShotId(): string {
  counter += 1;
  return `shot_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/**
 * Build the concrete shot list for a category preset, wiring up the
 * model-identity dependency from the back shot to the front shot.
 */
export function buildPresetShots(
  category: ProductCategory,
  useModel: boolean,
  modelConsistency: boolean
): ShotRequest[] {
  const types = presetShots(category, useModel);
  const shots: ShotRequest[] = types.map((type) => ({
    id: newShotId(),
    type,
    label: getShot(type).label,
  }));
  if (modelConsistency) linkModelIdentity(shots);
  return shots;
}

/** Point every model shot after the first at the first model shot for identity. */
export function linkModelIdentity(shots: ShotRequest[]): ShotRequest[] {
  const modelShots = shots.filter((s) => getShot(s.type).usesModel);
  const anchor = modelShots[0];
  for (const shot of shots) {
    if (!getShot(shot.type).usesModel) {
      delete shot.identityFromShotId;
      continue;
    }
    shot.identityFromShotId = anchor && anchor.id !== shot.id ? anchor.id : undefined;
    if (!shot.identityFromShotId) delete shot.identityFromShotId;
  }
  return shots;
}

/** Topological-ish ordering: identity anchors are generated before dependants. */
export function orderShotsForExecution(shots: ShotRequest[]): ShotRequest[] {
  const independent = shots.filter((s) => !s.identityFromShotId);
  const dependent = shots.filter((s) => s.identityFromShotId);
  return [...independent, ...dependent];
}

export function defaultCategoryModelUsage(category: ProductCategory): boolean {
  return getCategory(category).defaultUsesModel;
}
