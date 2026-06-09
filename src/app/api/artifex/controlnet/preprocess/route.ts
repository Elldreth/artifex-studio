import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Preview a ControlNet conditioning map for an image. */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (!b.image) return NextResponse.json({ error: "image is required" }, { status: 400 });
  try {
    const r = await artifexFetch("/v1/controlnet/preprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: b.image,
        preprocess: b.preprocess ?? "canny",
        low_threshold: b.low_threshold ?? 100,
        high_threshold: b.high_threshold ?? 200,
      }),
    }, 30000);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? j?.error ?? "preprocess failed");
    return NextResponse.json(j);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
