import { NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Installed checkpoints, with the styles + samplers the generate form needs. */
export async function GET() {
  try {
    const [health, samplers, styles, upscalers, identity] = await Promise.all([
      artifexFetch("/health", {}, 5000).then((r) => (r.ok ? r.json() : null)),
      artifexFetch("/v1/samplers", {}, 5000).then((r) => (r.ok ? r.json() : null)),
      artifexFetch("/v1/styles", {}, 5000).then((r) => (r.ok ? r.json() : null)),
      artifexFetch("/v1/upscalers", {}, 5000).then((r) => (r.ok ? r.json() : null)),
      artifexFetch("/v1/identity", {}, 5000).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (!health) return NextResponse.json({ reachable: false });
    return NextResponse.json({
      reachable: true,
      models: health.models ?? [],
      samplers: samplers?.samplers ?? [],
      schedulers: samplers?.schedulers ?? [],
      defaultSampler: samplers?.default ?? {},
      styles: (styles?.data ?? []).map((s: { id: string; label?: string }) => ({ id: s.id, label: s.label ?? s.id })),
      upscalers: upscalers?.data ?? [],
      identity: identity?.data ?? [],
    });
  } catch {
    return NextResponse.json({ reachable: false });
  }
}
