import { NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Proxy Artifex /health for the status chip. { reachable, device, vram, models }. */
export async function GET() {
  try {
    const r = await artifexFetch("/health", {}, 4000);
    if (!r.ok) return NextResponse.json({ reachable: false });
    const h = await r.json();
    return NextResponse.json({ reachable: true, ...h });
  } catch {
    return NextResponse.json({ reachable: false });
  }
}
