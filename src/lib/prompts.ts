import type {
  AccuracyPriority,
  GenerationSettings,
  ProductCategory,
  ReferenceImage,
  ShotRequest,
  ShotType,
} from "./types";
import { REFERENCE_ROLE_LABELS } from "./types";
import { getCategory, isFootwear, requiresMatchedScale } from "./categories";
import { getShot } from "./shots";

/**
 * Prompt assembly.
 *
 * Every generation prompt is composed from the same ordered layers:
 *
 *   1. MASTER PRODUCT FIDELITY PROMPT   (identical for every product/brand)
 *   2. REFERENCE MANIFEST + HIERARCHY   (what each uploaded image governs)
 *   3. CATEGORY PROMPT                  (garment/footwear/beauty specifics)
 *   4. SHOT PROMPT                      (this single frame only)
 *   5. TECHNICAL OUTPUT PROMPT          (pure white, single image, framing)
 *   6. NEGATIVE CONSTRAINTS             (things that must never appear)
 *   7. USER ADDITIONAL INSTRUCTIONS     (product-level, then shot-level)
 *   8. CORRECTIVE NOTE                  (regeneration / QC retry only)
 *
 * Nothing in this file is brand-specific. The engine must behave identically
 * for every brand it is given.
 */

export const MASTER_FIDELITY_PROMPT = `You are a professional e-commerce product photographer and retoucher producing catalogue imagery for a premium international retailer.

SOURCE OF TRUTH
Use ALL of the uploaded product reference images together as the single source of truth. Reproduce the SAME ACTUAL PRODUCT shown in the references — not a similar product, not an interpretation, not an improved version. You are photographing an existing physical item, not designing a new one.

PRESERVE EXACTLY (whenever visible in any reference)
Real product colour and colour temperature; proportions, silhouette, length and fit; construction, seams and stitching; fabric, weave, knit and material texture; brand logos and their exact shape; embroidery and its thread colour and stitch direction; printed graphics and artwork; every letter of every piece of printed or embroidered text; patterns and print placement; collars, neck construction, exterior neck details, interior neck labels; sleeves, cuffs, hems; buttons and their exact count and placement; zippers, pulls and hardware; pockets, pocket flaps and their exact count and placement; drawstrings, drawstring tips, eyelets, elastic gathering and waistbands; piping and trims; woven labels, care labels and tags; soles, midsoles, outsoles, toe shape and heel height; buckles and fasteners; bottle shape, cap, atomiser, liquid colour, label placement and packaging.

DO NOT
Do not invent, add, remove, move, resize, restyle or redesign any product feature. Do not "clean up" or simplify branding. Do not guess at details that are not visible in the references — if a detail is not visible, present the product from an angle and in a way that does not require inventing it, and keep everything that IS visible exact.

COMBINING REFERENCES
Read every reference before generating. Different references may each be authoritative about a different aspect of the same product — one may show the true colour, another the logo, another the rear construction. Merge them into one coherent, physically consistent product.

CONFLICT RESOLUTION
When references disagree: an explicit written user instruction wins over everything; a dedicated detail/logo reference governs logos, embroidery, text and small construction; a dedicated colour reference governs colour only; a front reference governs front construction and a back reference governs back construction; general references supply everything that remains.

REFERENCE IMAGES ARE NOT THE SCENE
Reproduce only the PRODUCT from the references. Never copy a reference photo's background, lighting, surface, props, hangers, packaging, mannequin, person, styling, watermark or crop. Those belong to the reference photo, not to the product.`;

const ACCURACY_PRIORITY_PROMPT: Record<AccuracyPriority, string> = {
  normal: `LOGO AND TEXT ACCURACY — NORMAL
Reproduce visible logos, wordmarks and printed text faithfully in shape, colour, weight and placement.`,
  high: `LOGO AND TEXT ACCURACY — HIGH
Treat all branding as a copy task, not a design task. Reproduce every logo, monogram, wordmark, emblem and printed or embroidered text character-for-character exactly as it appears in the references: same wording, same spelling, same letterforms, same letter spacing, same capitalisation, same colour, same scale relative to the product and same position. Do not approximate a brand name, do not substitute a similar typeface, do not re-letter, re-space or re-centre anything, and never invent a logo or a brand mark that is not present in the references.`,
  critical: `LOGO AND TEXT ACCURACY — CRITICAL
Branding fidelity is the single highest priority of this image, above styling, above composition and above aesthetics. Every logo, monogram, wordmark, emblem, patch, tag and every character of printed or embroidered text must be an exact pixel-faithful reproduction of the reference: identical wording and spelling, identical letterforms and proportions, identical stroke weights, identical colour, identical placement and identical scale relative to the product. If a branding element is only clearly legible in one reference image, that image is authoritative and must be copied. Do not stylise, redraw, smooth, re-letter or re-interpret branding in any way. An image with an inaccurate or invented logo is a failed image.`,
};

const APPAREL_SHARED = `The garment must read as a real, physically-made garment: correct drape, natural weight, believable folds, visible fabric texture and honest seam lines. Preserve the exact fit shown in the references — if the reference garment is oversized it must stay oversized, if it is fitted it must stay fitted, if it is regular or slim it must stay regular or slim. Never make the garment tighter, looser, shorter, longer, more cropped or more revealing than the source product. Sleeve length, body length, shoulder width and neckline shape must match the references.`;

const CATEGORY_PROMPTS: Partial<Record<ProductCategory, string>> = {
  "mens-tshirt": `CATEGORY — MEN'S T-SHIRT
${APPAREL_SHARED} Reproduce the neckline and collar rib exactly (crew, v-neck, ribbed depth and width), the shoulder seams, the sleeve hem construction, the body hem, any chest artwork, embroidery or pocket, and any exterior or interior neck label that is visible in the references.`,
  "womens-tshirt": `CATEGORY — WOMEN'S T-SHIRT
${APPAREL_SHARED} Reproduce the neckline shape, shoulder construction, sleeve length and hem exactly as shown, along with any chest artwork, embroidery or label.`,
  "womens-fitted-tshirt": `CATEGORY — FITTED WOMEN'S T-SHIRT
${APPAREL_SHARED} This is a fitted garment and must clearly read as fitted, following the body line exactly as the references show, without becoming tighter, shorter or more revealing than the real product. Keep the neckline shape, sleeve length, side seams and hem exactly as supplied.`,
  polo: `CATEGORY — POLO
${APPAREL_SHARED} Reproduce the collar shape and rib, the placket length, the exact number and colour of the buttons, the button spacing, the sleeve cuff rib, any side vents, the chest logo or embroidery and any contrast trims or tipping exactly as they appear in the references.`,
  shirt: `CATEGORY — SHIRT
${APPAREL_SHARED} Reproduce the collar style and stand, the full button placket with the exact number and spacing of buttons, cuff construction and cuff buttons, yoke, chest pocket presence or absence, and the hem shape exactly as shown.`,
  sweatshirt: `CATEGORY — SWEATSHIRT
${APPAREL_SHARED} Reproduce the neck rib, raglan or set-in shoulder construction, cuff and hem ribbing, any kangaroo pocket, and any chest print or embroidery exactly as shown, including the loop-back or brushed interior if visible.`,
  hoodie: `CATEGORY — HOODIE
${APPAREL_SHARED} Reproduce the hood shape and lining, the drawcord and its tips or eyelets, the exact pocket construction (kangaroo, split or zipped), the zip or pullover front, the cuff and hem ribbing, and any chest or sleeve artwork exactly as shown.`,
  jacket: `CATEGORY — JACKET
${APPAREL_SHARED} Reproduce the closure type and hardware (zip, buttons, snaps), the collar or hood, every pocket and pocket flap, cuff adjusters, hem construction, lining if visible, and all branding, labels and patches exactly as shown.`,
  dress: `CATEGORY — DRESS
${APPAREL_SHARED} Reproduce the exact length, neckline, waist seam or shaping, sleeve style, closure, slit or vent and hem exactly as shown. Do not shorten the dress or alter its coverage.`,
  skirt: `CATEGORY — SKIRT
${APPAREL_SHARED} Reproduce the waistband, closure, pleating or gathering, length, vent or slit and hem exactly as shown.`,
  trousers: `CATEGORY — TROUSERS
${APPAREL_SHARED} Reproduce the waistband, belt loops, closure and fly, front and back pockets with their exact count and placement, leg shape and rise, cuff or hem finish, and any labels or branding exactly as shown.`,
  shorts: `CATEGORY — SHORTS
${APPAREL_SHARED} Reproduce every construction element exactly: waistband and its height, elastic gathering, drawstring and drawstring tips, metal eyelets, front seam, side pockets, front pockets, back pocket and pocket flap, buttons, leg opening, hem, back seam, labels, logos, pattern and fabric. Do not create extra pockets and do not remove pockets. Keep print placement and print scale consistent with the references.`,
  "swim-shorts": `CATEGORY — SWIM SHORTS
${APPAREL_SHARED} Reproduce every construction element exactly: waistband, elastic gathering, drawstring and drawstring tips, metal eyelets, front seam, side pockets, front pockets, back pocket and pocket flap, buttons, mesh lining if visible, leg opening, hem, back seam, labels, logos, pattern and fabric. Do not create extra pockets and do not remove pockets. All-over prints must keep the same motif, the same motif scale and the same placement as the references.`,
  bikini: `CATEGORY — BIKINI
${APPAREL_SHARED} Reproduce strap construction and strap width, ties, rings, sliders, clasps and all hardware, cup shape and structure, seams, elastic edges, prints, linings and labels exactly as shown. Do not redesign the cut, the coverage or the shape of either piece. If the product is two pieces, arrange both pieces together in the frame, professionally and consistently across shots.`,
  swimwear: `CATEGORY — SWIMWEAR
${APPAREL_SHARED} Reproduce strap construction, hardware, cup or bust structure, leg line, back construction, seams, elastic edges, prints and labels exactly as shown. Do not redesign the cut or the coverage.`,
  sneakers: `CATEGORY — SNEAKERS
Reproduce the exact silhouette, upper panelling and material mix, toe shape, toe box height, lacing system and the exact number of eyelets, laces and lace colour, tongue shape and tongue label, heel counter and heel tab, midsole profile and stitching, outsole tread pattern and colour, and every logo, swoosh, stripe, emblem or wordmark exactly as it appears. Never invent branding and never place a logo where the references do not show one. When both shoes of a pair appear, the left and right geometry must be correct and mirrored, not duplicated.`,
  shoes: `CATEGORY — SHOES
Reproduce the exact last shape and silhouette, toe shape, upper material and finish, stitching and welt, closure, sole and heel construction, heel height, sole colour, and all branding and hardware exactly as it appears. Never invent branding. When both shoes of a pair appear, the left and right geometry must be correct and mirrored.`,
  "high-heels": `CATEGORY — HIGH HEELS
Reproduce the exact heel height, heel shape and taper, toe shape, vamp and topline, straps and fastenings, platform if present, material and finish, sole colour and all branding exactly as shown. Do not raise, lower or restyle the heel. When both shoes appear, keep correct mirrored left/right geometry.`,
  sandals: `CATEGORY — SANDALS
Reproduce the exact strap layout, strap width, buckles and fastenings, footbed shape and texture, sole and heel construction, materials and all branding exactly as shown. When both shoes appear, keep correct mirrored left/right geometry.`,
  handbag: `CATEGORY — HANDBAG
Reproduce the exact silhouette and proportions, handle and strap construction and attachment, hardware finish and shape, closure, stitching, panel seams, base studs, material grain and texture, and every logo, plaque, charm or embossing exactly as shown. Keep the bag structured or slouched exactly as the references show.`,
  perfume: `CATEGORY — PERFUME
Reproduce the exact bottle silhouette and proportions, glass colour and clarity, liquid colour and fill level, shoulders and neck, collar, cap shape material and finish, atomiser, label placement and label shape, and every character of the typography and brand name exactly as shown. Render believable glass: real refraction, real edge highlights and honest reflections, without adding fantasy caustics. Never rewrite, restyle or simplify the brand identity.`,
  beauty: `CATEGORY — BEAUTY PRODUCT
Reproduce the exact container silhouette and proportions, material and finish (glass, plastic, metal, matte, gloss), cap, pump, dropper or applicator, product colour, label shape and placement, and every character of the typography and brand name exactly as shown. Never rewrite or simplify the brand identity.`,
  accessories: `CATEGORY — ACCESSORY
Reproduce the exact shape, proportions, material, finish, hardware, fastenings, stitching and all branding exactly as shown.`,
  other: `CATEGORY — GENERAL PRODUCT
Identify what the product actually is from the references and photograph it as a premium catalogue item. Reproduce its exact shape, proportions, materials, finish, functional parts, hardware, labelling, typography and branding exactly as shown, and invent nothing.`,
};

function categoryPrompt(category: ProductCategory): string {
  return CATEGORY_PROMPTS[category] ?? CATEGORY_PROMPTS.other!;
}

function genderPhrase(category: ProductCategory): string {
  const def = getCategory(category);
  switch (def.modelGender) {
    case "male":
      return "an adult male model (18+)";
    case "female":
      return "an adult female model (18+)";
    default:
      return "an adult model (18+) whose gender suits the product shown in the references";
  }
}

const MODEL_SHARED = `The model exists only to present the product and must never compete with it. Clean, modern, premium e-commerce casting; healthy natural skin; simple neutral styling; no visible make-up statement; hair kept back from the garment. Neutral, relaxed, upright standing pose — no dramatic fashion posing, no dynamic motion, no editorial attitude. No jewellery, necklaces, rings, watches, bracelets, sunglasses, hats, belts, bags or any accessory that is not part of the product itself. Arms hang naturally and must not cross, cover or shadow any important product detail. Hands must be anatomically correct with exactly five fingers each. The body must be anatomically correct with no duplicated or missing limbs.`;

const HEAD_CROP = `Crop the frame across the model's face at approximately nose or upper-mouth level so the garment stays the focus. Keep the crop clean and deliberate, never accidental.`;

function shotPrompt(
  shot: ShotRequest,
  settings: GenerationSettings,
  hasIdentityReference: boolean
): string {
  const category = settings.category;
  const gender = genderPhrase(category);
  const matchedScale = requiresMatchedScale(category);
  const type: ShotType = shot.type;

  switch (type) {
    case "model-front":
      return `SHOT — MODEL FRONT
Produce a single professional studio photograph of ${gender} wearing the exact product from the references, seen from the front. ${MODEL_SHARED} ${HEAD_CROP} The entire product must be visible within the frame from top to bottom, unobstructed and un-cropped, with correct fit and correct proportions. Bright, soft, even studio lighting.`;

    case "model-back":
      return `SHOT — MODEL BACK
Produce a single professional studio photograph of ${gender} wearing the exact product from the references, seen from directly behind. ${MODEL_SHARED} ${HEAD_CROP} Show the complete back of the product from top to bottom. Reproduce the back exactly as the references show it: exterior neckline labels, checker marks or woven tabs, back embroidery, back prints, sleeve logos, yoke seams and back hem must all appear exactly if — and only if — they exist in the references. Do not add any back-neck detail, tab, label or logo that the source product does not have.${
        hasIdentityReference
          ? ` One of the supplied images is a previously generated FRONT photograph of this same shoot: use it ONLY to keep the same model identity, same body proportions, same skin tone, same hair and same lighting. Do not copy the front construction of the product onto the back — the product's back must come from the product references.`
          : ""
      }`;

    case "model-three-quarter":
      return `SHOT — MODEL THREE-QUARTER
Produce a single professional studio photograph of ${gender} wearing the exact product from the references, turned approximately 45 degrees. ${MODEL_SHARED} ${HEAD_CROP} Both the front and the side construction of the product should read clearly. The whole product stays inside the frame.${
        hasIdentityReference
          ? ` A previously generated photograph from this shoot is supplied for model identity continuity only; product construction always comes from the product references.`
          : ""
      }`;

    case "product-front":
      return `SHOT — PRODUCT ONLY, FRONT
Produce a single product-only photograph. No human, no body parts, no mannequin, no hanger. Straight, square-on front view, perfectly centred, with the entire product visible and nothing cropped at any edge. Present the product with premium e-commerce styling so it holds a natural three-dimensional shape with realistic soft folds and honest volume — not unnaturally flat, not stiff, not distorted, not stretched. Keep true proportions. Interior neck labels may be visible only where they would naturally be visible in this presentation.${
        matchedScale
          ? ` Frame the product so it occupies the same proportion of the canvas as the matching back view — front and back must be rendered at exactly the same product scale.`
          : ""
      }`;

    case "product-back":
      return `SHOT — PRODUCT ONLY, BACK
Produce a single product-only photograph. No human, no body parts, no mannequin, no hanger. Straight, square-on back view, perfectly centred, with the entire product visible and nothing cropped at any edge. Reproduce the back construction exactly as the references show — back seams, back pockets and flaps, back labels, back prints and back hardware appear only if they exist in the references. Same premium presentation and same natural volume as the front view.${
        matchedScale
          ? ` CRITICAL: this back view must be at EXACTLY the same product scale as the front view — the product must not appear smaller, larger, nearer or further away than in the front image. Same camera distance, same framing, same margins.`
          : ` Render at the same product scale as the front view.`
      }`;

    case "product-side":
      return `SHOT — PRODUCT ONLY, SIDE
Produce a single product-only photograph in a clean side profile, perfectly level with the product, centred, entire product visible and nothing cropped. Show the true side silhouette, depth and profile construction.`;

    case "product-three-quarter":
      return `SHOT — PRODUCT ONLY, HERO THREE-QUARTER
Produce a single product-only hero photograph at an approximately 45-degree three-quarter angle, slightly above the product's centre line, centred in frame with the entire product visible and nothing cropped. This is the primary catalogue image: it must read as the most flattering, sharpest and most informative view of the real product.`;

    case "flat-lay":
      return `SHOT — FLAT LAY
Produce a single top-down flat-lay photograph of the product laid flat and squared to the frame, perfectly centred, entire product visible and nothing cropped. Neat, symmetrical, professionally steamed and arranged, with natural fabric texture retained.`;

    case "ghost-mannequin":
      return `SHOT — GHOST MANNEQUIN
Produce a single invisible-mannequin photograph: the garment holds a realistic three-dimensional worn volume with an open, hollow neckline and no visible mannequin, body, hanger or support of any kind. Entire garment visible, centred, nothing cropped, correct fit and proportions.`;

    case "close-up":
      return `SHOT — DETAIL CLOSE-UP
Produce a single professional macro close-up of the most important and most identifying feature of this product, chosen by reading the references — for example an embroidered logo, chest embroidery, printed artwork, a pocket, a collar, a neck label, buttons, a zipper, a cuff, distinctive stitching or a distinctive fabric texture. Fill the frame with that feature, tack sharp, with shallow but controlled depth of field and bright soft light. Embroidery must read as real thread: individual stitches, satin-stitch sheen, correct stitch direction and thread sitting proudly on top of the fabric. Printed graphics must stay printed — flat ink sitting in the weave, never converted to embroidery. Patches must stay patches with their own merrowed or stitched edge. Reproduce any text in the detail exactly, letter for letter.`;

    case "logo-detail":
      return `SHOT — LOGO DETAIL
Produce a single macro close-up centred on the product's brand logo, reproduced exactly as supplied in the references: same shape, same wording, same spelling, same letterforms, same colour, same size relative to the product and same position on the product. Tack sharp, bright soft light, no stylisation, no re-lettering, no invented mark.`;

    case "embroidery-detail":
      return `SHOT — EMBROIDERY DETAIL
Produce a single macro close-up of the embroidery. It must clearly read as real thread embroidery physically stitched into the fabric: individual visible stitches, satin-stitch sheen, correct stitch direction, slight raised relief, subtle thread shadow, and the surrounding fabric weave still visible. Keep the exact thread colour and the exact embroidered wording from the references. Do not render embroidery as a flat print.`;

    case "pocket-detail":
      return `SHOT — POCKET DETAIL
Produce a single macro close-up of the pocket, showing its exact construction: shape, opening, any flap, the exact number and placement of buttons or fasteners, stitching, bar tacks and topstitching, exactly as the references show.`;

    case "collar-detail":
      return `SHOT — COLLAR / NECK DETAIL
Produce a single macro close-up of the collar and neck construction: collar shape and rib, neck seam and taping, placket and buttons if present, interior neck label and exterior neck tab if present. Reproduce every label's exact wording, colour and placement, and add nothing that is not in the references.`;

    case "fabric-detail":
      return `SHOT — FABRIC DETAIL
Produce a single macro close-up of the material itself: weave or knit structure, surface texture, nap, sheen and colour, rendered as real cloth with real fibre detail. Keep the exact colour of the product.`;

    case "shoe-side":
      return `SHOT — SHOE SIDE PROFILE
Produce a single product-only photograph of the shoe in a clean lateral profile, level with the shoe, centred, entire shoe visible including the full sole, nothing cropped. Show the true silhouette, panelling, sole profile, stitching and side branding exactly as supplied.`;

    case "shoe-rear":
      return `SHOT — SHOE REAR
Produce a single product-only photograph showing the rear of the shoe: heel counter, heel tab, back panelling, heel branding and heel construction, exactly as the references show. Centred, entire shoe visible, nothing cropped.`;

    case "perfume-hero":
      return `SHOT — HERO
Produce a single product-only hero photograph, straight-on and perfectly centred, with the entire product visible and nothing cropped. Bright, soft, even studio light with clean controlled highlights. Glass must refract believably, metal must read as metal, and every character of the brand typography must be exact and legible. No props, no water, no flowers, no stones, no fabric, no lifestyle decoration of any kind.`;

    case "custom":
      return `SHOT — CUSTOM
Produce a single photograph matching this description exactly: ${
        shot.customDescription?.trim() || shot.label
      }. It must still be a clean, premium, product-accurate e-commerce photograph that obeys every fidelity and technical rule above.`;

    default:
      return `SHOT — ${shot.label.toUpperCase()}
Produce a single clean, premium, product-accurate e-commerce photograph of the product.`;
  }
}

function technicalPrompt(settings: GenerationSettings): string {
  return `TECHNICAL OUTPUT REQUIREMENTS
Return exactly ONE photograph. One single frame. Never a collage, never a grid, never a diptych, never a triptych, never multiple views inside one image, never an inset or thumbnail.
Background: pure solid white, RGB 255,255,255 (#FFFFFF), edge to edge, in every corner and in every empty area. Not off-white, not cream, not ivory, not light grey, not gradient, not textured, not transparent.
A subtle, soft, realistic contact shadow directly beneath the product is permitted only where it is needed to keep the product grounded; it must stay tight and light and must never darken the wider background or create a grey field.
White or very light products must stay clearly readable against the white background through natural fabric texture, realistic folds, soft edge definition and gentle directional lighting — never by tinting or greying the background.
Square 1:1 composition. The product is centred with comfortable, even margins and is never cropped by the frame edge.
Lighting is bright, soft, even and professional, in the style of a premium department store or luxury marketplace product page. The product is tack sharp with visible material texture. Colour must be neutral and accurate with no colour cast.${
    settings.mode === "creative"
      ? `\nCREATIVE CAMPAIGN MODE: a restrained styling treatment is permitted, but product accuracy still outranks styling and the background must remain pure white.`
      : ""
  }`;
}

export const NEGATIVE_PROMPT = `MUST NOT APPEAR
No invented or approximated logos. No misspelled or altered brand names. No random, garbled or decorative text. No added tags, hang tags, stickers, size tags or labels that the references do not show. No missing product details. No redesign or restyling of the product. No incorrect pocket construction, no added or removed pockets. No incorrect number, size, colour or placement of buttons. No accessories, jewellery, watches or sunglasses on models unless the product itself is that item. No props, plants, flowers, stones, water, fabric backdrops or lifestyle decoration. No coloured background. No gradient background. No grey or off-white background. No collage, grid or multi-panel layout. No cropping or clipping of the product. No dramatic or editorial fashion posing. No exaggerated, hard or long shadows. No plastic, waxy, CGI or over-smoothed fabric. No duplicated, missing or distorted limbs. No distorted, extra or fused fingers. No text overlays, captions, labels, arrows, colour swatches or measurement marks. No watermark, signature or logo of the photographer. No frame, border, vignette or drop shadow on the image. No mannequin, hanger, clip, stand or support unless it was explicitly requested.`;

/** Build the reference manifest that tells the model what each image governs. */
export function buildReferenceManifest(references: ReferenceImage[]): string {
  if (references.length === 0) {
    return `REFERENCES
No reference images were supplied. Generate a generic premium e-commerce photograph based on the written description only, and invent no branding of any kind.`;
  }

  const lines = references
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ref, index) => {
      const roleLabel = REFERENCE_ROLE_LABELS[ref.role];
      return `Reference ${index + 1} — ${roleLabel}: ${roleDirective(ref.role)}`;
    });

  return `REFERENCES (${references.length} supplied, listed in priority order)
${lines.join("\n")}

REFERENCE HIERARCHY
1. Written user instructions override every automatic inference.
2. Detail / logo / embroidery references are authoritative for logos, text, embroidery and small construction.
3. Colour references are authoritative for product colour ONLY — take nothing else from them.
4. Front references are authoritative for front construction; back references for back construction.
5. General references supply everything not covered above.
6. Pose / composition references influence framing and pose ONLY — never product construction.
Reproduce the product, never the reference photograph's background, surface, lighting, props or styling.`;
}

function roleDirective(role: ReferenceImage["role"]): string {
  switch (role) {
    case "front":
      return "authoritative for the front construction, front artwork and front proportions of the product.";
    case "back":
      return "authoritative for the back construction, back labels, back seams and back artwork.";
    case "detail":
      return "authoritative for the fine construction detail it shows — copy it precisely.";
    case "logo":
      return "authoritative for the logo, branding, embroidery and any text — copy it exactly, character for character, including colour and technique.";
    case "color":
      return "authoritative for the product's true colour ONLY. Match this colour exactly. Take no construction, shape, styling or branding information from this image.";
    case "construction":
      return "authoritative for seams, stitching, panelling, hardware and how the product is physically assembled.";
    case "pose":
      return "a pose and composition guide ONLY. Use it for framing, camera angle and body position. Take no product information from it.";
    default:
      return "general product information — colour, shape, construction, branding and material.";
  }
}

export interface BuildPromptArgs {
  shot: ShotRequest;
  settings: GenerationSettings;
  references: ReferenceImage[];
  hasIdentityReference: boolean;
  correctionNote?: string;
}

/** Assemble the complete, layered prompt for one individual shot. */
export function buildPrompt(args: BuildPromptArgs): string {
  const { shot, settings, references, hasIdentityReference, correctionNote } = args;

  const blocks: string[] = [
    MASTER_FIDELITY_PROMPT,
    ACCURACY_PRIORITY_PROMPT[settings.accuracyPriority],
    buildReferenceManifest(references),
    categoryPrompt(settings.category),
    shotPrompt(shot, settings, hasIdentityReference),
    technicalPrompt(settings),
    NEGATIVE_PROMPT,
  ];

  if (isFootwear(settings.category) && !settings.useModel) {
    blocks.push(
      `FOOTWEAR PRESENTATION
Photograph the shoe (or the pair) product-only, with no foot, leg, model or mannequin, floating naturally on the white background with only a soft contact shadow.`
    );
  }

  const productInstructions = settings.productInstructions?.trim();
  if (productInstructions) {
    blocks.push(
      `ADDITIONAL PRODUCT INSTRUCTIONS FROM THE USER (these override automatic inference and must be followed exactly)
${productInstructions}`
    );
  }

  const shotInstructions = shot.instructions?.trim();
  if (shotInstructions) {
    blocks.push(
      `ADDITIONAL INSTRUCTIONS FOR THIS SPECIFIC SHOT (highest priority for this frame)
${shotInstructions}`
    );
  }

  const note = correctionNote?.trim();
  if (note) {
    blocks.push(
      `CORRECTION — THE PREVIOUS ATTEMPT WAS REJECTED
The previous generation of this exact shot was wrong. Fix the following and change nothing else about the product:
${note}
Re-read the product references carefully before generating and make sure the corrected elements now match them exactly.`
    );
  }

  blocks.push(
    `FINAL CHECK BEFORE YOU RENDER
One single photograph. Pure #FFFFFF background. The real product from the references, not a similar product. Every logo and every character of text exact. Nothing invented, nothing removed, nothing cropped.`
  );

  return blocks.join("\n\n");
}

/**
 * Build the corrective prompt used for the single automatic retry after a
 * failed accuracy check.
 */
export function buildCorrectionNote(issues: Array<{ detail: string }>): string {
  return issues.map((issue, i) => `${i + 1}. ${issue.detail}`).join("\n");
}
