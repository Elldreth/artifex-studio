import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save a model's (or __default__'s) profile. */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const r = await artifexFetch(`/v1/model-config/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: body.profile ?? {} }),
    }, 8000);
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `engine unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}

/** Drop a model's override → it inherits __default__. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const r = await artifexFetch(`/v1/model-config/${encodeURIComponent(id)}`, { method: "DELETE" }, 8000);
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `engine unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}
