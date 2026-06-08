import { describe, it, expect } from "vitest";
import { buildDslPrompt } from "@/lib/dsl";

describe("buildDslPrompt", () => {
  it("returns the prompt alone when no options are set", () => {
    expect(buildDslPrompt({ prompt: "a cat" })).toBe("a cat");
  });

  it("appends DSL flags in a stable order", () => {
    const s = buildDslPrompt({ prompt: "a cat", style: "anime", sampler: "euler", scheduler: "karras", steps: 30, cfg: 6, seed: 42 });
    expect(s).toBe("a cat --style anime --sampler euler --scheduler karras --steps 30 --cfg 6 --seed 42");
  });

  it("trims the prompt and omits unset flags", () => {
    expect(buildDslPrompt({ prompt: "  hi  ", steps: 20 })).toBe("hi --steps 20");
  });

  it("includes seed 0 (not treated as unset)", () => {
    expect(buildDslPrompt({ prompt: "x", seed: 0 })).toContain("--seed 0");
  });
});
