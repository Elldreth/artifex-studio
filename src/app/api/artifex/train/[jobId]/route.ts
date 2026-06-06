import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll a training job: queued → captioning → training → completed | failed. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  try {
    const r = await artifexFetch(`/v1/train/${encodeURIComponent(jobId)}`, {}, 6000);
    const j = await r.json();
    return NextResponse.json(j, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `engine unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}
