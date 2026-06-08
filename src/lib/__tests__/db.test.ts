import { describe, it, expect, beforeEach } from "vitest";
import { saveItem, listItems, deleteItem, clearAll, type HistItem } from "@/lib/db";

const item = (id: string, ts: number): HistItem => ({ id, dataUrl: "x", prompt: "p", model: "m", settings: {}, ts });

describe("history db (IndexedDB)", () => {
  beforeEach(async () => { await clearAll(); });

  it("saves and lists newest-first", async () => {
    await saveItem(item("a", 1));
    await saveItem(item("b", 2));
    const items = await listItems();
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("deletes a single item", async () => {
    await saveItem(item("a", 1));
    await saveItem(item("b", 2));
    await deleteItem("a");
    expect((await listItems()).map((i) => i.id)).toEqual(["b"]);
  });

  it("clears all", async () => {
    await saveItem(item("a", 1));
    await clearAll();
    expect(await listItems()).toHaveLength(0);
  });
});
