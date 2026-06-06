"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanFace, Upload, X, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DetailerStack, cleanSlot, type Slot, type Detector } from "@/components/DetailerStack";
import { saveItem } from "@/lib/db";
import { uid } from "@/lib/uid";

interface Reg { reachable: boolean; detailers?: Slot[]; generic?: Slot; detectors?: Detector[] }
interface Models { models?: string[]; samplers?: string[]; schedulers?: string[]; defaultSampler?: { sampler?: string; scheduler?: string } }
interface Progress { active: boolean; stage?: string; step?: number; steps?: number; percent?: number; eta_s?: number | null; inflight?: number }

const inp = "w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--accent)] outline-none transition-colors";

export default function DetailerPage() {
  const [reg, setReg] = useState<Reg | null>(null);
  const [opt, setOpt] = useState<Models | null>(null);
  const [stack, setStack] = useState<Slot[]>([]);
  const [src, setSrc] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [sampler, setSampler] = useState("");
  const [scheduler, setScheduler] = useState("");

  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/artifex/detailers", { cache: "no-store" }).then((r) => r.json()).then((d: Reg) => {
      setReg(d);
      setStack((d.detailers ?? []).map(cleanSlot)); // seed with the tuned default pipeline
    }).catch(() => setReg({ reachable: false }));
    fetch("/api/artifex/models", { cache: "no-store" }).then((r) => r.json()).then((d: Models) => {
      setOpt(d);
      if (d.models?.length) setModel(d.models[0]);
      setSampler(d.defaultSampler?.sampler ?? "");
      setScheduler(d.defaultSampler?.scheduler ?? "");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!busy) return;
    let alive = true;
    const tick = async () => { try { const p = await fetch("/api/artifex/progress", { cache: "no-store" }).then((r) => r.json()); if (alive) setProg(p); } catch {} };
    tick(); const id = setInterval(tick, 800);
    return () => { alive = false; clearInterval(id); };
  }, [busy]);

  const loadFile = (f: File) => { const fr = new FileReader(); fr.onload = () => { setSrc(fr.result as string); setResult(null); }; fr.readAsDataURL(f); };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => { const it = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/")); if (it) { const f = it.getAsFile(); if (f) loadFile(f); } };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const run = useCallback(async () => {
    if (!src) return toast.error("Add a source image");
    if (stack.length === 0) return toast.error("Add at least one detector");
    setBusy(true); setProg(null); setResult(null);
    try {
      const r = await fetch("/api/artifex/detail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: src, model: model || undefined, basePrompt, sampler: sampler || undefined, scheduler: scheduler || undefined, pipeline: stack.map(cleanSlot) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "detailing failed");
      setResult(d.image);
      const applied = (d.applied ?? []).map((a: { region: string; regions: number }) => `${a.region}:${a.regions}`).join(" ");
      saveItem({ id: uid(), dataUrl: d.image, prompt: basePrompt || "(detailer)", model: model || "—", settings: { mode: "detail", regions: applied }, ts: Date.now() }).catch((e) => console.error(e));
      toast.success(`Detailed${applied ? ` · ${applied}` : ""}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); setProg(null); }
  }, [src, stack, model, basePrompt, sampler, scheduler]);

  const queued = (prog?.inflight ?? 0) > 1;

  return (
    <div className="animate-fade-in">
      <PageHeader icon={ScanFace} title="detailer" subtitle="Re-inpaint faces, hands, eyes and more on an existing image. Build a detector stack; it runs top to bottom." />
      {reg && !reg.reachable && (
        <div className="mb-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-sm">Artifex engine unreachable.</div>
      )}
      {reg?.reachable && (reg.detectors ?? []).length === 0 && (
        <div className="mb-4 rounded-lg border border-[var(--warn)] bg-[var(--warn-soft)] text-[var(--warn)] px-4 py-3 text-sm">
          No detectors installed on the engine — drop YOLO *.pt files in models/ultralytics/. Regions without a detector are skipped.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_1fr] gap-5">
        {/* Source + before/after */}
        <div className="space-y-3">
          <Field label="Source image">
            {src ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="source" className="w-full rounded-lg border border-[var(--border)]" />
                <button onClick={() => setSrc(null)} className="absolute top-2 right-2 p-1 rounded bg-black/60 text-white"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
                className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-10 text-sm text-[var(--fg-muted)] hover:border-[var(--accent)] flex flex-col items-center gap-1">
                <Upload size={20} /> Drop / paste / click to choose
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }} />
          </Field>

          {busy && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
              <div className="text-sm text-[var(--fg-muted)] mb-2">{queued ? `Queued · ${(prog!.inflight! - 1)} ahead` : (prog?.stage ?? "Starting…")}{prog?.steps ? ` · ${prog.step}/${prog.steps}` : ""}</div>
              <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden"><div className="h-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${prog?.percent ?? 0}%` }} /></div>
              <div className="text-xs text-[var(--fg-subtle)] mt-1.5">{prog?.percent != null ? `${prog.percent}%` : ""}{prog?.eta_s != null ? ` · ~${Math.round(prog.eta_s)}s left` : ""}</div>
            </div>
          )}
          {result && (
            <div>
              <div className="text-xs text-[var(--fg-muted)] mb-1">Result</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="result" className="w-full rounded-lg border border-[var(--accent)]" />
              <div className="flex gap-2 mt-2">
                <a href={result} download={`artifex-detail-${Date.now()}.png`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"><Download size={15} /> Download</a>
                <button onClick={() => { setSrc(result); setResult(null); }} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">Use as source</button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model"><select className={inp} value={model} onChange={(e) => setModel(e.target.value)}>{(opt?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
            <Field label="Sampler"><select className={inp} value={sampler} onChange={(e) => setSampler(e.target.value)}>{(opt?.samplers ?? []).map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          </div>
          <Field label="Scene / base prompt (combined with each region's hint)">
            <textarea className={`${inp} min-h-[60px] resize-y`} value={basePrompt} onChange={(e) => setBasePrompt(e.target.value)} placeholder="describe the subject + scene so regions regenerate in-context" />
          </Field>
          <div>
            <div className="text-sm font-medium mb-1">Detector stack</div>
            <DetailerStack value={stack} onChange={setStack} detectors={reg?.detectors ?? []} registry={reg?.detailers ?? []} generic={reg?.generic ?? {}} />
          </div>
          <button onClick={run} disabled={busy || !reg?.reachable}
            className="w-full h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors shadow-[var(--shadow-accent)]">
            <ScanFace size={17} /> {busy ? "Detailing…" : "Run detailer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-[var(--fg-muted)] mb-1">{label}</label>{children}</div>;
}
