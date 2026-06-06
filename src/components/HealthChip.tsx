"use client";

import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";

interface Health {
  reachable: boolean;
  device?: string | null;
  vram?: { used_gb: number; free_gb: number; total_gb: number };
}

/** Slim header chip: GPU + free VRAM, polled. Red when the service is down. */
export function HealthChip() {
  const [h, setH] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/artifex/health", { cache: "no-store" });
        const d = await r.json();
        if (alive) setH(d);
      } catch {
        if (alive) setH({ reachable: false });
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const ok = h?.reachable;
  const label = !h
    ? "…"
    : ok
      ? `${h.vram ? `${h.vram.free_gb.toFixed(1)} GB free` : "ready"}`
      : "offline";

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border"
      style={{
        borderColor: ok ? "var(--border)" : "var(--danger)",
        color: ok ? "var(--fg-muted)" : "var(--danger)",
        background: ok ? "var(--surface-2)" : "var(--danger-soft)",
      }}
      title={ok ? (h?.device ?? "Artifex") : "Artifex service unreachable"}
    >
      <Cpu size={13} className={ok ? "text-[var(--accent)]" : ""} />
      {label}
    </div>
  );
}
