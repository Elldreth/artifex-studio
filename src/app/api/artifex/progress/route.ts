import { NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";
import { queueDepth } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live progress of the in-flight render + how many generations are queued. */
export async function GET() {
  try {
    const r = await artifexFetch("/v1/progress", {}, 4000);
    const p = r.ok ? await r.json() : { active: false };
    return NextResponse.json({ ...p, inflight: queueDepth() });
  } catch {
    return NextResponse.json({ active: false, inflight: queueDepth() });
  }
}
