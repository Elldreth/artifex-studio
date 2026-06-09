# Architecture

Artifex Studio is a **thin Next.js client** over the Artifex engine. It holds no
model state of its own — everything heavy lives on the engine; the studio is UI +
a same-origin proxy + browser-local history.

```
browser ──> Next.js (studio) ──> Artifex engine (ARTIFEX_URL, :7860)
  │            /api/artifex/*  proxy                 │
  └─ IndexedDB (gallery history)            one GPU (serialized)
```

## Pieces

**Same-origin proxy** — `src/app/api/artifex/*` route handlers forward to
`ARTIFEX_URL` via `src/lib/artifex.ts`. The browser never sees the engine URL and
there's no CORS. Each studio feature has a matching proxy route (generate, img2img,
detail, train, dataset/analyze, loras, tag, cancel, progress, model-config).

**In-process serial queue** — `src/lib/queue.ts`. The engine has one GPU; the proxy
funnels concurrent LAN requests through a single chain and reports `inflight` so the
UI can show queue position.

**Browser-local history** — `src/lib/db.ts` (IndexedDB). Generations are saved as a
PNG data URL + their settings, per device. No server gallery, no DB. The Gallery
page reads it; "send to" hands images to Train/img2img/Detailer via `sessionStorage`.

**Persistence** — `src/lib/usePersistentState.ts` (localStorage-backed `useState`)
keeps each page's form settings across navigation and refresh.

**Client image prep** — `src/lib/image.ts` downscales/recompresses images before
sending (training/analysis don't need full-res, and it avoids the ~512 MB JSON
string limit on large multi-image payloads).

**Cancel** — Generate/img2img/Detailer post to `/api/artifex/cancel`; Train posts to
`/api/artifex/train/[jobId]/cancel`. The engine unwinds cooperatively and frees VRAM.

## Conventions
- Pages are client components (`"use client"`); the only server code is the thin
  proxy routes. Keep secrets/URLs server-side.
- Lightweight form state → `usePersistentState`; large/transient state (source
  images, results, jobs) stays ephemeral (localStorage is ~5 MB).
- Tests (`vitest`) cover `lib/*` + proxy routes with the engine fetch mocked; CI
  gates the build on typecheck + tests.

## Config
`ARTIFEX_URL` (engine base URL) · `PORT` (studio bind port). That's it — all other
configuration is per-checkpoint on the engine (`model_config.json`).
