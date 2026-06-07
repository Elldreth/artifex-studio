import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { artifexFetch } from "@/lib/artifex";
import { runQueued } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  image: z.string().min(10),
  model: z.string().optional(),
  basePrompt: z.string().max(2000).optional(),
  negative: z.string().max(2000).optional(),
  sampler: z.string().optional(),
  scheduler: z.string().optional(),
  seed: z.number().int().optional(),
  pipeline: z.array(z.record(z.string(), z.unknown())).min(1),
  loras: z.array(z.object({ name: z.string(), weight: z.number() })).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const b = parsed.data;
  const payload = {
    image: b.image,
    ...(b.model ? { model: b.model } : {}),
    ...(b.basePrompt && b.basePrompt.trim() ? { base_prompt: b.basePrompt.trim() } : {}),
    ...(b.negative && b.negative.trim() ? { negative_prompt: b.negative.trim() } : {}),
    ...(b.sampler ? { sampler: b.sampler } : {}),
    ...(b.scheduler ? { scheduler: b.scheduler } : {}),
    ...(b.seed !== undefined ? { seed: b.seed } : {}),
    ...(b.loras && b.loras.length ? { loras: b.loras } : {}),
    pipeline: b.pipeline,
  };

  try {
    const data = await runQueued(async () => {
      const r = await artifexFetch(
        "/v1/images/detail",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        600000,
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? j?.error ?? "detailing failed");
      return j;
    });
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("engine returned no image");
    return NextResponse.json({ image: `data:image/png;base64,${b64}`, applied: data.applied ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
