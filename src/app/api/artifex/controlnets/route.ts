import { NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Installed ControlNet models + available preprocessors. */
export async function GET() {
  try {
    const r = await artifexFetch("/v1/controlnets", {}, 5000);
    if (!r.ok) return NextResponse.json({ reachable: false });
    const d = await r.json();
    return NextResponse.json({ reachable: true, models: d.data ?? [], preprocessors: d.preprocessors ?? [] });
  } catch {
    return NextResponse.json({ reachable: false });
  }
}
