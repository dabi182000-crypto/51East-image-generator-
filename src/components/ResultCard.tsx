"use client";

import { useState } from "react";
import clsx from "clsx";
import { Badge, Button, Spinner, TextArea, formatBytes } from "./ui";
import type { GeneratedImageMeta, ShotState } from "@/lib/types";

interface Props {
  state: ShotState;
  index: number;
  onGenerate: (correctionNote?: string) => void;
  onDelete: () => void;
  onApprove: () => void;
  onRestore: (image: GeneratedImageMeta) => void;
  onReplace: (file: File) => void;
  busy: boolean;
}

export default function ResultCard({
  state,
  index,
  onGenerate,
  onDelete,
  onApprove,
  onRestore,
  onReplace,
  busy,
}: Props) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { request, status, result, error, history } = state;
  const working = status === "queued" || status === "generating" || status === "checking";
  const accuracy = result?.accuracy;
  const criticalIssues = accuracy?.issues.filter((i) => i.severity === "critical") ?? [];
  const minorIssues = accuracy?.issues.filter((i) => i.severity === "minor") ?? [];

  return (
    <article
      className={clsx(
        "flex flex-col overflow-hidden rounded-xl border bg-white transition-colors",
        result?.approved ? "border-emerald-300" : "border-ink-200"
      )}
    >
      <header className="flex items-center gap-2 border-b border-ink-100 px-3.5 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600">
          {index + 1}
        </span>
        <h3 className="truncate text-sm font-medium text-ink-900">{request.label}</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <StatusBadge status={status} approved={result?.approved} />
        </div>
      </header>

      <div className="checker relative aspect-square w-full">
        {result ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.url}
            alt={request.label}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : working ? (
          <div className="shimmer flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-ink-500">
            <Spinner className="text-ink-500" />
            {status === "checking" ? "Running accuracy check…" : "Generating…"}
          </div>
        ) : status === "error" ? (
          <div className="flex h-full w-full items-center justify-center bg-red-50 p-6 text-center text-xs leading-relaxed text-red-700">
            {error}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white text-xs text-ink-400">
            Not generated yet
          </div>
        )}

        {working && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-ink-100">
            <div className="h-full w-1/3 animate-[shimmer_1.4s_linear_infinite] bg-accent-500" />
          </div>
        )}
      </div>

      {result && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100 px-3.5 py-2 text-[11px] text-ink-500">
          <span className="truncate font-medium text-ink-700" title={result.fileName}>
            {result.fileName}
          </span>
          <span>
            {result.width}×{result.height}
          </span>
          <span>{formatBytes(result.bytes)}</span>
          <span>{(result.durationMs / 1000).toFixed(1)}s</span>
        </div>
      )}

      {accuracy && (criticalIssues.length > 0 || minorIssues.length > 0) && (
        <div
          className={clsx(
            "border-t px-3.5 py-2.5 text-[11px] leading-relaxed",
            criticalIssues.length > 0
              ? "border-red-100 bg-red-50 text-red-800"
              : "border-amber-100 bg-amber-50 text-amber-800"
          )}
        >
          <p className="mb-1 font-semibold">
            {criticalIssues.length > 0 ? "Accuracy check failed" : "Accuracy notes"}
            {accuracy.retried && " · auto-retried once"}
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {[...criticalIssues, ...minorIssues].slice(0, 5).map((issue, i) => (
              <li key={`${issue.code}-${i}`}>{issue.detail}</li>
            ))}
          </ul>
        </div>
      )}

      {accuracy?.passed && accuracy.issues.length === 0 && !accuracy.skippedReason && (
        <div className="border-t border-emerald-100 bg-emerald-50 px-3.5 py-2 text-[11px] text-emerald-800">
          Accuracy check passed.
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-ink-100 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={result ? "secondary" : "primary"}
            disabled={busy || working}
            onClick={() => {
              onGenerate(note.trim() || undefined);
              setNote("");
              setShowNote(false);
            }}
          >
            {working ? <Spinner /> : result ? "Regenerate" : "Generate"}
          </Button>

          {result && (
            <>
              <a
                href={`${result.url}?download=1`}
                download={result.fileName}
                className="inline-flex items-center rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-800 hover:bg-ink-50"
              >
                Download
              </a>
              <Button
                size="sm"
                variant={result.approved ? "primary" : "secondary"}
                onClick={onApprove}
                disabled={busy}
              >
                {result.approved ? "Approved" : "Approve"}
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNote((v) => !v)}
            disabled={busy || working}
            title="Add a correction note for the next regeneration"
          >
            Note
          </Button>

          <label className="inline-flex cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100">
            Replace
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onReplace(file);
                e.target.value = "";
              }}
            />
          </label>

          {result && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={onDelete}
              disabled={busy}
            >
              Delete
            </Button>
          )}

          {history.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
              {history.length} previous
            </Button>
          )}
        </div>

        {showNote && (
          <TextArea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="The sleeve logo text is wrong — use reference 4 exactly. / The back tag is missing."
            className="!text-xs"
          />
        )}

        {showHistory && history.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => onRestore(version)}
                title={`Restore ${new Date(version.createdAt).toLocaleTimeString()}`}
                className="checker h-16 w-16 shrink-0 overflow-hidden rounded-md border border-ink-200 hover:border-accent-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={version.url} alt="Previous version" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function StatusBadge({ status, approved }: { status: ShotState["status"]; approved?: boolean }) {
  if (approved) return <Badge tone="success">Approved</Badge>;
  switch (status) {
    case "queued":
      return <Badge tone="neutral">Queued</Badge>;
    case "generating":
      return <Badge tone="info">Generating</Badge>;
    case "checking":
      return <Badge tone="info">Checking</Badge>;
    case "done":
      return <Badge tone="success">Ready</Badge>;
    case "error":
      return <Badge tone="danger">Failed</Badge>;
    default:
      return <Badge tone="neutral">Idle</Badge>;
  }
}
