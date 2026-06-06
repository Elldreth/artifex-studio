import { NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The detailer registry (defaults) + installed detectors, for the stack editor. */
export async function GET() {
  try {
    const r = await artifexFetch("/v1/detailers", {}, 5000);
    if (!r.ok) return NextResponse.json({ reachable: false });
    const d = await r.json();
    return NextResponse.json({
      reachable: true,
      order: d.order ?? [],
      detailers: d.detailers ?? [],
      generic: d.generic ?? {},
      detectors: (d.all_detectors ?? []).map((x: { detector: string; seg: boolean }) => x),
    });
  } catch {
    return NextResponse.json({ reachable: false });
  }
}
