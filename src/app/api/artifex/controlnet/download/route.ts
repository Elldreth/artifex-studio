import { NextRequest, NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download a diffusers-format SDXL ControlNet from a HuggingFace repo id. */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const repo = typeof b.repo === "string" ? b.repo.trim() : "";
  if (!repo || !repo.includes("/")) {
    return NextResponse.json(
      { error: "Expected a HuggingFace repo id like 'diffusers/controlnet-depth-sdxl-1.0'." },
      { status: 400 },
    );
  }
  try {
    // Large files (~2.5 GB) over the array — allow plenty of time.
    const r = await artifexFetch("/v1/controlnets/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo }),
    }, 1_800_000);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? j?.error ?? "download failed");
    return NextResponse.json(j);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
