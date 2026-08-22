import "server-only";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import type { GeneratedImageMeta, ReferenceImage } from "./types";

/**
 * In-memory session store.
 *
 * References are uploaded once and then addressed by id, so the browser never
 * re-uploads megabytes of source photography for every shot or regeneration.
 *
 * This is deliberately process-local: it is the right trade-off for a single
 * instance deployment and keeps the app dependency-free. For multi-instance
 * deployments, replace the two exported objects below with a Redis / S3 /
 * database-backed implementation — nothing else in the codebase touches the
 * storage layer.
 */

export interface StoredReference {
  meta: ReferenceImage;
  /** Original bytes as uploaded. */
  data: Buffer;
  /** PNG, downscaled, ready to post to the Image API. */
  apiReady?: Buffer;
  /** Small JPEG for vision calls. */
  thumb?: Buffer;
}

export interface StoredResult {
  meta: GeneratedImageMeta;
  data: Buffer;
  /** Small JPEG for the accuracy check. */
  thumb?: Buffer;
}

interface Session {
  id: string;
  createdAt: number;
  lastTouched: number;
  references: Map<string, StoredReference>;
  results: Map<string, StoredResult>;
  bytes: number;
}

interface StoreGlobal {
  sessions: Map<string, Session>;
  sweeper?: NodeJS.Timeout;
}

const globalRef = globalThis as unknown as { __productStudioStore?: StoreGlobal };

function store(): StoreGlobal {
  if (!globalRef.__productStudioStore) {
    globalRef.__productStudioStore = { sessions: new Map() };
  }
  const s = globalRef.__productStudioStore;
  if (!s.sweeper) {
    s.sweeper = setInterval(sweep, 10 * 60 * 1000);
    // Never keep the process alive just for the sweeper.
    s.sweeper.unref?.();
  }
  return s;
}

function sweep(): void {
  const s = globalRef.__productStudioStore;
  if (!s) return;
  const cutoff = Date.now() - config.limits.sessionTtlMs;
  for (const [id, session] of s.sessions) {
    if (session.lastTouched < cutoff) s.sessions.delete(id);
  }
}

export function createSession(): Session {
  const session: Session = {
    id: randomUUID(),
    createdAt: Date.now(),
    lastTouched: Date.now(),
    references: new Map(),
    results: new Map(),
    bytes: 0,
  };
  store().sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  const session = store().sessions.get(id);
  if (session) session.lastTouched = Date.now();
  return session;
}

export function requireSession(id: string): Session {
  const session = getSession(id);
  if (!session) {
    throw new SessionNotFoundError();
  }
  return session;
}

export class SessionNotFoundError extends Error {
  constructor() {
    super("This upload session has expired. Please re-upload your reference images.");
    this.name = "SessionNotFoundError";
  }
}

export function addReference(sessionId: string, entry: StoredReference): void {
  const session = requireSession(sessionId);
  session.references.set(entry.meta.id, entry);
  session.bytes += entry.data.byteLength;
}

export function removeReference(sessionId: string, referenceId: string): boolean {
  const session = requireSession(sessionId);
  const existing = session.references.get(referenceId);
  if (!existing) return false;
  session.bytes -= existing.data.byteLength;
  return session.references.delete(referenceId);
}

export function listReferences(sessionId: string): StoredReference[] {
  const session = requireSession(sessionId);
  return [...session.references.values()].sort((a, b) => a.meta.order - b.meta.order);
}

export function getReference(sessionId: string, referenceId: string): StoredReference | undefined {
  return getSession(sessionId)?.references.get(referenceId);
}

export function addResult(sessionId: string, entry: StoredResult): void {
  const session = requireSession(sessionId);
  session.results.set(entry.meta.id, entry);
  session.bytes += entry.data.byteLength;
}

export function getResult(sessionId: string, resultId: string): StoredResult | undefined {
  return getSession(sessionId)?.results.get(resultId);
}

export function deleteResult(sessionId: string, resultId: string): boolean {
  const session = requireSession(sessionId);
  const existing = session.results.get(resultId);
  if (!existing) return false;
  session.bytes -= existing.data.byteLength;
  return session.results.delete(resultId);
}

export function listResults(sessionId: string): StoredResult[] {
  const session = requireSession(sessionId);
  return [...session.results.values()].sort((a, b) => a.meta.createdAt - b.meta.createdAt);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
