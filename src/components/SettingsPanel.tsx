"use client";

import { Badge, Button, Field, SegmentedControl, Select, Spinner, TextArea, TextInput, Toggle } from "./ui";
import { categoryGroups, getCategory } from "@/lib/categories";
import type {
  AccuracyPriority,
  GenerationSettings,
  NamingMode,
  OutputFormat,
  ProductCategory,
  QualityPreset,
} from "@/lib/types";

interface Props {
  settings: GenerationSettings;
  onChange: <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) => void;
  onDetect: () => void;
  detecting: boolean;
  detection?: { confidence: number; reasoning: string } | null;
  canDetect: boolean;
  outputSize: number;
}

export default function SettingsPanel({
  settings,
  onChange,
  onDetect,
  detecting,
  detection,
  canDetect,
  outputSize,
}: Props) {
  const category = getCategory(settings.category);

  return (
    <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Field
          label="Product category"
          htmlFor="category"
          hint={
            detection
              ? `Detected automatically (${Math.round(detection.confidence * 100)}% confidence): ${detection.reasoning}`
              : "Determines the default shot sequence. Override it any time."
          }
        >
          <div className="flex gap-2">
            <Select
              id="category"
              value={settings.category}
              onChange={(e) => onChange("category", e.target.value as ProductCategory)}
            >
              {categoryGroups().map(({ group, items }) => (
                <optgroup key={group} label={group}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <Button
              variant="secondary"
              onClick={onDetect}
              disabled={!canDetect || detecting}
              className="shrink-0"
              title="Analyse the uploaded references and pick a category"
            >
              {detecting ? <Spinner /> : "Detect"}
            </Button>
          </div>
        </Field>

        <Field
          label="Additional product instructions"
          htmlFor="instructions"
          hint="Anything the references cannot say for themselves. These override automatic inference."
        >
          <TextArea
            id="instructions"
            rows={5}
            value={settings.productInstructions}
            onChange={(e) => onChange("productInstructions", e.target.value)}
            placeholder={
              "Pocket must have exactly one button.\nDo not include the paper hang tag.\nThe back neckline has a red checker tag.\nUse image 3 only for the exact garment colour.\nThe logo is embroidery, not a print."
            }
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="SKU / product code"
            htmlFor="code"
            hint="Used to name every delivered file."
          >
            <TextInput
              id="code"
              value={settings.productCode}
              onChange={(e) => onChange("productCode", e.target.value)}
              placeholder="FA0971687"
            />
          </Field>

          <Field label="File naming" hint={namingExample(settings.namingMode, settings.productCode)}>
            <SegmentedControl<NamingMode>
              ariaLabel="File naming mode"
              value={settings.namingMode}
              onChange={(value) => onChange("namingMode", value)}
              options={[
                { value: "numeric", label: "Numeric" },
                { value: "descriptive", label: "Descriptive" },
              ]}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-5">
        <Field
          label="Logo / detail accuracy priority"
          hint="Critical treats branding as a pixel-faithful copy task and requests the highest-fidelity reference handling the model supports."
        >
          <SegmentedControl<AccuracyPriority>
            ariaLabel="Logo and detail accuracy priority"
            value={settings.accuracyPriority}
            onChange={(value) => onChange("accuracyPriority", value)}
            options={[
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Output quality"
            hint={
              settings.quality === "optimized"
                ? "≈300–700 KB per image, adaptive."
                : settings.quality === "high"
                  ? "Larger files, minimal compression."
                  : "Maximum quality, largest files."
            }
          >
            <SegmentedControl<QualityPreset>
              ariaLabel="Output quality"
              value={settings.quality}
              onChange={(value) => onChange("quality", value)}
              options={[
                { value: "optimized", label: "Optimized" },
                { value: "high", label: "High" },
                { value: "maximum", label: "Max" },
              ]}
            />
          </Field>

          <Field label="Format" hint={`Every file is delivered at exactly ${outputSize}×${outputSize}.`}>
            <SegmentedControl<OutputFormat>
              ariaLabel="Output format"
              value={settings.format}
              onChange={(value) => onChange("format", value)}
              options={[
                { value: "jpeg", label: "JPEG" },
                { value: "webp", label: "WebP" },
                { value: "png", label: "PNG" },
              ]}
            />
          </Field>
        </div>

        <div className="space-y-3.5 rounded-lg border border-ink-200 bg-ink-50 p-4">
          <Toggle
            label="Product accuracy check"
            description="Compares each result against your references and retries once automatically if it fails a critical check."
            checked={settings.accuracyCheck}
            onChange={(v) => onChange("accuracyCheck", v)}
          />
          <Toggle
            label="Model consistency"
            description="Uses the generated front image as an identity reference for the back shot so it is the same person."
            checked={settings.modelConsistency}
            onChange={(v) => onChange("modelConsistency", v)}
          />
          <Toggle
            label="Use a human model"
            description={
              category.modelToggleAvailable
                ? category.defaultUsesModel
                  ? "On by default for this category. Turn off for product-only photography."
                  : "Off by default for this category. Turn on to add model shots."
                : "Not available for this category — it is always photographed product-only."
            }
            disabled={!category.modelToggleAvailable}
            checked={settings.useModel}
            onChange={(v) => onChange("useModel", v)}
          />
        </div>

        <Field
          label="Mode"
          hint="E-commerce enforces the strict white-background and fidelity rules. Creative Campaign is prepared for future styling work and still keeps the product accurate."
        >
          <SegmentedControl
            ariaLabel="Generation mode"
            value={settings.mode}
            onChange={(value) => onChange("mode", value)}
            options={[
              { value: "ecommerce", label: "E-commerce" },
              { value: "creative", label: "Creative Campaign" },
            ]}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
          <Badge tone="info">{outputSize}×{outputSize} px</Badge>
          <Badge tone="info">#FFFFFF background</Badge>
          <Badge tone="info">Individual files, never a collage</Badge>
        </div>
      </div>
    </div>
  );
}

function namingExample(mode: NamingMode, code: string): string {
  const base = code.trim() || "FA0971687";
  return mode === "numeric"
    ? `${base}.jpg, ${base}_1.jpg, ${base}_2.jpg…`
    : `${base}_model-front.jpg, ${base}_product-front.jpg…`;
}
