# Artifex Studio — spec

A clean, **family-friendly** (SFW) web GUI for the [Artifex](https://github.com/Elldreth/Artifex)
SDXL service. Runs on the LAN (Unraid), lets anyone generate images with any
installed model, and over time exposes the full engine: img2img, the
multi-region detailer, per-model profiles, and LoRA training.

Sibling to candy.oh but **not** a companion-chat app — no characters, no OhAPI,
no NSFW tilt. Pure image studio.

## Decisions (locked)

- **Name:** Artifex Studio
- **Accent:** teal (`--accent: #14b8a6`); calm dark theme, easy on the eyes.
- **History/gallery:** **browser-only** (IndexedDB per device) — no server DB, no
  shared storage. Each user keeps their own recent generations + can download.
- **v1 scope:** core generate + gallery (below). v2/v3 add the rest.

## Stack

- Next.js 16.2.6 · React 19 · TypeScript · Tailwind v4 (`@tailwindcss/postcss`).
- lucide-react (icons), sonner (toasts), clsx + tailwind-merge.
- Reuses candy.oh's design-system tokens + primitives (PageHeader, AppShell,
  cards, loaders), re-themed teal; brand wordmark "artifex **studio**".
- **No Prisma / DB.** Thin client over Artifex.

## Architecture

```
browser ──> Next API routes (same-origin proxy) ──> Artifex (ARTIFEX_URL, :7860)
   │                                                      │
   └── IndexedDB (history)                                └── one GPU (serialized)
```

- **Proxy:** `/api/artifex/*` route handlers forward to `ARTIFEX_URL` (server-side
  env), so the browser never needs the service URL and there's no CORS. Mirrors
  candy.oh's `/api/sdxl/*`.
- **Queue:** one shared GPU → a small in-memory FIFO in the Next server serializes
  concurrent LAN requests; clients see queue position + live `/v1/progress`.
- **History:** generated PNG (from `b64_json`) + its settings stored in IndexedDB;
  gallery page lists, previews (lightbox), re-uses settings, downloads, deletes.
- **Config:** `ARTIFEX_URL` (required). LAN-only; no auth in v1.

## Endpoints consumed (Artifex)

`/health` · `/v1/models` · `/v1/styles` · `/v1/samplers` · `/v1/images/generations`
· `/v1/progress` · (v2) `/v1/images/img2img`, `/v1/images/detail`, `/v1/detailers`,
`/v1/model-config`, `/v1/upscalers` · (v3) `/v1/loras`, `/v1/train`, `/v1/tag`.

## v1 — features

- **Generate page**: model picker (from `/v1/models`), prompt + negative,
  style (`/v1/styles`), sampler/scheduler (`/v1/samplers`), steps, CFG, size
  (aspect presets), seed (+ randomize/lock). Submit → queued → live progress bar
  (stage + % + ETA from `/v1/progress`) → result.
- **Result + history**: show the image; auto-save to IndexedDB; one-click
  download; "reuse settings"; star/delete.
- **Gallery page**: grid of this device's history with lightbox + metadata.
- **Status**: header VRAM/health chip (`/health`), "service unreachable" state.
- **Hardening/SFW**: zod-validated inputs; a default SFW negative; optional output
  guard (flag explicit via WD14) deferred to v2.

## v2 / v3

- v2: img2img (upload + strength), the detailer as a page (reuse the lab UI),
  per-model profile editor (reuse candy.oh's Settings → Models component).
- v3: LoRA training wizard (upload → WD14 caption → train → poll → use), tagging
  tool, LoRA management.

## Deployment

- Standalone Next build → Docker image → **GHCR** (CI like Artifex) → an Unraid
  container beside `artifex`. Env `ARTIFEX_URL=http://tower.local:7860`. LAN port
  (e.g. host `7861` → container `3000`). No volumes needed (browser-only history).
- New **private GitHub repo** `artifex-studio`.

## Non-goals (v1)

Accounts/auth · server-side shared gallery · multi-GPU · mobile-native · NSFW.
