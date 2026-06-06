import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { artifexFetch } from "@/lib/artifex";
import { runQueued } from "@/lib/queue";
import { buildDslPrompt } from "@/lib/dsl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  negative: z.string().max(2000).optional(),
  image: z.string().min(10), // data URL / base64 / http url (the source frame)
  strength: z.number().min(0.05).max(1),
  style: z.string().optional(),
  sampler: z.string().optional(),
  scheduler: z.string().optional(),
  steps: z.number().int().min(1).max(80).optional(),
  cfg: z.number().min(1).max(20).optional(),
  seed: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid request" }, { status: 400 });
  }
  const b = parsed.data;
  const payload = {
    model: b.model,
    prompt: buildDslPrompt(b),
    image: b.image,
    strength: b.strength,
    ...(b.negative && b.negative.trim() ? { negative_prompt: b.negative.trim() } : {}),
  };

  try {
    const data = await runQueued(async () => {
      const r = await artifexFetch(
        "/v1/images/img2img",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        600000,
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? j?.error ?? "img2img failed");
      return j;
    });
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("engine returned no image");
    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
