import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List installed LoRAs (models/lora/). */
export async function GET() {
  try {
    const r = await artifexFetch("/v1/loras", {}, 5000);
    if (!r.ok) return NextResponse.json({ reachable: false });
    const d = await r.json();
    return NextResponse.json({ reachable: true, loras: d.data ?? [] });
  } catch {
    return NextResponse.json({ reachable: false });
  }
}

/** Upload a .safetensors LoRA: { name, data } (base64, data-URL prefix tolerated). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.data) return NextResponse.json({ error: "name and data are required" }, { status: 400 });
  try {
    const r = await artifexFetch("/v1/loras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: body.name, data: body.data }),
    }, 60000);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? j?.error ?? "upload failed");
    return NextResponse.json(j);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
