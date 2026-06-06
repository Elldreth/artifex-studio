import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a character-LoRA training job. Returns { job_id, state }; poll
 *  /api/artifex/train/[jobId]. The engine runs it on a background thread. */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (!b.name || !Array.isArray(b.images) || b.images.length === 0) {
    return NextResponse.json({ error: "name and at least one image are required" }, { status: 400 });
  }
  const payload = {
    name: b.name,
    images: b.images,
    ...(b.model ? { model: b.model } : {}),
    ...(Array.isArray(b.captions) ? { captions: b.captions } : {}),
    ...(b.trigger ? { trigger: b.trigger } : {}),
    steps: b.steps ?? 800,
    rank: b.rank ?? 16,
    alpha: b.alpha ?? 8,
    width: b.width ?? 832,
    height: b.height ?? 1216,
    train_text_encoder: !!b.train_text_encoder,
  };
  try {
    const r = await artifexFetch("/v1/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 30000);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? j?.error ?? "could not start training");
    return NextResponse.json(j);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
