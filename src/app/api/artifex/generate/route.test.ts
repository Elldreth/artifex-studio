import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/artifex", () => ({ artifexFetch: vi.fn() }));

import { POST } from "./route";
import { artifexFetch } from "@/lib/artifex";

const mockFetch = artifexFetch as unknown as ReturnType<typeof vi.fn>;
const req = (body: unknown) =>
  new Request("http://test/api/artifex/generate", { method: "POST", body: JSON.stringify(body) }) as never;

describe("POST /api/artifex/generate", () => {
  beforeEach(() => mockFetch.mockReset());

  it("rejects an invalid body with 400", async () => {
    const r = await POST(req({ prompt: "x" })); // missing model + size
    expect(r.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("builds the DSL prompt + size and returns a data URL", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: "AAA" }] }), { status: 200 }));
    const r = await POST(req({ model: "m", prompt: "cat", steps: 30, cfg: 6, width: 832, height: 1216, sampler: "euler" }));
    const j = await r.json();
    expect(j.image).toBe("data:image/png;base64,AAA");

    const sent = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sent.size).toBe("832x1216");
    expect(sent.prompt).toContain("--sampler euler");
    expect(sent.prompt).toContain("--steps 30");
  });

  it("forwards the IP-Adapter reference fields", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: "AAA" }] }), { status: 200 }));
    await POST(req({ model: "m", prompt: "cat", width: 1024, height: 1024, identityImage: "data:image/png;base64,zzzz", identityMethod: "ipadapter", identityScale: 0.6 }));
    const sent = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sent.identity_image).toBe("data:image/png;base64,zzzz");
    expect(sent.identity_method).toBe("ipadapter");
    expect(sent.identity_scale).toBe(0.6);
  });

  it("forwards a ControlNet spec", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: "AAA" }] }), { status: 200 }));
    await POST(req({ model: "m", prompt: "cat", width: 1024, height: 1024, controlnet: [{ model: "canny-xl", image: "data:image/png;base64,zzzz", scale: 0.7, preprocess: "canny" }] }));
    const sent = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sent.controlnet[0].model).toBe("canny-xl");
    expect(sent.controlnet[0].scale).toBe(0.7);
  });

  it("surfaces an engine error as 502", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 }));
    const r = await POST(req({ model: "m", prompt: "cat", width: 1024, height: 1024 }));
    expect(r.status).toBe(502);
    expect((await r.json()).error).toBe("boom");
  });
});
