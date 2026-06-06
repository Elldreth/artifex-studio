"use client";

import { Plus, ArrowUp, ArrowDown, X } from "lucide-react";

export type Slot = Record<string, unknown>;
export interface Detector { detector: string; seg: boolean }

const mini = "w-full h-8 px-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-sm";
const NUM = (v: string) => (v === "" ? undefined : Number(v));
const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const n = (v: unknown, d: number) => (v === undefined || v === null ? String(d) : String(v));

const SLOT_KEYS = ["detector", "key", "denoise", "loops", "loop_color_match", "conf", "padding", "blur", "dilate_erode", "steps", "max", "seg", "prompt"];
/** Strip non-profile keys (e.g. the `installed` flag on the registry payload). */
export function cleanSlot(slot: Slot): Slot {
  const out: Slot = {};
  for (const k of SLOT_KEYS) if (slot[k] !== undefined) out[k] = slot[k];
  return out;
}

export function defaultSlot(detector: string, registry: Slot[], generic: Slot): Slot {
  const reg = registry.find((r) => r.detector === detector);
  if (reg) return cleanSlot(reg);
  return cleanSlot({ ...generic, detector, seg: /_seg/i.test(detector), key: detector.replace(".pt", ""), prompt: "" });
}

export function DetailerStack({
  value, onChange, detectors, registry, generic,
}: {
  value: Slot[];
  onChange: (v: Slot[]) => void;
  detectors: Detector[];
  registry: Slot[];
  generic: Slot;
}) {
  const swap = (i: number, j: number) => { const c = [...value]; [c[i], c[j]] = [c[j], c[i]]; onChange(c); };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-[var(--fg-muted)]">runs top → bottom · empty = none</span>
        <button
          onClick={() => onChange([...value, defaultSlot(detectors[0]?.detector ?? "", registry, generic)])}
          disabled={detectors.length === 0}
          className="ml-auto text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1 disabled:opacity-50"
        ><Plus size={13} /> Add detector</button>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-[var(--fg-muted)] border border-dashed border-[var(--border)] rounded-lg p-4 text-center">
          No detailers — the image passes through untouched.
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((slot, i) => {
            const upd = (k: string, v: unknown) => onChange(value.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
            const onDetector = (det: string) => {
              const def = defaultSlot(det, registry, generic);
              onChange(value.map((x, j) => (j === i ? { ...x, detector: det, seg: def.seg, key: def.key, prompt: x.prompt || def.prompt || "" } : x)));
            };
            const schedule = Array.isArray(slot.denoise) ? (slot.denoise as number[]).join(",") : "";
            const dn = Array.isArray(slot.denoise) ? "" : s(slot.denoise);
            return (
              <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <select className={`${mini} flex-1`} value={s(slot.detector)} onChange={(e) => onDetector(e.target.value)}>
                    {detectors.map((d) => <option key={d.detector} value={d.detector}>{d.detector}</option>)}
                  </select>
                  <input className={`${mini} w-28`} value={s(slot.key)} placeholder="label" onChange={(e) => upd("key", e.target.value)} />
                  <IconBtn onClick={() => i > 0 && swap(i, i - 1)}><ArrowUp size={13} /></IconBtn>
                  <IconBtn onClick={() => i < value.length - 1 && swap(i, i + 1)}><ArrowDown size={13} /></IconBtn>
                  <IconBtn onClick={() => onChange(value.filter((_, j) => j !== i))}><X size={13} /></IconBtn>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Cell label="Schedule" wide>
                    <input className={mini} value={schedule} placeholder="0.7,0.4,0.4"
                      onChange={(e) => { const t = e.target.value.trim(); upd("denoise", t ? t.split(",").map((x) => Number(x.trim())).filter((v) => !isNaN(v)) : Number(dn || (generic.denoise as number) || 0.4)); }} />
                  </Cell>
                  <Cell label="Denoise"><input type="number" step={0.05} className={mini} value={dn} disabled={!!schedule} onChange={(e) => upd("denoise", NUM(e.target.value) ?? 0.4)} /></Cell>
                  <Cell label="Loops"><input type="number" className={mini} value={n(slot.loops, 1)} disabled={!!schedule} onChange={(e) => upd("loops", Number(e.target.value))} /></Cell>
                  <Cell label="Color-match"><input type="number" step={0.1} className={mini} value={n(slot.loop_color_match, 1)} onChange={(e) => upd("loop_color_match", Number(e.target.value))} /></Cell>
                  <Cell label="Padding"><input type="number" step={0.1} className={mini} value={n(slot.padding, 0.4)} onChange={(e) => upd("padding", Number(e.target.value))} /></Cell>
                  <Cell label="Dilate"><input type="number" className={mini} value={n(slot.dilate_erode, 4)} onChange={(e) => upd("dilate_erode", Number(e.target.value))} /></Cell>
                  <Cell label="Blur"><input type="number" className={mini} value={n(slot.blur, 4)} onChange={(e) => upd("blur", Number(e.target.value))} /></Cell>
                  <Cell label="Conf"><input type="number" step={0.05} className={mini} value={n(slot.conf, 0.3)} onChange={(e) => upd("conf", Number(e.target.value))} /></Cell>
                  <Cell label="Steps"><input type="number" className={mini} value={n(slot.steps, 30)} onChange={(e) => upd("steps", Number(e.target.value))} /></Cell>
                  <Cell label="Max"><input type="number" className={mini} value={n(slot.max, 4)} onChange={(e) => upd("max", Number(e.target.value))} /></Cell>
                  <Cell label="Mask">
                    <select className={mini} value={String(slot.seg ?? true)} onChange={(e) => upd("seg", e.target.value === "true")}>
                      <option value="true">polygon</option><option value="false">box</option>
                    </select>
                  </Cell>
                </div>
                <Cell label="Prompt (blank = scene prompt)" wide>
                  <input className={mini} value={s(slot.prompt)} placeholder="blank → uses the scene prompt" onChange={(e) => upd("prompt", e.target.value)} />
                </Cell>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--accent)]">{children}</button>;
}
function Cell({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? "col-span-4 mt-2" : ""}><label className="block text-[10px] uppercase tracking-wide text-[var(--fg-subtle)] mb-0.5">{label}</label>{children}</div>;
}
