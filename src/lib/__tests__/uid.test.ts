import { describe, it, expect } from "vitest";
import { uid } from "@/lib/uid";

describe("uid", () => {
  it("returns a non-empty string", () => {
    expect(typeof uid()).toBe("string");
    expect(uid().length).toBeGreaterThan(0);
  });

  it("returns distinct values", () => {
    const set = new Set(Array.from({ length: 50 }, () => uid()));
    expect(set.size).toBe(50);
  });
});
