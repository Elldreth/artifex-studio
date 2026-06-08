import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dataset quality analysis (CLIP outliers/dupes, caption match, blur, faces). */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (!Array.isArray(b.images) || b.images.length === 0) {
    return NextResponse.json({ error: "images are required" }, { status: 400 });
  }
  try {
    // Generous timeout: first run downloads the CLIP model.
    const r = await artifexFetch("/v1/dataset/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: b.images, captions: b.captions, face: b.face ?? true }),
    }, 300000);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? j?.error ?? "analysis failed");
    return NextResponse.json(j);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
