import { NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the Model-profiles editor needs in one call. */
export async function GET() {
  try {
    const j = (p: string) => artifexFetch(p, {}, 5000).then((r) => (r.ok ? r.json() : null));
    const [cfg, detailers, samplers, identity, styles] = await Promise.all([
      j("/v1/model-config"), j("/v1/detailers"), j("/v1/samplers"), j("/v1/identity"), j("/v1/styles"),
    ]);
    if (!cfg) return NextResponse.json({ reachable: false });
    return NextResponse.json({
      reachable: true,
      config: cfg.config ?? {},
      models: cfg.models ?? [],
      defaultKey: cfg.default_key ?? "__default__",
      detailers: detailers ?? { detailers: [], generic: {}, all_detectors: [] },
      samplers: samplers ?? { samplers: [], schedulers: [] },
      identity: identity?.data ?? [],
      styles: (styles?.data ?? []).map((s: { id: string; label?: string }) => ({ id: s.id, label: s.label ?? s.id })),
    });
  } catch {
    return NextResponse.json({ reachable: false });
  }
}
