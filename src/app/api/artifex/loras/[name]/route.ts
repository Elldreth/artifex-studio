import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delete a LoRA. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  try {
    const r = await artifexFetch(`/v1/loras/${encodeURIComponent(name)}`, { method: "DELETE" }, 8000);
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `engine unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}

/** Rename a LoRA: { new_name }. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (!body.new_name) return NextResponse.json({ error: "new_name is required" }, { status: 400 });
  try {
    const r = await artifexFetch(`/v1/loras/${encodeURIComponent(name)}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_name: body.new_name }),
    }, 8000);
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `engine unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}
