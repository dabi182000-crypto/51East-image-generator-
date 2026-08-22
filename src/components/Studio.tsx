"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReferencePanel from "./ReferencePanel";
import SettingsPanel from "./SettingsPanel";
import ShotBuilder from "./ShotBuilder";
import ResultCard from "./ResultCard";
import { Badge, Button, Card, CardHeader, Spinner } from "./ui";
import {
  deleteImage,
  deleteReference,
  detectCategoryRequest,
  downloadZip,
  generateShot,
  runWithConcurrency,
  uploadReferences,
} from "@/lib/client/api";
import { buildPresetShots, linkModelIdentity } from "@/lib/shots";
import { getCategory } from "@/lib/categories";
import type {
  GeneratedImageMeta,
  GenerationSettings,
  ProductCategory,
  ReferenceImageView,
  ReferenceRole,
  ShotRequest,
  ShotState,
} from "@/lib/types";

interface Props {
  configured: boolean;
  imageModel: string;
  outputSize: number;
  maxReferences: number;
}

const DEFAULT_SETTINGS: GenerationSettings = {
  category: "mens-tshirt",
  productInstructions: "",
  accuracyPriority: "high",
  quality: "optimized",
  format: "jpeg",
  namingMode: "numeric",
  productCode: "",
  accuracyCheck: true,
  modelConsistency: true,
  useModel: true,
  mode: "ecommerce",
};

const CLIENT_CONCURRENCY = 2;

export default function Studio({ configured, imageModel, outputSize, maxReferences }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [references, setReferences] = useState<ReferenceImageView[]>([]);
  const [uploading, setUploading] = useState(false);

  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<{ confidence: number; reasoning: string } | null>(null);

  const [advanced, setAdvanced] = useState(false);
  const [shots, setShots] = useState<ShotRequest[]>(() =>
    buildPresetShots(DEFAULT_SETTINGS.category, DEFAULT_SETTINGS.useModel, true)
  );
  const [states, setStates] = useState<Record<string, ShotState>>({});
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const previews = useRef<string[]>([]);
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /**
   * Card state is derived, never synchronised through an effect: a shot that
   * has not been generated yet simply has no entry in `states`.
   */
  const shotStates = useMemo<ShotState[]>(
    () =>
      shots.map((shot) => {
        const existing = states[shot.id];
        return existing
          ? { ...existing, request: shot }
          : { request: shot, status: "idle", history: [] };
      }),
    [shots, states]
  );

  // Category / model toggle drives the preset while in preset mode.
  const applyPreset = useCallback(
    (category: ProductCategory, useModel: boolean, modelConsistency: boolean) => {
      setShots(buildPresetShots(category, useModel, modelConsistency));
    },
    []
  );

  const updateSetting = useCallback(
    <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };

        if (key === "category") {
          const def = getCategory(value as ProductCategory);
          next.useModel = def.defaultUsesModel;
          if (!advanced) applyPreset(next.category, next.useModel, next.modelConsistency);
        }
        if (key === "useModel" && !advanced) {
          applyPreset(next.category, next.useModel, next.modelConsistency);
        }
        if (key === "modelConsistency") {
          setShots((current) =>
            value
              ? linkModelIdentity(current.map((s) => ({ ...s })))
              : current.map((s) => {
                  const copy = { ...s };
                  delete copy.identityFromShotId;
                  return copy;
                })
          );
        }
        return next;
      });
    },
    [advanced, applyPreset]
  );

  // -------------------------------------------------------------------------
  // References
  // -------------------------------------------------------------------------

  const handleFiles = useCallback(
    async (files: File[]) => {
      setBanner(null);
      setUploading(true);
      try {
        const roles: ReferenceRole[] = files.map(() => "general");
        const response = await uploadReferences(files, roles, sessionId ?? undefined);
        setSessionId(response.sessionId);

        setReferences((prev) => {
          const existing = new Map(prev.map((r) => [r.id, r]));
          return response.references.map((meta, index) => {
            const found = existing.get(meta.id);
            if (found) return { ...found, ...meta, order: index };
            const file = files.find((f) => f.name === meta.name && f.size === meta.bytes);
            const previewUrl = file ? URL.createObjectURL(file) : "";
            if (previewUrl) previews.current.push(previewUrl);
            return { ...meta, order: index, previewUrl };
          });
        });
      } catch (error) {
        setBanner((error as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [sessionId]
  );

  const handleRoleChange = useCallback((id: string, role: ReferenceRole) => {
    setReferences((prev) => prev.map((r) => (r.id === id ? { ...r, role } : r)));
  }, []);

  const handleMove = useCallback((id: string, direction: -1 | 1) => {
    setReferences((prev) => {
      const index = prev.findIndex((r) => r.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((r, i) => ({ ...r, order: i }));
    });
  }, []);

  const handleRemoveReference = useCallback(
    async (id: string) => {
      setReferences((prev) => prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, order: i })));
      if (sessionId) {
        try {
          await deleteReference(sessionId, id);
        } catch {
          /* the local list is authoritative for the UI */
        }
      }
    },
    [sessionId]
  );

  const handleDetect = useCallback(async () => {
    if (!sessionId) return;
    setDetecting(true);
    setBanner(null);
    try {
      const result = await detectCategoryRequest(sessionId);
      // A zero-confidence answer means detection did not actually work (no
      // vision access, unreadable reply). Say so instead of quietly switching
      // the user to "Other Product" and rebuilding their shot list.
      if (result.confidence <= 0) {
        setDetection(null);
        setBanner(
          `Could not detect the product category automatically — pick it from the list. (${result.reasoning})`
        );
        return;
      }
      setDetection({ confidence: result.confidence, reasoning: result.reasoning });
      updateSetting("category", result.category);
    } catch (error) {
      setBanner((error as Error).message);
    } finally {
      setDetecting(false);
    }
  }, [sessionId, updateSetting]);

  // Detect once, automatically, on the first upload.
  const autoDetected = useRef(false);
  useEffect(() => {
    if (!sessionId || autoDetected.current || references.length === 0 || !configured) return;
    autoDetected.current = true;
    void handleDetect();
  }, [sessionId, references.length, configured, handleDetect]);

  // -------------------------------------------------------------------------
  // Generation
  // -------------------------------------------------------------------------

  const referencePayload = useMemo(
    () => references.map((r, i) => ({ id: r.id, role: r.role, order: i })),
    [references]
  );

  const shotsRef = useRef(shots);
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  /** Read (or lazily create) the state entry for a shot. */
  const entry = useCallback(
    (prev: Record<string, ShotState>, shotId: string): ShotState =>
      prev[shotId] ?? {
        request: shotsRef.current.find((s) => s.id === shotId) ?? {
          id: shotId,
          type: "product-front",
          label: "Shot",
        },
        status: "idle",
        history: [],
      },
    []
  );

  const setShotState = useCallback(
    (shotId: string, patch: Partial<ShotState>) => {
      setStates((prev) => ({ ...prev, [shotId]: { ...entry(prev, shotId), ...patch } }));
    },
    [entry]
  );

  const runOne = useCallback(
    async (
      shot: ShotRequest,
      correctionNote?: string,
      identityImageId?: string
    ): Promise<GeneratedImageMeta | null> => {
      if (!sessionId) return null;
      setShotState(shot.id, { status: "generating", error: undefined });
      try {
        const { image } = await generateShot({
          sessionId,
          shot,
          allShots: shots,
          settings,
          references: referencePayload,
          correctionNote,
          identityImageId,
        });

        setStates((prev) => {
          const current = entry(prev, shot.id);
          const history = current.result ? [current.result, ...current.history] : current.history;
          return {
            ...prev,
            [shot.id]: { ...current, status: "done", result: image, history, error: undefined },
          };
        });
        return image;
      } catch (error) {
        setShotState(shot.id, { status: "error", error: (error as Error).message });
        return null;
      }
    },
    [sessionId, shots, settings, referencePayload, setShotState, entry]
  );

  const statesRef = useRef(states);
  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  const generateAll = useCallback(async () => {
    if (!sessionId || running) return;
    setRunning(true);
    setBanner(null);

    setStates((prev) => {
      const next = { ...prev };
      for (const shot of shots) {
        next[shot.id] = { ...entry(prev, shot.id), status: "queued", error: undefined };
      }
      return next;
    });

    // Anchors finished in this run, keyed by shot id. Wave 2 reads them from
    // here rather than from React state: a state update scheduled at the end
    // of wave 1 has not necessarily been committed by the time wave 2 starts,
    // and a missed anchor would silently drop the model-identity reference.
    const producedInThisRun = new Map<string, GeneratedImageMeta>();

    try {
      // Wave 1: everything that does not need another shot's identity.
      const wave1 = shots.filter((s) => !s.identityFromShotId);
      await runWithConcurrency(
        wave1.map((shot) => async () => {
          const image = await runOne(shot);
          if (image) producedInThisRun.set(shot.id, image);
        }),
        CLIENT_CONCURRENCY
      );

      // Wave 2: identity-dependent shots, using the anchor's finished image.
      const wave2 = shots.filter((s) => s.identityFromShotId);
      await runWithConcurrency(
        wave2.map((shot) => async () => {
          const anchorId = shot.identityFromShotId!;
          const anchor =
            producedInThisRun.get(anchorId) ?? statesRef.current[anchorId]?.result;
          await runOne(shot, undefined, anchor?.id);
        }),
        CLIENT_CONCURRENCY
      );
    } finally {
      setRunning(false);
    }
  }, [sessionId, running, shots, runOne, entry]);

  const regenerate = useCallback(
    async (shot: ShotRequest, correctionNote?: string) => {
      const anchorId = shot.identityFromShotId;
      const identityImageId = anchorId ? statesRef.current[anchorId]?.result?.id : undefined;
      await runOne(shot, correctionNote, identityImageId);
    },
    [runOne]
  );

  const handleDeleteResult = useCallback(
    async (shotId: string, image: GeneratedImageMeta) => {
      setStates((prev) => ({
        ...prev,
        [shotId]: { ...entry(prev, shotId), status: "idle", result: undefined },
      }));
      if (sessionId) {
        try {
          await deleteImage(sessionId, image.id);
        } catch {
          /* already gone */
        }
      }
    },
    [sessionId, entry]
  );

  const handleReplace = useCallback(
    async (shot: ShotRequest, index: number, file: File) => {
      if (!sessionId) return;
      setShotState(shot.id, { status: "generating", error: undefined });
      try {
        const form = new FormData();
        form.set("sessionId", sessionId);
        form.set("file", file);
        form.set("shotId", shot.id);
        form.set("shotType", shot.type);
        form.set("label", shot.label);
        form.set("format", settings.format);
        form.set("quality", settings.quality);
        form.set("namingMode", settings.namingMode);
        form.set("productCode", settings.productCode);
        form.set("shotIndex", String(index));

        const response = await fetch("/api/image/replace", { method: "POST", body: form });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Replace failed.");
        }
        const { image } = (await response.json()) as { image: GeneratedImageMeta };

        setStates((prev) => {
          const current = entry(prev, shot.id);
          const history = current.result ? [current.result, ...current.history] : current.history;
          return { ...prev, [shot.id]: { ...current, status: "done", result: image, history } };
        });
      } catch (error) {
        setShotState(shot.id, { status: "error", error: (error as Error).message });
      }
    },
    [sessionId, settings, setShotState, entry]
  );

  const completed = useMemo(
    () => shots.map((s) => states[s.id]?.result).filter((r): r is GeneratedImageMeta => Boolean(r)),
    [shots, states]
  );

  const handleDownloadAll = useCallback(async () => {
    if (!sessionId || completed.length === 0) return;
    setZipping(true);
    setBanner(null);
    try {
      await downloadZip(
        sessionId,
        completed.map((c) => c.id),
        settings.productCode.trim() || "product-images"
      );
    } catch (error) {
      setBanner((error as Error).message);
    } finally {
      setZipping(false);
    }
  }, [sessionId, completed, settings.productCode]);

  const canGenerate = configured && Boolean(sessionId) && references.length > 0 && !running;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Product Studio</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
            Upload real product references and generate accurate, individual e-commerce images —
            every file exactly {outputSize}×{outputSize} on a pure #FFFFFF background.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{imageModel}</Badge>
          {configured ? (
            <Badge tone="success">API key configured</Badge>
          ) : (
            <Badge tone="danger">OPENAI_API_KEY missing</Badge>
          )}
        </div>
      </header>

      {!configured && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No <code className="font-mono text-xs">OPENAI_API_KEY</code> is set. Copy{" "}
          <code className="font-mono text-xs">.env.example</code> to{" "}
          <code className="font-mono text-xs">.env.local</code>, add your key, and restart the
          server.
        </div>
      )}

      {banner && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="text-xs font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-5">
        <Card>
          <CardHeader
            step={1}
            title="Product references"
            subtitle="These are the source of truth. The product is reproduced from them, never redesigned."
          />
          <ReferencePanel
            references={references}
            uploading={uploading}
            maxReferences={maxReferences}
            onFiles={handleFiles}
            onRoleChange={handleRoleChange}
            onMove={handleMove}
            onRemove={handleRemoveReference}
          />
        </Card>

        <Card>
          <CardHeader
            step={2}
            title="Category, instructions and output"
            subtitle="The category picks the shot sequence; everything else controls fidelity and delivery."
          />
          <SettingsPanel
            settings={settings}
            onChange={updateSetting}
            onDetect={handleDetect}
            detecting={detecting}
            detection={detection}
            canDetect={configured && Boolean(sessionId) && references.length > 0}
            outputSize={outputSize}
          />
        </Card>

        <Card>
          <CardHeader
            step={3}
            title="Shots"
            subtitle="Each shot is an independent generation. No collages, ever."
            actions={
              <Button
                variant="primary"
                size="lg"
                onClick={generateAll}
                disabled={!canGenerate}
                title={
                  references.length === 0
                    ? "Upload at least one product reference first"
                    : undefined
                }
              >
                {running ? (
                  <>
                    <Spinner /> Generating…
                  </>
                ) : (
                  `Generate ${shots.length} image${shots.length === 1 ? "" : "s"}`
                )}
              </Button>
            }
          />
          <ShotBuilder
            shots={shots}
            advanced={advanced}
            busy={running}
            onAdvancedChange={(next) => {
              setAdvanced(next);
              if (!next) applyPreset(settings.category, settings.useModel, settings.modelConsistency);
            }}
            onChange={(next) =>
              setShots(settings.modelConsistency ? linkModelIdentity(next) : next)
            }
            onResetToPreset={() =>
              applyPreset(settings.category, settings.useModel, settings.modelConsistency)
            }
          />
        </Card>

        <Card>
          <CardHeader
            step={4}
            title="Results"
            subtitle="Images appear as soon as each one finishes. Regenerate, replace or approve individually."
            actions={
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-500">
                  {completed.length} of {shots.length} ready
                </span>
                <Button
                  variant="secondary"
                  onClick={handleDownloadAll}
                  disabled={completed.length === 0 || zipping}
                >
                  {zipping ? <Spinner /> : "Download all (ZIP)"}
                </Button>
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {shotStates.map((state, index) => {
              const shot = state.request;
              return (
                <ResultCard
                  key={shot.id}
                  state={state}
                  index={index}
                  busy={running}
                  onGenerate={(note) => void regenerate(shot, note)}
                  onDelete={() => {
                    if (state.result) void handleDeleteResult(shot.id, state.result);
                  }}
                  onApprove={() =>
                    setStates((prev) => {
                      const current = entry(prev, shot.id);
                      if (!current.result) return prev;
                      return {
                        ...prev,
                        [shot.id]: {
                          ...current,
                          result: { ...current.result, approved: !current.result.approved },
                        },
                      };
                    })
                  }
                  onRestore={(image) =>
                    setStates((prev) => {
                      const current = entry(prev, shot.id);
                      const history = current.result
                        ? [current.result, ...current.history.filter((h) => h.id !== image.id)]
                        : current.history.filter((h) => h.id !== image.id);
                      return {
                        ...prev,
                        [shot.id]: { ...current, status: "done", result: image, history },
                      };
                    })
                  }
                  onReplace={(file) => void handleReplace(shot, index, file)}
                />
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
