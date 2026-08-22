"use client";

import { useCallback, useId, useRef, useState } from "react";
import clsx from "clsx";
import { Badge, Button, Select, Spinner, formatBytes } from "./ui";
import { REFERENCE_ROLES, REFERENCE_ROLE_LABELS } from "@/lib/types";
import type { ReferenceImageView, ReferenceRole } from "@/lib/types";

interface Props {
  references: ReferenceImageView[];
  uploading: boolean;
  maxReferences: number;
  onFiles: (files: File[]) => void;
  onRoleChange: (id: string, role: ReferenceRole) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}

export default function ReferencePanel({
  references,
  uploading,
  maxReferences,
  onFiles,
  onRoleChange,
  onMove,
  onRemove,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const accept = "image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif,image/tiff";

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const files = Array.from(event.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  const remaining = maxReferences - references.length;

  return (
    <div className="space-y-4 p-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload product reference images"
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-accent-500 bg-accent-50"
            : "border-ink-200 bg-ink-50 hover:border-ink-300 hover:bg-ink-100"
        )}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onFiles(files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <span className="flex items-center gap-2 text-sm text-ink-600">
            <Spinner /> Uploading references…
          </span>
        ) : (
          <>
            <p className="text-sm font-medium text-ink-800">
              Drop product photos here, or click to browse
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-500">
              Supplier shots, phone photos, flat lays, front, back, detail, logo and colour
              references. More angles means a more accurate result.
            </p>
            <p className="mt-2 text-[11px] text-ink-400">
              {remaining > 0
                ? `${remaining} of ${maxReferences} slots remaining · JPG, PNG, WebP, HEIC, TIFF`
                : "Reference limit reached"}
            </p>
          </>
        )}
      </div>

      {references.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-500">
              Drag a card, or use the arrows, to set priority. The first references carry the
              most weight.
            </p>
            <Badge tone="neutral">{references.length} reference{references.length === 1 ? "" : "s"}</Badge>
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {references.map((reference, index) => (
              <li
                key={reference.id}
                draggable
                onDragStart={() => setDragId(reference.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragId || dragId === reference.id) return;
                  const from = references.findIndex((r) => r.id === dragId);
                  const to = index;
                  if (from === -1) return;
                  const direction = to > from ? 1 : -1;
                  for (let i = 0; i < Math.abs(to - from); i++) {
                    onMove(dragId, direction);
                  }
                  setDragId(null);
                }}
                className={clsx(
                  "flex gap-3 rounded-lg border p-2.5 transition-colors",
                  dragId === reference.id
                    ? "border-accent-500 bg-accent-50"
                    : "border-ink-200 bg-white"
                )}
              >
                <div className="checker relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-ink-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reference.previewUrl}
                    alt={reference.name}
                    className="h-full w-full object-contain"
                  />
                  <span className="absolute left-1 top-1 rounded bg-ink-900/80 px-1.5 text-[10px] font-semibold text-white">
                    {index + 1}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="truncate text-xs font-medium text-ink-800" title={reference.name}>
                    {reference.name}
                  </p>
                  <p className="text-[11px] text-ink-400">
                    {reference.width}×{reference.height} · {formatBytes(reference.bytes)}
                  </p>

                  <Select
                    aria-label={`Role for ${reference.name}`}
                    value={reference.role}
                    onChange={(e) => onRoleChange(reference.id, e.target.value as ReferenceRole)}
                    className="!py-1 !text-xs"
                  >
                    {REFERENCE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {REFERENCE_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </Select>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Move earlier"
                      disabled={index === 0}
                      onClick={() => onMove(reference.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Move later"
                      disabled={index === references.length - 1}
                      onClick={() => onMove(reference.id, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-red-600 hover:bg-red-50"
                      onClick={() => onRemove(reference.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
