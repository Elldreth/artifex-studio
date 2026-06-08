"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useState that persists to localStorage under `key`, so a page's form settings
 * survive navigation and refresh. Loads the stored value on mount (one re-render
 * from the default) and writes on every change. SSR-safe — storage is only
 * touched inside effects. Don't use this for large blobs (images) — localStorage
 * is ~5MB; keep it to lightweight form values.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s !== null) setValue(JSON.parse(s) as T);
    } catch {
      /* corrupt/unavailable — keep default */
    }
    loaded.current = true;
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return; // don't overwrite storage with the default before load
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota/unavailable — ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
