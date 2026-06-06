/**
 * Server-side base URL for the Artifex service. The browser never sees this —
 * it talks only to same-origin /api/artifex/* routes that forward here. Set
 * ARTIFEX_URL in the environment (e.g. http://tower.local:7860); defaults to a
 * local instance for development.
 */
const BASE = (process.env.ARTIFEX_URL || "http://127.0.0.1:7860").replace(/\/+$/, "");

export function artifexUrl(path: string): string {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Fetch an Artifex endpoint with a sane timeout. Callers handle the Response. */
export function artifexFetch(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  return fetch(artifexUrl(path), { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
}
