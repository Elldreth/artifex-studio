import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cancel a training job. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  try {
    const r = await artifexFetch(`/v1/train/${encodeURIComponent(jobId)}/cancel`, { method: "POST" }, 6000);
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `engine unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}
