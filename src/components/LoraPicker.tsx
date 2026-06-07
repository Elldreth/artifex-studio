"use client";

export interface LoraSel { name: string; weight: number }

/** Multi-select list of installed LoRAs, each with a weight slider. Renders
 *  nothing when none are installed. Shared by Generate and Detailer. */
export function LoraPicker({ all, value, onChange }: { all: string[]; value: LoraSel[]; onChange: (v: LoraSel[]) => void }) {
  if (all.length === 0) return null;
  const toggle = (name: string) =>
    onChange(value.some((l) => l.name === name) ? value.filter((l) => l.name !== name) : [...value, { name, weight: 0.8 }]);
  return (
    <div>
      <label className="block text-xs text-[var(--fg-muted)] mb-1">LoRAs</label>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2 space-y-1.5 max-h-44 overflow-y-auto">
        {all.map((nm) => {
          const sel = value.find((l) => l.name === nm);
          return (
            <div key={nm} className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                <input type="checkbox" checked={!!sel} onChange={() => toggle(nm)} className="accent-[var(--accent)]" />
                <span className="truncate">{nm}</span>
              </label>
              {sel && (
                <input type="range" min={0} max={1.5} step={0.05} value={sel.weight}
                  onChange={(e) => onChange(value.map((l) => (l.name === nm ? { ...l, weight: Number(e.target.value) } : l)))}
                  className="w-24 accent-[var(--accent)]" title={`weight ${sel.weight}`} />
              )}
              {sel && <span className="text-xs text-[var(--fg-subtle)] w-8 text-right">{sel.weight}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
