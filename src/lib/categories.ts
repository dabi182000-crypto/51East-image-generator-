import type { ProductCategory, ShotType } from "./types";

/**
 * Category catalogue + shot presets.
 *
 * Shared by the client (dropdowns, shot cards) and the server (prompt
 * assembly), so this module must remain isomorphic.
 */

export interface CategoryDefinition {
  id: ProductCategory;
  label: string;
  group: string;
  /** Which model gender to request when a shot includes a human. */
  modelGender: "male" | "female" | "unisex" | "none";
  /** Whether the default preset uses a human model. */
  defaultUsesModel: boolean;
  /** Whether the UI should offer the "use a human model" toggle. */
  modelToggleAvailable: boolean;
  /** Default shot sequence produced by the preset. */
  defaultShots: ShotType[];
  /** Shot sequence used when the user opts into a model for a product-only category. */
  modelShots?: ShotType[];
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "mens-tshirt",
    label: "Men's T-shirt",
    group: "Tops",
    modelGender: "male",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "womens-tshirt",
    label: "Women's T-shirt",
    group: "Tops",
    modelGender: "female",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "womens-fitted-tshirt",
    label: "Fitted Women's T-shirt",
    group: "Tops",
    modelGender: "female",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "polo",
    label: "Polo",
    group: "Tops",
    modelGender: "unisex",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "shirt",
    label: "Shirt",
    group: "Tops",
    modelGender: "unisex",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "sweatshirt",
    label: "Sweatshirt",
    group: "Tops",
    modelGender: "unisex",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "hoodie",
    label: "Hoodie",
    group: "Tops",
    modelGender: "unisex",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "jacket",
    label: "Jacket",
    group: "Outerwear",
    modelGender: "unisex",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "dress",
    label: "Dress",
    group: "Womenswear",
    modelGender: "female",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "skirt",
    label: "Skirt",
    group: "Womenswear",
    modelGender: "female",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "trousers",
    label: "Trousers",
    group: "Bottoms",
    modelGender: "unisex",
    defaultUsesModel: true,
    modelToggleAvailable: true,
    defaultShots: ["model-front", "product-front", "model-back", "close-up"],
  },
  {
    id: "shorts",
    label: "Shorts",
    group: "Bottoms",
    modelGender: "unisex",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-front", "product-back"],
    modelShots: ["model-front", "product-front", "model-back", "product-back"],
  },
  {
    id: "swim-shorts",
    label: "Swim Shorts",
    group: "Swim",
    modelGender: "male",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-front", "product-back"],
    modelShots: ["model-front", "product-front", "model-back", "product-back"],
  },
  {
    id: "bikini",
    label: "Bikini",
    group: "Swim",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: false,
    defaultShots: ["product-front", "product-back"],
  },
  {
    id: "swimwear",
    label: "Swimwear",
    group: "Swim",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: false,
    defaultShots: ["product-front", "product-back"],
  },
  {
    id: "sneakers",
    label: "Sneakers",
    group: "Footwear",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-three-quarter", "shoe-side", "shoe-rear", "close-up"],
  },
  {
    id: "shoes",
    label: "Shoes",
    group: "Footwear",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-three-quarter", "shoe-side", "shoe-rear", "close-up"],
  },
  {
    id: "high-heels",
    label: "High Heels",
    group: "Footwear",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-three-quarter", "shoe-side", "shoe-rear", "close-up"],
  },
  {
    id: "sandals",
    label: "Sandals",
    group: "Footwear",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-three-quarter", "shoe-side", "shoe-rear", "close-up"],
  },
  {
    id: "handbag",
    label: "Handbag",
    group: "Accessories",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-three-quarter", "product-front", "product-back", "close-up"],
  },
  {
    id: "perfume",
    label: "Perfume",
    group: "Beauty",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: false,
    defaultShots: ["perfume-hero", "product-three-quarter", "product-back", "close-up"],
  },
  {
    id: "beauty",
    label: "Beauty Product",
    group: "Beauty",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: false,
    defaultShots: ["perfume-hero", "product-three-quarter", "product-back", "close-up"],
  },
  {
    id: "accessories",
    label: "Accessories",
    group: "Accessories",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-three-quarter", "product-front", "product-back", "close-up"],
  },
  {
    id: "other",
    label: "Other Product",
    group: "General",
    modelGender: "none",
    defaultUsesModel: false,
    modelToggleAvailable: true,
    defaultShots: ["product-three-quarter", "product-side", "product-back", "close-up"],
  },
];

const CATEGORY_MAP = new Map<ProductCategory, CategoryDefinition>(
  CATEGORY_DEFINITIONS.map((c) => [c.id, c])
);

export function getCategory(id: ProductCategory): CategoryDefinition {
  return CATEGORY_MAP.get(id) ?? CATEGORY_MAP.get("other")!;
}

export function categoryLabel(id: ProductCategory): string {
  return getCategory(id).label;
}

export function categoryGroups(): Array<{ group: string; items: CategoryDefinition[] }> {
  const groups: string[] = [];
  for (const c of CATEGORY_DEFINITIONS) {
    if (!groups.includes(c.group)) groups.push(c.group);
  }
  return groups.map((group) => ({
    group,
    items: CATEGORY_DEFINITIONS.filter((c) => c.group === group),
  }));
}

/** Resolve the shot preset for a category, honouring the "use model" toggle. */
export function presetShots(id: ProductCategory, useModel: boolean): ShotType[] {
  const def = getCategory(id);
  if (useModel && !def.defaultUsesModel && def.modelShots) return [...def.modelShots];
  if (useModel && !def.defaultUsesModel && def.modelToggleAvailable) {
    // Footwear / bags / generic products: swap the hero for a model shot pair.
    return ["model-front", ...def.defaultShots.slice(1)] as ShotType[];
  }
  if (!useModel && def.defaultUsesModel) {
    // Strip human shots and substitute product equivalents.
    return def.defaultShots.map((s) =>
      s === "model-front" ? "product-front" : s === "model-back" ? "product-back" : s
    );
  }
  return [...def.defaultShots];
}

/** Categories whose two product shots must share an identical product scale. */
export function requiresMatchedScale(id: ProductCategory): boolean {
  return ["shorts", "swim-shorts", "bikini", "swimwear"].includes(id);
}

export function isApparel(id: ProductCategory): boolean {
  return [
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
  ].includes(id);
}

export function isFootwear(id: ProductCategory): boolean {
  return ["sneakers", "shoes", "high-heels", "sandals"].includes(id);
}
