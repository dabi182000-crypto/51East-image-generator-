"use client";

import { useState } from "react";
import clsx from "clsx";
import { Badge, Button, Select, TextArea, TextInput } from "./ui";
import { SHOT_DEFINITIONS, getShot, newShotId } from "@/lib/shots";
import type { ShotRequest, ShotType } from "@/lib/types";

interface Props {
  shots: ShotRequest[];
  advanced: boolean;
  busy: boolean;
  onAdvancedChange: (advanced: boolean) => void;
  onChange: (shots: ShotRequest[]) => void;
  onResetToPreset: () => void;
}

const GROUP_ORDER = ["Model", "Product", "Detail", "Specialised"] as const;

export default function ShotBuilder({
  shots,
  advanced,
  busy,
  onAdvancedChange,
  onChange,
  onResetToPreset,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<ShotType>("product-front");

  const update = (id: string, patch: Partial<ShotRequest>) => {
    onChange(shots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = [...shots];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => {
    const def = getShot(pendingType);
    onChange([
      ...shots,
      { id: newShotId(), type: pendingType, label: def.label },
    ]);
  };

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={advanced ? "secondary" : "primary"}
            onClick={() => onAdvancedChange(false)}
            disabled={busy}
          >
            Category preset
          </Button>
          <Button
            size="sm"
            variant={advanced ? "primary" : "secondary"}
            onClick={() => onAdvancedChange(true)}
            disabled={busy}
          >
            Advanced shot builder
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">
            {shots.length} image{shots.length === 1 ? "" : "s"}
          </Badge>
          {advanced && (
            <Button size="sm" variant="ghost" onClick={onResetToPreset} disabled={busy}>
              Reset to preset
            </Button>
          )}
        </div>
      </div>

      <ol className="space-y-2">
        {shots.map((shot, index) => {
          const def = getShot(shot.type);
          const open = expanded === shot.id;
          return (
            <li
              key={shot.id}
              className="rounded-lg border border-ink-200 bg-white"
            >
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600">
                  {index + 1}
                </span>

                {advanced ? (
                  <Select
                    aria-label={`Shot ${index + 1} type`}
                    value={shot.type}
                    disabled={busy}
                    onChange={(e) => {
                      const type = e.target.value as ShotType;
                      update(shot.id, { type, label: getShot(type).label });
                    }}
                    className="!w-auto !py-1 !text-xs"
                  >
                    {GROUP_ORDER.map((group) => (
                      <optgroup key={group} label={group}>
                        {SHOT_DEFINITIONS.filter((d) => d.group === group).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                ) : (
                  <span className="text-sm font-medium text-ink-800">{shot.label}</span>
                )}

                <span
                  className={clsx(
                    "hidden min-w-0 flex-1 truncate text-xs text-ink-400 sm:block",
                    advanced && "sm:hidden lg:block"
                  )}
                  title={def.hint}
                >
                  {def.hint}
                </span>

                {shot.identityFromShotId && <Badge tone="info">same model</Badge>}
                {shot.instructions && <Badge tone="neutral">note</Badge>}

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpanded(open ? null : shot.id)}
                    disabled={busy}
                  >
                    {open ? "Close" : "Instructions"}
                  </Button>
                  {advanced && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Move up"
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Move down"
                        disabled={busy || index === shots.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        disabled={busy || shots.length <= 1}
                        onClick={() => onChange(shots.filter((s) => s.id !== shot.id))}
                      >
                        ✕
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {open && (
                <div className="space-y-3 border-t border-ink-100 px-3 py-3">
                  {advanced && (
                    <TextInput
                      aria-label="Shot label"
                      value={shot.label}
                      disabled={busy}
                      onChange={(e) => update(shot.id, { label: e.target.value })}
                      placeholder="Card label"
                    />
                  )}
                  {shot.type === "custom" && (
                    <TextArea
                      aria-label="Custom shot description"
                      rows={2}
                      disabled={busy}
                      value={shot.customDescription ?? ""}
                      onChange={(e) => update(shot.id, { customDescription: e.target.value })}
                      placeholder="Describe exactly what this shot should show."
                    />
                  )}
                  <TextArea
                    aria-label={`Instructions for ${shot.label}`}
                    rows={2}
                    disabled={busy}
                    value={shot.instructions ?? ""}
                    onChange={(e) => update(shot.id, { instructions: e.target.value })}
                    placeholder={
                      "Make the logo slightly more visible. Keep the head cropped at the nose. Back view must be exactly the same scale as the front."
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {advanced && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Shot type to add"
            value={pendingType}
            disabled={busy}
            onChange={(e) => setPendingType(e.target.value as ShotType)}
            className="!w-auto !py-1.5 !text-xs"
          >
            {GROUP_ORDER.map((group) => (
              <optgroup key={group} label={group}>
                {SHOT_DEFINITIONS.filter((d) => d.group === group).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={add} disabled={busy}>
            + Add shot
          </Button>
        </div>
      )}
    </div>
  );
}
