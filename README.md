# Artifex Studio

A clean, **family-friendly** web GUI for the [Artifex](https://github.com/Elldreth/Artifex)
local SDXL service. Generate images with any installed model from anywhere on
your LAN — and (over time) use img2img, the multi-region detailer, per-model
profiles, and LoRA training. Teal-themed, SFW, no database.

Thin client: the browser talks to same-origin `/api/artifex/*` routes that proxy
to the Artifex engine (`ARTIFEX_URL`). Generation history lives in your browser.

See [`SPEC.md`](SPEC.md) for the full design + roadmap.

## Develop

```bash
cp .env.example .env        # point ARTIFEX_URL at a running Artifex (:7860)
npm install
npm run dev                 # http://localhost:3000
```

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4. No Prisma/DB.

## Status

- **v1 (in progress):** model picker · txt2img + settings · live progress ·
  browser-history gallery · queue.
- **v2:** img2img · detailer page · per-model profile editor.
- **v3:** LoRA training · tagging · LoRA management.

## Deploy

Standalone build → Docker → GHCR → an Unraid container beside `artifex`
(`ARTIFEX_URL=http://tower.local:7860`, LAN port). See `SPEC.md` → Deployment.
