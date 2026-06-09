# Artifex Studio

A clean, **family-friendly (SFW)** web GUI for the
[Artifex](https://github.com/Elldreth/Artifex) local SDXL service — generate
images with any installed model from anywhere on your LAN, plus img2img, the
multi-region detailer, LoRA training & management, tagging, dataset analysis, and
per-model profiles. Teal-themed, no database.

**Thin client:** the browser talks to same-origin `/api/artifex/*` routes that
proxy to the engine (`ARTIFEX_URL`); generation history lives in your browser
(IndexedDB). Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Original
design: [`SPEC.md`](SPEC.md).

## Features
| Page | What it does |
|---|---|
| **Generate** | txt2img — model/style/sampler/scheduler/steps/CFG/aspect/seed, **LoRA picker**, **hi-res fix**, live progress, **Cancel** |
| **Image to image** | upload/paste a source + strength → restyle/refine |
| **Detailer** | source + scene prompt + a detector stack → re-inpaint faces/hands/eyes; LoRA-aware |
| **Train LoRA** | drop images → auto-caption (WD14) → **Analyze** (CLIP outliers/dupes/blur/caption) → train, with live loss/concept/bucket charts + **Cancel** |
| **LoRAs** | list (size/date), rename, delete, upload |
| **Tagger** | WD1.4 tags for any image |
| **Gallery** | per-device history — select, bulk delete/download, **send to** Train/img2img/Detailer |
| **Model profiles** | per-checkpoint defaults with `__default__` inheritance |

Settings persist per browser; the in-flight render shows a Cancel button.

## Develop
```bash
cp .env.example .env        # point ARTIFEX_URL at a running Artifex (:7860)
npm install
npm run dev                 # http://localhost:3000
npm test                    # vitest unit tests
npm run typecheck
```

## Stack
Next.js 16 · React 19 · TypeScript · Tailwind v4 · vitest. No database — history is
browser-local IndexedDB; all engine state lives on Artifex.

## Deploy
Standalone Next build → Docker → **GHCR** (CI runs typecheck + tests, then builds).
Run beside the `artifex` engine container — host networking is simplest:
```bash
docker run -d --name artifex-studio --network host \
  -e ARTIFEX_URL=http://localhost:7860 -e PORT=7861 \
  --restart unless-stopped ghcr.io/elldreth/artifex-studio:latest
```
Then it's at `http://<host>:7861` for everyone on the LAN.
