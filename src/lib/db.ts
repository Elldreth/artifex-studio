"use client";

/**
 * Browser-local generation history (IndexedDB). Stores the PNG as a data URL plus
 * the settings used, so the gallery can preview, re-use, and download — no server
 * storage. Capped to the newest MAX items so it can't grow unbounded.
 */
export interface HistItem {
  id: string;
  dataUrl: string;
  prompt: string;
  negative?: string;
  model: string;
  settings: Record<string, unknown>;
  ts: number;
}

const DB = "artifex-studio";
const STORE = "history";
const MAX = 200;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export async function listItems(): Promise<HistItem[]> {
  const all = await tx<HistItem[]>("readonly", (s) => s.getAll() as IDBRequest<HistItem[]>);
  return all.sort((a, b) => b.ts - a.ts);
}

export async function saveItem(item: HistItem): Promise<void> {
  await tx("readwrite", (s) => s.put(item) as IDBRequest);
  // Prune oldest beyond MAX.
  const items = await listItems();
  if (items.length > MAX) {
    for (const old of items.slice(MAX)) await deleteItem(old.id);
  }
}

export async function deleteItem(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id) as IDBRequest);
}

export async function clearAll(): Promise<void> {
  await tx("readwrite", (s) => s.clear() as IDBRequest);
}
