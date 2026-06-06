import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";
import { runQueued } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** WD1.4 booru tags for an image. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.image) return NextResponse.json({ error: "image is required" }, { status: 400 });
  try {
    const j = await runQueued(async () => {
      const r = await artifexFetch("/v1/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: body.image,
          general_threshold: body.general_threshold ?? 0.35,
          character_threshold: body.character_threshold ?? 0.85,
          underscores: body.underscores ?? false,
        }),
      }, 60000);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message ?? data?.error ?? "tagging failed");
      return data;
    });
    return NextResponse.json(j);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
