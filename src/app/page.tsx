"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Wand2, Shuffle, Lock, LockOpen, Download, ImageIcon, Layers, UserSquare, Upload, X, Network } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { saveItem } from "@/lib/db";
import { uid } from "@/lib/uid";
import { usePersistentState } from "@/lib/usePersistentState";
import { downscaleDataUrl } from "@/lib/image";

interface Options {
  reachable: boolean;
  models?: string[];
  samplers?: string[];
  schedulers?: string[];
  defaultSampler?: { sampler?: string; scheduler?: string };
  styles?: { id: string; label: string }[];
  upscalers?: string[];
  identity?: { id: string; label: string; default_scale?: number; experimental?: boolean }[];
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
  const [model, setModel] = usePersistentState("artifex:gen:model", "");
  const [prompt, setPrompt] = usePersistentState("artifex:gen:prompt", "");
  const [negative, setNegative] = usePersistentState("artifex:gen:negative", DEFAULT_NEG);
  const [style, setStyle] = usePersistentState("artifex:gen:style", "");
  const [sampler, setSampler] = usePersistentState("artifex:gen:sampler", "");
  const [scheduler, setScheduler] = usePersistentState("artifex:gen:scheduler", "");
  const [steps, setSteps] = usePersistentState("artifex:gen:steps", 30);
  const [cfg, setCfg] = usePersistentState("artifex:gen:cfg", 6);
  const [aspect, setAspect] = usePersistentState("artifex:gen:aspect", ASPECTS[0]);
  const [seed, setSeed] = usePersistentState("artifex:gen:seed", "");
  const [seedLocked, setSeedLocked] = usePersistentState("artifex:gen:seedLocked", false);
  const [allLoras, setAllLoras] = useState<string[]>([]);
  const [loras, setLoras] = usePersistentState<{ name: string; weight: number }[]>("artifex:gen:loras", []);
  const [hiresOn, setHiresOn] = usePersistentState("artifex:gen:hiresOn", false);
  const [hires, setHires] = usePersistentState("artifex:gen:hires", 1.5);
  const [hiresDenoise, setHiresDenoise] = usePersistentState("artifex:gen:hiresDenoise", 0.4);
  const [hiresSteps, setHiresSteps] = usePersistentState("artifex:gen:hiresSteps", 20);
  const [upscaler, setUpscaler] = usePersistentState("artifex:gen:upscaler", "");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [identityMethod, setIdentityMethod] = usePersistentState("artifex:gen:idMethod", "");
  const [identityScale, setIdentityScale] = usePersistentState("artifex:gen:idScale", 0.5);
  const [batch, setBatch] = usePersistentState("artifex:gen:batch", 1);
  const [presets, setPresets] = usePersistentState<Record<string, Record<string, unknown>>>("artifex:gen:presets", {});
  const [cnModels, setCnModels] = useState<{ name: string }[]>([]);
  const [cnPreprocessors, setCnPreprocessors] = useState<string[]>([]);
  const [cnModel, setCnModel] = usePersistentState("artifex:gen:cnModel", "");
  const [cnImage, setCnImage] = useState<string | null>(null);
  const [cnPreprocess, setCnPreprocess] = usePersistentState("artifex:gen:cnPre", "canny");
  const [cnScale, setCnScale] = usePersistentState("artifex:gen:cnScale", 0.8);
  const [cnLow, setCnLow] = usePersistentState("artifex:gen:cnLow", 100);
  const [cnHigh, setCnHigh] = usePersistentState("artifex:gen:cnHigh", 200);
  const [cnMap, setCnMap] = useState<string | null>(null);
  const refFileRef = useRef<HTMLInputElement>(null);
  const cnFileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [batchInfo, setBatchInfo] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [batchImages, setBatchImages] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    fetch("/api/artifex/models", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Options) => {
        setOpt(d);
        // Only fill from server defaults when there's no persisted choice.
        setModel((c) => c || d.models?.[0] || "");
        setSampler((c) => c || d.defaultSampler?.sampler || "");
        setScheduler((c) => c || d.defaultSampler?.scheduler || "");
        setIdentityMethod((c) => c || d.identity?.[0]?.id || "");
      })
      .catch(() => setOpt({ reachable: false }));
    fetch("/api/artifex/loras", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAllLoras((d.loras ?? []).map((l: unknown) => (typeof l === "string" ? l : (l as { name?: string; file?: string }).name ?? (l as { file?: string }).file ?? "")).filter(Boolean)))
      .catch(() => {});
    fetch("/api/artifex/controlnets", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.reachable) { setCnModels(d.models ?? []); setCnPreprocessors(d.preprocessors ?? []); setCnModel((c) => c || d.models?.[0]?.name || ""); } })
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
    const baseSeed = seedLocked && seed.trim() !== "" ? Number(seed) : null;
    const count = Math.max(1, Math.min(8, batch));
    setBusy(true); setProg(null); setImage(null); setBatchImages([]);
    // IP-Adapter reference: downscale once (modest res is plenty).
    const ref = refImage ? await downscaleDataUrl(refImage, 768, 0.92) : null;
    const cnImg = cnModel && cnImage ? await downscaleDataUrl(cnImage, 1024, 0.92) : null;
    const collected: string[] = [];
    try {
      for (let i = 0; i < count; i++) {
        if (count > 1) setBatchInfo(`${i + 1}/${count}`);
        const usedSeed = baseSeed != null ? baseSeed + i : Math.floor(Math.random() * 2_000_000_000);
        if (i === 0 && !seedLocked) setSeed(String(usedSeed));
        const r = await fetch("/api/artifex/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model, prompt, negative, style: style || undefined,
            sampler: sampler || undefined, scheduler: scheduler || undefined,
            steps, cfg, width: aspect.w, height: aspect.h, seed: usedSeed,
            loras: loras.length ? loras : undefined,
            ...(hiresOn ? { hires, hiresDenoise, hiresSteps, upscaler: upscaler || undefined } : {}),
            ...(ref ? { identityImage: ref, identityMethod: identityMethod || undefined, identityScale } : {}),
            ...(cnImg ? { controlnet: [{ model: cnModel, image: cnImg, scale: cnScale, preprocess: cnPreprocess, low_threshold: cnLow, high_threshold: cnHigh }] } : {}),
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "generation failed");
        setImage(d.image);
        collected.push(d.image);
        setBatchImages([...collected]);
        saveItem({
          id: uid(), dataUrl: d.image, prompt, negative, model,
          settings: { style, sampler, scheduler, steps, cfg, width: aspect.w, height: aspect.h, seed: usedSeed, loras: loras.map((l) => `${l.name}:${l.weight}`).join(", ") || undefined, ...(hiresOn ? { hires: `${hires}x` } : {}), ...(ref ? { identity: identityMethod } : {}) },
          ts: Date.now(),
        }).catch((e) => console.error("history save failed", e));
      }
      toast.success(count > 1 ? `Generated ${collected.length}` : "Generated");
    } catch (e) {
      const m = (e as Error).message;
      if (/cancel/i.test(m)) toast("Cancelled"); else toast.error(m);
    } finally {
      setBusy(false); setProg(null); setBatchInfo("");
    }
  }, [model, prompt, negative, style, sampler, scheduler, steps, cfg, aspect, seed, seedLocked, loras, hiresOn, hires, hiresDenoise, hiresSteps, upscaler, refImage, identityMethod, identityScale, batch, cnModel, cnImage, cnPreprocess, cnScale, cnLow, cnHigh]);

  const cancel = () => fetch("/api/artifex/cancel", { method: "POST" }).catch(() => {});

  const loadRef = (f: File) => { const fr = new FileReader(); fr.onload = () => setRefImage(fr.result as string); fr.readAsDataURL(f); };
  const loadCn = (f: File) => { const fr = new FileReader(); fr.onload = () => { setCnImage(fr.result as string); setCnMap(null); }; fr.readAsDataURL(f); };
  const previewCn = async () => {
    if (!cnImage) return;
    try {
      const small = await downscaleDataUrl(cnImage, 1024, 0.92);
      const r = await fetch("/api/artifex/controlnet/preprocess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: small, preprocess: cnPreprocess, low_threshold: cnLow, high_threshold: cnHigh }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "preprocess failed");
      setCnMap(d.image);
    } catch (e) { toast.error((e as Error).message); }
  };

  const applyPreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    if (p.prompt != null) setPrompt(String(p.prompt));
    if (p.negative != null) setNegative(String(p.negative));
    if (p.style != null) setStyle(String(p.style));
    if (p.sampler != null) setSampler(String(p.sampler));
    if (p.scheduler != null) setScheduler(String(p.scheduler));
    if (p.steps != null) setSteps(Number(p.steps));
    if (p.cfg != null) setCfg(Number(p.cfg));
    if (p.aspect) setAspect(p.aspect as (typeof ASPECTS)[number]);
    toast(`Loaded "${name}"`);
  };
  const savePreset = () => {
    const name = window.prompt("Preset name?")?.trim();
    if (!name) return;
    setPresets({ ...presets, [name]: { prompt, negative, style, sampler, scheduler, steps, cfg, aspect } });
    toast.success(`Saved "${name}"`);
  };
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
          <div className="flex gap-2">
            <select className={inp} value="" onChange={(e) => { if (e.target.value) applyPreset(e.target.value); }}>
              <option value="">{Object.keys(presets).length ? "Load preset…" : "No presets yet"}</option>
              {Object.keys(presets).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={savePreset} title="Save current settings as a preset" className="shrink-0 px-3 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--accent)]">Save</button>
          </div>
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

          <Field label={`Batch · ${batch} image${batch > 1 ? "s" : ""}`}>
            <input type="range" min={1} max={8} value={batch} onChange={(e) => setBatch(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </Field>

          {(opt?.identity?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <UserSquare size={15} className="text-[var(--accent)]" /> Reference image
                <span className="text-xs text-[var(--fg-subtle)] font-normal ml-auto">character consistency</span>
              </div>
              {refImage ? (
                <div className="flex gap-3 items-start mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={refImage} alt="reference" className="w-16 h-16 object-cover rounded shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <select className={inp} value={identityMethod} onChange={(e) => setIdentityMethod(e.target.value)}>
                      {(opt?.identity ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <Field label={`Strength · ${identityScale}`}>
                      <input type="range" min={0.1} max={1.2} step={0.05} value={identityScale} onChange={(e) => setIdentityScale(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
                    </Field>
                  </div>
                  <button onClick={() => setRefImage(null)} className="text-[var(--fg-muted)] hover:text-[var(--danger)] p-1"><X size={15} /></button>
                </div>
              ) : (
                <button onClick={() => refFileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadRef(f); }}
                  className="w-full mt-1 rounded-lg border border-dashed border-[var(--border)] py-4 text-xs text-[var(--fg-muted)] hover:border-[var(--accent)] flex flex-col items-center gap-1">
                  <Upload size={16} /> Drop / click a face or character reference
                </button>
              )}
              <input ref={refFileRef} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files?.[0]) loadRef(e.target.files[0]); }} />
            </div>
          )}

          {cnModels.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                <Network size={15} className="text-[var(--accent)]" /> ControlNet
                <span className="text-xs text-[var(--fg-subtle)] font-normal ml-auto">structure guidance</span>
              </div>
              {cnImage ? (
                <div className="space-y-2 mt-2">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cnMap ?? cnImage} alt="control" className="w-full max-h-44 object-contain rounded border border-[var(--border)] bg-black" />
                    <button onClick={() => { setCnImage(null); setCnMap(null); }} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white"><X size={13} /></button>
                    {cnMap && <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">control map</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Model"><select className={inp} value={cnModel} onChange={(e) => setCnModel(e.target.value)}>{cnModels.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}</select></Field>
                    <Field label="Preprocess"><select className={inp} value={cnPreprocess} onChange={(e) => { setCnPreprocess(e.target.value); setCnMap(null); }}>{cnPreprocessors.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
                  </div>
                  {cnPreprocess === "canny" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={`Canny low · ${cnLow}`}><input type="range" min={0} max={255} value={cnLow} onChange={(e) => { setCnLow(Number(e.target.value)); setCnMap(null); }} className="w-full accent-[var(--accent)]" /></Field>
                      <Field label={`Canny high · ${cnHigh}`}><input type="range" min={0} max={255} value={cnHigh} onChange={(e) => { setCnHigh(Number(e.target.value)); setCnMap(null); }} className="w-full accent-[var(--accent)]" /></Field>
                    </div>
                  )}
                  <Field label={`Strength · ${cnScale}`}><input type="range" min={0} max={2} step={0.05} value={cnScale} onChange={(e) => setCnScale(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
                  <button onClick={previewCn} className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] hover:border-[var(--accent)]">Preview control map</button>
                </div>
              ) : (
                <button onClick={() => cnFileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadCn(f); }}
                  className="w-full mt-1 rounded-lg border border-dashed border-[var(--border)] py-4 text-xs text-[var(--fg-muted)] hover:border-[var(--accent)] flex flex-col items-center gap-1">
                  <Upload size={16} /> Drop / click a control image (pose, depth, edges…)
                </button>
              )}
              <input ref={cnFileRef} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files?.[0]) loadCn(e.target.files[0]); }} />
            </div>
          )}

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
                {batchInfo ? `Image ${batchInfo} · ` : ""}
                {queued ? `Queued · ${(prog!.inflight! - 1)} ahead` : (prog?.stage ?? "Starting…")}
                {prog?.steps ? ` · ${prog.step}/${prog.steps}` : ""}
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${prog?.percent ?? 0}%` }} />
              </div>
              <div className="text-xs text-[var(--fg-subtle)] mt-1.5">
                {prog?.percent != null ? `${prog.percent}%` : ""}{prog?.eta_s != null ? ` · ~${Math.round(prog.eta_s)}s left` : ""}
              </div>
              <button onClick={cancel} className="mt-4 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]">Cancel</button>
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
              {batchImages.length > 1 && (
                <div className="flex flex-wrap gap-2 mt-3 justify-center">
                  {batchImages.map((img, i) => (
                    <button key={i} onClick={() => setImage(img)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border ${img === image ? "border-[var(--accent)] ring-2 ring-[var(--accent-ring)]" : "border-[var(--border)]"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
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
