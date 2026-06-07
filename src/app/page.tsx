"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Wand2, Shuffle, Lock, LockOpen, Download, ImageIcon, Layers } from "lucide-react";
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
  upscalers?: string[];
}

interface Progress {
  active: boolean; stage?: string; step?: number; steps?: number;
  percent?: number; eta_s?: number | null; inflight?: number;
}

const ASPECTS = [
  { label: "Portrait", w: 832, h: 1216 },
  { label: "Square", w: 1024, h: 1024 },
  { label: "Landscape", w: 1216, h: 832 },
  { label: "Tall", w: 768, h: 1344 },
  { label: "Wide", w: 1344, h: 768 },
];

const DEFAULT_NEG = "lowres, worst quality, low quality, blurry, bad anatomy, nsfw, nude, explicit";
const inp = "w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--accent)] outline-none transition-colors";

export default function GeneratePage() {
  const [opt, setOpt] = useState<Options | null>(null);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState(DEFAULT_NEG);
  const [style, setStyle] = useState("");
  const [sampler, setSampler] = useState("");
  const [scheduler, setScheduler] = useState("");
  const [steps, setSteps] = useState(30);
  const [cfg, setCfg] = useState(6);
  const [aspect, setAspect] = useState(ASPECTS[0]);
  const [seed, setSeed] = useState("");
  const [seedLocked, setSeedLocked] = useState(false);
  const [allLoras, setAllLoras] = useState<string[]>([]);
  const [loras, setLoras] = useState<{ name: string; weight: number }[]>([]);
  const [hiresOn, setHiresOn] = useState(false);
  const [hires, setHires] = useState(1.5);
  const [hiresDenoise, setHiresDenoise] = useState(0.4);
  const [hiresSteps, setHiresSteps] = useState(20);
  const [upscaler, setUpscaler] = useState("");

  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);

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
    fetch("/api/artifex/loras", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAllLoras((d.loras ?? []).map((l: unknown) => (typeof l === "string" ? l : (l as { name?: string; file?: string }).name ?? (l as { file?: string }).file ?? "")).filter(Boolean)))
      .catch(() => {});
  }, []);

  const toggleLora = (name: string) =>
    setLoras((p) => (p.some((l) => l.name === name) ? p.filter((l) => l.name !== name) : [...p, { name, weight: 0.8 }]));

  // Poll progress while a generation is in flight.
  useEffect(() => {
    if (!busy) return;
    let alive = true;
    const tick = async () => {
      try {
        const p = await fetch("/api/artifex/progress", { cache: "no-store" }).then((r) => r.json());
        if (alive) setProg(p);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 800);
    return () => { alive = false; clearInterval(id); };
  }, [busy]);

  const generate = useCallback(async () => {
    if (!model) { toast.error("Pick a model"); return; }
    if (!prompt.trim()) { toast.error("Enter a prompt"); return; }
    const usedSeed = seedLocked && seed.trim() !== "" ? Number(seed) : Math.floor(Math.random() * 2_000_000_000);
    if (!seedLocked) setSeed(String(usedSeed));
    setBusy(true); setProg(null); setImage(null);
    try {
      const r = await fetch("/api/artifex/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model, prompt, negative, style: style || undefined,
          sampler: sampler || undefined, scheduler: scheduler || undefined,
          steps, cfg, width: aspect.w, height: aspect.h, seed: usedSeed,
          loras: loras.length ? loras : undefined,
          ...(hiresOn ? { hires, hiresDenoise, hiresSteps, upscaler: upscaler || undefined } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "generation failed");
      setImage(d.image);
      saveItem({
        id: uid(), dataUrl: d.image, prompt, negative, model,
        settings: { style, sampler, scheduler, steps, cfg, width: aspect.w, height: aspect.h, seed: usedSeed, loras: loras.map((l) => `${l.name}:${l.weight}`).join(", ") || undefined, ...(hiresOn ? { hires: `${hires}x` } : {}) },
        ts: Date.now(),
      }).catch((e) => console.error("history save failed", e));
      toast.success("Generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false); setProg(null);
    }
  }, [model, prompt, negative, style, sampler, scheduler, steps, cfg, aspect, seed, seedLocked, loras, hiresOn, hires, hiresDenoise, hiresSteps, upscaler]);

  const queued = (prog?.inflight ?? 0) > 1;

  return (
    <div className="animate-fade-in">
      <PageHeader icon={Wand2} title="generate" subtitle="Create images with any model on the Artifex engine." />

      {opt && !opt.reachable && (
        <div className="mb-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-sm">
          Artifex engine unreachable. Check that the service is running and <code>ARTIFEX_URL</code> is set.
        </div>
      )}

      <div className="grid lg:grid-cols-[380px_1fr] gap-5">
        {/* ── Controls ── */}
        <div className="space-y-3">
          <Field label="Model">
            <select className={inp} value={model} onChange={(e) => setModel(e.target.value)}>
              {(opt?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Prompt">
            <textarea className={`${inp} min-h-[88px] resize-y`} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="a serene mountain lake at sunrise, highly detailed" />
          </Field>
          <Field label="Negative prompt">
            <textarea className={`${inp} min-h-[56px] resize-y`} value={negative} onChange={(e) => setNegative(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Style">
              <select className={inp} value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="">Model default</option>
                {(opt?.styles ?? []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Aspect">
              <select className={inp} value={aspect.label}
                onChange={(e) => setAspect(ASPECTS.find((a) => a.label === e.target.value) ?? ASPECTS[0])}>
                {ASPECTS.map((a) => <option key={a.label} value={a.label}>{a.label} · {a.w}×{a.h}</option>)}
              </select>
            </Field>
            <Field label="Sampler">
              <select className={inp} value={sampler} onChange={(e) => setSampler(e.target.value)}>
                {(opt?.samplers ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Scheduler">
              <select className={inp} value={scheduler} onChange={(e) => setScheduler(e.target.value)}>
                {(opt?.schedulers ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label={`Steps · ${steps}`}>
              <input type="range" min={10} max={60} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            </Field>
            <Field label={`CFG · ${cfg}`}>
              <input type="range" min={1} max={12} step={0.5} value={cfg} onChange={(e) => setCfg(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            </Field>
          </div>

          <Field label="Seed">
            <div className="flex gap-2">
              <input className={inp} value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="random each run" />
              <button onClick={() => setSeedLocked((v) => !v)} title={seedLocked ? "Seed locked" : "Seed random"}
                className="shrink-0 px-2.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]">
                {seedLocked ? <Lock size={15} /> : <LockOpen size={15} />}
              </button>
              <button onClick={() => { setSeed(String(Math.floor(Math.random() * 2_000_000_000))); setSeedLocked(true); }}
                title="Randomize + lock" className="shrink-0 px-2.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]">
                <Shuffle size={15} />
              </button>
            </div>
          </Field>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={hiresOn} onChange={(e) => setHiresOn(e.target.checked)} className="accent-[var(--accent)]" />
              <span className="font-medium">Hi-res fix</span>
              <span className="text-xs text-[var(--fg-subtle)] ml-auto">upscale + refine</span>
            </label>
            {hiresOn && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label={`Scale · ${hires}×`}>
                  <input type="range" min={1.25} max={2} step={0.05} value={hires} onChange={(e) => setHires(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
                </Field>
                <Field label={`Denoise · ${hiresDenoise}`}>
                  <input type="range" min={0.2} max={0.7} step={0.05} value={hiresDenoise} onChange={(e) => setHiresDenoise(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
                </Field>
                <Field label={`Steps · ${hiresSteps}`}>
                  <input type="range" min={10} max={40} value={hiresSteps} onChange={(e) => setHiresSteps(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
                </Field>
                <Field label="Upscaler">
                  <select className={inp} value={upscaler} onChange={(e) => setUpscaler(e.target.value)}>
                    <option value="">Latent</option>
                    {(opt?.upscalers ?? []).map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>

          {allLoras.length > 0 && (
            <Field label="LoRAs">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2 space-y-1.5 max-h-44 overflow-y-auto">
                {allLoras.map((nm) => {
                  const sel = loras.find((l) => l.name === nm);
                  return (
                    <div key={nm} className="flex items-center gap-2 text-sm">
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input type="checkbox" checked={!!sel} onChange={() => toggleLora(nm)} className="accent-[var(--accent)]" />
                        <span className="truncate">{nm}</span>
                      </label>
                      {sel && (
                        <input type="range" min={0} max={1.5} step={0.05} value={sel.weight}
                          onChange={(e) => setLoras((p) => p.map((l) => (l.name === nm ? { ...l, weight: Number(e.target.value) } : l)))}
                          className="w-24 accent-[var(--accent)]" title={`weight ${sel.weight}`} />
                      )}
                      {sel && <span className="text-xs text-[var(--fg-subtle)] w-8 text-right">{sel.weight}</span>}
                    </div>
                  );
                })}
              </div>
            </Field>
          )}

          <button onClick={generate} disabled={busy || !opt?.reachable}
            className="w-full h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors shadow-[var(--shadow-accent)]">
            <Wand2 size={17} /> {busy ? "Generating…" : "Generate"}
          </button>
        </div>

        {/* ── Result ── */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] min-h-[60vh] flex flex-col items-center justify-center p-4">
          {busy ? (
            <div className="w-full max-w-sm text-center">
              <div className="text-sm text-[var(--fg-muted)] mb-2">
                {queued ? `Queued · ${(prog!.inflight! - 1)} ahead` : (prog?.stage ?? "Starting…")}
                {prog?.steps ? ` · ${prog.step}/${prog.steps}` : ""}
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${prog?.percent ?? 0}%` }} />
              </div>
              <div className="text-xs text-[var(--fg-subtle)] mt-1.5">
                {prog?.percent != null ? `${prog.percent}%` : ""}{prog?.eta_s != null ? ` · ~${Math.round(prog.eta_s)}s left` : ""}
              </div>
            </div>
          ) : image ? (
            <div className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="result" onClick={() => setLightbox(true)}
                className="mx-auto max-h-[70vh] rounded-lg cursor-zoom-in" />
              <div className="flex justify-center gap-2 mt-3">
                <a href={image} download={`artifex-${Date.now()}.png`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
                  <Download size={15} /> Download
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center text-[var(--fg-subtle)]">
              <ImageIcon size={40} strokeWidth={1.5} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Your image will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {lightbox && image && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-zoom-out p-4" onClick={() => setLightbox(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="result" className="max-w-[96vw] max-h-[96vh] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--fg-muted)] mb-1">{label}</label>
      {children}
    </div>
  );
}
