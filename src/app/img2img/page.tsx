"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Images as ImagesIcon, Shuffle, Lock, LockOpen, Download, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { saveItem } from "@/lib/db";
import { uid } from "@/lib/uid";

interface Options {
  reachable: boolean;
  models?: string[];
  samplers?: string[];
  schedulers?: string[];
  defaultSampler?: { sampler?: string; scheduler?: string };
  styles?: { id: string; label: string }[];
}
interface Progress { active: boolean; stage?: string; step?: number; steps?: number; percent?: number; eta_s?: number | null; inflight?: number }

const DEFAULT_NEG = "lowres, worst quality, low quality, blurry, bad anatomy, nsfw, nude, explicit";
const inp = "w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--accent)] outline-none transition-colors";

export default function Img2ImgPage() {
  const [opt, setOpt] = useState<Options | null>(null);
  const [model, setModel] = useState("");
  const [src, setSrc] = useState<string | null>(null);
  const [strength, setStrength] = useState(0.5);
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState(DEFAULT_NEG);
  const [style, setStyle] = useState("");
  const [sampler, setSampler] = useState("");
  const [scheduler, setScheduler] = useState("");
  const [steps, setSteps] = useState(30);
  const [cfg, setCfg] = useState(6);
  const [seed, setSeed] = useState("");
  const [seedLocked, setSeedLocked] = useState(false);

  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/artifex/models", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Options) => {
        setOpt(d);
        if (d.models?.length) setModel(d.models[0]);
        setSampler(d.defaultSampler?.sampler ?? "");
        setScheduler(d.defaultSampler?.scheduler ?? "");
      })
      .catch(() => setOpt({ reachable: false }));
  }, []);

  useEffect(() => {
    if (!busy) return;
    let alive = true;
    const tick = async () => {
      try { const p = await fetch("/api/artifex/progress", { cache: "no-store" }).then((r) => r.json()); if (alive) setProg(p); } catch {}
    };
    tick();
    const id = setInterval(tick, 800);
    return () => { alive = false; clearInterval(id); };
  }, [busy]);

  const loadFile = (f: File) => {
    const fr = new FileReader();
    fr.onload = () => { setSrc(fr.result as string); setImage(null); };
    fr.readAsDataURL(f);
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const it = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (it) { const f = it.getAsFile(); if (f) loadFile(f); }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const generate = useCallback(async () => {
    if (!model) return toast.error("Pick a model");
    if (!src) return toast.error("Add a source image");
    if (!prompt.trim()) return toast.error("Enter a prompt");
    const usedSeed = seedLocked && seed.trim() !== "" ? Number(seed) : Math.floor(Math.random() * 2_000_000_000);
    if (!seedLocked) setSeed(String(usedSeed));
    setBusy(true); setProg(null); setImage(null);
    try {
      const r = await fetch("/api/artifex/img2img", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, negative, image: src, strength, style: style || undefined, sampler: sampler || undefined, scheduler: scheduler || undefined, steps, cfg, seed: usedSeed }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "img2img failed");
      setImage(d.image);
      saveItem({ id: uid(), dataUrl: d.image, prompt, negative, model, settings: { mode: "img2img", strength, style, sampler, scheduler, steps, cfg, seed: usedSeed }, ts: Date.now() }).catch((e) => console.error("history save failed", e));
      toast.success("Generated");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); setProg(null); }
  }, [model, src, strength, prompt, negative, style, sampler, scheduler, steps, cfg, seed, seedLocked]);

  const queued = (prog?.inflight ?? 0) > 1;

  return (
    <div className="animate-fade-in">
      <PageHeader icon={ImagesIcon} title="image to image" subtitle="Restyle or refine an existing image — upload or paste a source, then describe the change." />
      {opt && !opt.reachable && (
        <div className="mb-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-sm">Artifex engine unreachable.</div>
      )}

      <div className="grid lg:grid-cols-[380px_1fr] gap-5">
        <div className="space-y-3">
          <Field label="Source image">
            {src ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="source" className="w-full rounded-lg border border-[var(--border)]" />
                <button onClick={() => setSrc(null)} className="absolute top-2 right-2 p-1 rounded bg-black/60 text-white"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
                className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-8 text-sm text-[var(--fg-muted)] hover:border-[var(--accent)] flex flex-col items-center gap-1">
                <Upload size={20} /> Drop / paste / click to choose
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }} />
          </Field>

          <Field label={`Strength · ${strength}  (low = keep source, high = restyle)`}>
            <input type="range" min={0.2} max={0.9} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </Field>

          <Field label="Model">
            <select className={inp} value={model} onChange={(e) => setModel(e.target.value)}>
              {(opt?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Prompt"><textarea className={`${inp} min-h-[72px] resize-y`} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="same character, new outfit, golden hour" /></Field>
          <Field label="Negative prompt"><textarea className={`${inp} min-h-[48px] resize-y`} value={negative} onChange={(e) => setNegative(e.target.value)} /></Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Style">
              <select className={inp} value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="">Model default</option>
                {(opt?.styles ?? []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Sampler">
              <select className={inp} value={sampler} onChange={(e) => setSampler(e.target.value)}>{(opt?.samplers ?? []).map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </Field>
            <Field label="Scheduler">
              <select className={inp} value={scheduler} onChange={(e) => setScheduler(e.target.value)}>{(opt?.schedulers ?? []).map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </Field>
            <Field label={`Steps · ${steps}`}><input type="range" min={10} max={60} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
          </div>
          <Field label={`CFG · ${cfg}`}><input type="range" min={1} max={12} step={0.5} value={cfg} onChange={(e) => setCfg(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
          <Field label="Seed">
            <div className="flex gap-2">
              <input className={inp} value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="random each run" />
              <button onClick={() => setSeedLocked((v) => !v)} className="shrink-0 px-2.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]">{seedLocked ? <Lock size={15} /> : <LockOpen size={15} />}</button>
              <button onClick={() => { setSeed(String(Math.floor(Math.random() * 2_000_000_000))); setSeedLocked(true); }} className="shrink-0 px-2.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"><Shuffle size={15} /></button>
            </div>
          </Field>

          <button onClick={generate} disabled={busy || !opt?.reachable}
            className="w-full h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors shadow-[var(--shadow-accent)]">
            <ImagesIcon size={17} /> {busy ? "Generating…" : "Transform"}
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] min-h-[60vh] flex flex-col items-center justify-center p-4">
          {busy ? (
            <div className="w-full max-w-sm text-center">
              <div className="text-sm text-[var(--fg-muted)] mb-2">
                {queued ? `Queued · ${(prog!.inflight! - 1)} ahead` : (prog?.stage ?? "Starting…")}{prog?.steps ? ` · ${prog.step}/${prog.steps}` : ""}
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${prog?.percent ?? 0}%` }} />
              </div>
              <div className="text-xs text-[var(--fg-subtle)] mt-1.5">{prog?.percent != null ? `${prog.percent}%` : ""}{prog?.eta_s != null ? ` · ~${Math.round(prog.eta_s)}s left` : ""}</div>
            </div>
          ) : image ? (
            <div className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="result" className="mx-auto max-h-[70vh] rounded-lg" />
              <div className="flex justify-center gap-2 mt-3">
                <a href={image} download={`artifex-${Date.now()}.png`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"><Download size={15} /> Download</a>
                <button onClick={() => setSrc(image)} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">Use as source</button>
              </div>
            </div>
          ) : (
            <div className="text-center text-[var(--fg-subtle)]"><ImagesIcon size={40} strokeWidth={1.5} className="mx-auto mb-2 opacity-50" /><p className="text-sm">Add a source image and describe the change.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-[var(--fg-muted)] mb-1">{label}</label>{children}</div>;
}
