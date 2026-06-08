import { NextResponse } from "next/server";
import { artifexFetch } from "@/lib/artifex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cancel the in-flight generation/img2img/detail. */
export async function POST() {
  try {
    const r = await artifexFetch("/v1/cancel", { method: "POST" }, 5000);
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: `engine unreachable: ${(e as Error).message}` }, { status: 502 });
  }
}
