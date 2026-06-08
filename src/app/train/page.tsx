"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Upload, X, Sparkles, Loader2, AlertTriangle, ArrowDownWideNarrow, ScanSearch, Copy, Droplet, FileWarning, UserX } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { uid } from "@/lib/uid";
import { usePersistentState } from "@/lib/usePersistentState";

interface TrainImg { id: string; dataUrl: string; caption: string }
interface AnalysisItem { index: number; outlier?: boolean; dup_group?: number | null; blurry?: boolean; caption_mismatch?: boolean; face_coverage?: number | null; coherence?: number }

// Meta/quality cruft to strip from auto-captions (mirrors the engine's set).
const META_TAGS = new Set(["highres", "absurdres", "lowres", "hires", "commentary", "commentary request", "english commentary", "artist name", "artist request", "signature", "watermark", "username", "web address", "dated", "logo", "character request", "copyright request", "copyright name", "bad id", "bad pixiv id", "md5 mismatch", "jpeg artifacts", "translated", "translation request", "reference sheet", "multiple views"]);
const parseTags = (c: string) => c.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
const pruneJunk = (tags: string[]) => tags.filter((t) => !META_TAGS.has(t.trim().toLowerCase()));
interface Job {
  job_id: string; state: string; step?: number; total?: number; loss?: number | null;
  lora?: string | null; error?: string | null;
  loss_history?: { step: number; loss: number }[];
  tags?: [string, number][];
  buckets?: Record<string, number>;
}

const inp = "w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--accent)] outline-none";
const SIZES = [
  { label: "Small 512×768 (8 GB-friendly)", w: 512, h: 768 },
  { label: "Compact 640×896", w: 640, h: 896 },
  { label: "Portrait 832×1216 (needs more VRAM)", w: 832, h: 1216 },
  { label: "Square 1024×1024", w: 1024, h: 1024 },
];

export default function TrainPage() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = usePersistentState("artifex:train:model", "");
  const [imgs, setImgs] = useState<TrainImg[]>([]);
  const [name, setName] = usePersistentState("artifex:train:name", "");
  const [trigger, setTrigger] = usePersistentState("artifex:train:trigger", "");
  const [steps, setSteps] = usePersistentState("artifex:train:steps", 800);
  const [rank, setRank] = usePersistentState("artifex:train:rank", 16);
  const [alpha, setAlpha] = usePersistentState("artifex:train:alpha", 8);
  const [lr, setLr] = usePersistentState("artifex:train:lr", 0.0001);
  const [captionImages, setCaptionImages] = usePersistentState("artifex:train:captionImages", true);
  const [pruneTags, setPruneTags] = usePersistentState("artifex:train:pruneTags", true);
  const [sampling, setSampling] = usePersistentState("artifex:train:sampling", "balance");
  const [sortOutliers, setSortOutliers] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, AnalysisItem>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [size, setSize] = usePersistentState("artifex:train:size", SIZES[0]);
  const [tte, setTte] = usePersistentState("artifex:train:tte", false);
  const [captioning, setCaptioning] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/artifex/models", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      setModels(d.models ?? []); setModel((c) => c || d.models?.[0] || "");
    }).catch(() => {});
  }, []);

  // Images handed over from the Gallery ("Send to Train").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("artifex:train-images");
      if (raw) {
        const urls: string[] = JSON.parse(raw);
        setImgs((p) => [...p, ...urls.map((u) => ({ id: uid(), dataUrl: u, caption: "" }))]);
        sessionStorage.removeItem("artifex:train-images");
      }
    } catch { /* ignore */ }
  }, []);

  // Poll the training job until it finishes.
  useEffect(() => {
    if (!job || ["completed", "failed", "cancelled"].includes(job.state)) return;
    let alive = true;
    const id = setInterval(async () => {
      try {
        const j = await fetch(`/api/artifex/train/${job.job_id}`, { cache: "no-store" }).then((r) => r.json());
        if (!alive) return;
        setJob(j);
        if (j.state === "completed") toast.success(`LoRA "${j.lora}" trained`);
        if (j.state === "failed") toast.error(j.error ?? "training failed");
        if (j.state === "cancelled") toast("Training cancelled");
      } catch { /* keep polling */ }
    }, 2000);
    return () => { alive = false; clearInterval(id); };
  }, [job]);

  const cancelTrain = () => job && fetch(`/api/artifex/train/${job.job_id}/cancel`, { method: "POST" }).catch(() => {});

  // Tag-cohesion per image (for outlier review): how mainstream each image's
  // tags are vs the whole set. Low = outlier — review/remove. Only meaningful
  // once images are captioned.
  const cohesion = useMemo(() => {
    const freq = new Map<string, number>();
    const tagsById = new Map<string, string[]>();
    let captioned = 0;
    for (const im of imgs) {
      const tags = pruneJunk(parseTags(im.caption));
      tagsById.set(im.id, tags);
      if (tags.length) captioned++;
      for (const t of new Set(tags)) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    const N = Math.max(1, captioned);
    const score = new Map<string, number>();
    for (const im of imgs) {
      const tags = tagsById.get(im.id) ?? [];
      score.set(im.id, tags.length ? tags.reduce((s, t) => s + (freq.get(t) ?? 0) / N, 0) / tags.length : 1);
    }
    const vals = [...score.values()];
    const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    return { score, isOutlier: (id: string) => captioned > 2 && (score.get(id) ?? 1) < 0.55 * mean, active: captioned > 2 };
  }, [imgs]);

  // Per-image issue flags: CLIP analysis (if run) wins; else the cheap tag-cohesion.
  const flagsFor = useCallback((id: string) => {
    const a = analysis[id];
    const f: { key: string; label: string; icon: React.ComponentType<{ size?: number }> }[] = [];
    if (a) {
      if (a.outlier) f.push({ key: "outlier", label: "Visual outlier", icon: AlertTriangle });
      if (a.dup_group != null) f.push({ key: "dup", label: `Duplicate (group ${a.dup_group + 1})`, icon: Copy });
      if (a.blurry) f.push({ key: "blur", label: "Blurry / low detail", icon: Droplet });
      if (a.caption_mismatch) f.push({ key: "caption", label: "Caption doesn't match image", icon: FileWarning });
      if (a.face_coverage != null && a.face_coverage > 0 && a.face_coverage < 0.02) f.push({ key: "face", label: "Tiny/no face", icon: UserX });
    } else if (cohesion.isOutlier(id)) {
      f.push({ key: "tagout", label: "Tag outlier", icon: AlertTriangle });
    }
    return f;
  }, [analysis, cohesion]);

  const ordered = useMemo(
    () => (sortOutliers
      ? [...imgs].sort((a, b) => (flagsFor(b.id).length - flagsFor(a.id).length) || ((cohesion.score.get(a.id) ?? 1) - (cohesion.score.get(b.id) ?? 1)))
      : imgs),
    [imgs, sortOutliers, cohesion, flagsFor],
  );

  const addFiles = (files: FileList | File[]) => {
    [...files].filter((f) => f.type.startsWith("image/")).forEach((f) => {
      const fr = new FileReader();
      fr.onload = () => setImgs((p) => [...p, { id: uid(), dataUrl: fr.result as string, caption: "" }]);
      fr.readAsDataURL(f);
    });
  };

  const autoCaption = useCallback(async () => {
    setCaptioning(true);
    try {
      for (const im of imgs) {
        if (im.caption.trim()) continue;
        try {
          const r = await fetch("/api/artifex/tag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: im.dataUrl }) });
          const d = await r.json();
          if (r.ok) {
            let tags: string[] = d.all ?? d.general ?? [];
            if (pruneTags) tags = pruneJunk(tags);
            const cap = tags.join(", ");
            setImgs((p) => p.map((x) => (x.id === im.id ? { ...x, caption: cap } : x)));
          }
        } catch { /* skip */ }
      }
      toast.success("Captioned (blank ones auto-fill at train time too)");
    } finally { setCaptioning(false); }
  }, [imgs, pruneTags]);

  const analyze = useCallback(async () => {
    if (imgs.length < 2) return toast.error("Add a few images first");
    setAnalyzing(true);
    try {
      const r = await fetch("/api/artifex/dataset/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imgs.map((i) => i.dataUrl), captions: imgs.map((i) => i.caption) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "analysis failed");
      const map: Record<string, AnalysisItem> = {};
      (d.items ?? []).forEach((it: AnalysisItem) => { const im = imgs[it.index]; if (im) map[im.id] = it; });
      setAnalysis(map);
      const s = d.summary ?? {};
      toast.success(`Analyzed · ${s.outliers || 0} outliers · ${s.duplicate_groups || 0} dup groups · ${s.blurry || 0} blurry · ${s.caption_mismatches || 0} caption issues`);
    } catch (e) { toast.error((e as Error).message); } finally { setAnalyzing(false); }
  }, [imgs]);

  const start = useCallback(async () => {
    if (!name.trim()) return toast.error("Name your LoRA");
    if (imgs.length < 4) return toast.error("Add at least ~4 training images");
    try {
      const r = await fetch("/api/artifex/train", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), model, trigger: trigger.trim() || undefined,
          images: imgs.map((i) => i.dataUrl), captions: imgs.map((i) => i.caption),
          autoCaption: captionImages, pruneTags, sampling, steps, rank, alpha, lr, width: size.w, height: size.h, train_text_encoder: tte,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "could not start training");
      setJob(j); toast.success("Training started");
    } catch (e) { toast.error((e as Error).message); }
  }, [name, model, trigger, imgs, captionImages, pruneTags, sampling, steps, rank, alpha, lr, size, tte]);

  const running = job && job.state !== "completed" && job.state !== "failed";
  const pct = job?.total ? Math.round(((job.step ?? 0) / job.total) * 100) : 0;
  const flaggedCount = imgs.filter((im) => flagsFor(im.id).length > 0).length;
  const analyzed = Object.keys(analysis).length > 0;

  return (
    <div className="animate-fade-in">
      <PageHeader icon={GraduationCap} title="train a lora" subtitle="Teach the model a character or style from a handful of images, then use it across the studio." />

      <div className="mb-4 rounded-lg border border-[var(--warn)] bg-[var(--warn-soft)] text-[var(--warn)] px-4 py-2.5 text-xs">
        Training is GPU-heavy and long — on the 8 GB 3070 expect many minutes and keep other generations idle while it runs (point at the 4090 for faster training).
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        {/* Images + captions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-[var(--fg-muted)]">
              Training images ({imgs.length})
              {flaggedCount > 0 && <span className="text-[var(--warn)]"> · {flaggedCount} flagged</span>}
            </label>
            <div className="flex gap-2">
              <button onClick={analyze} disabled={analyzing || imgs.length < 2} title="CLIP analysis: outliers, duplicates, blur, caption mismatch, face coverage"
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1 disabled:opacity-50">
                {analyzing ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />} Analyze
              </button>
              {flaggedCount > 0 && (
                <button onClick={() => setSortOutliers((v) => !v)} title="Sort flagged images (likely problems) to the top to review/remove"
                  className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${sortOutliers ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
                  <ArrowDownWideNarrow size={13} /> Flagged
                </button>
              )}
              {captionImages && (
                <button onClick={autoCaption} disabled={captioning || imgs.length === 0}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1 disabled:opacity-50">
                  {captioning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Auto-caption
                </button>
              )}
              <button onClick={() => fileRef.current?.click()} className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1"><Upload size={13} /> Add</button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />

          {imgs.length === 0 ? (
            <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              className="w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-14 text-sm text-[var(--fg-muted)] hover:border-[var(--accent)] flex flex-col items-center gap-1">
              <Upload size={22} /> Drop or click — 10–30 varied images of the subject
            </button>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {ordered.map((im) => {
                const flags = flagsFor(im.id);
                return (
                  <div key={im.id} className={`flex gap-2 items-start rounded-lg border bg-[var(--bg-elevated)] p-2 ${flags.length ? "border-[var(--warn)]" : "border-[var(--border)]"}`}>
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.dataUrl} alt="" className="w-16 h-16 object-cover rounded" />
                      {flags.length > 0 && (
                        <div className="absolute -top-1 -left-1 flex flex-col gap-0.5">
                          {flags.map((f) => { const I = f.icon; return <span key={f.key} title={f.label} className="bg-[var(--warn)] text-black rounded-full p-0.5"><I size={11} /></span>; })}
                        </div>
                      )}
                    </div>
                    <textarea className={`${inp} min-h-[64px] text-xs resize-y`} placeholder="caption (blank → auto WD14 at train time)" value={im.caption}
                      onChange={(e) => setImgs((p) => p.map((x) => (x.id === im.id ? { ...x, caption: e.target.value } : x)))} />
                    <button onClick={() => setImgs((p) => p.filter((x) => x.id !== im.id))} className="text-[var(--fg-muted)] hover:text-[var(--danger)] p-1"><X size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings + run */}
        <div className="space-y-3">
          <Field label="LoRA name"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="my-character" /></Field>
          <Field label="Trigger word (prepended to every caption)"><input className={inp} value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="e.g. mychar" /></Field>
          <Field label="Base model"><select className={inp} value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
          <Field label="Training size"><select className={inp} value={size.label} onChange={(e) => setSize(SIZES.find((s) => s.label === e.target.value) ?? SIZES[0])}>{SIZES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Steps"><input type="number" className={inp} value={steps} onChange={(e) => setSteps(Number(e.target.value))} /></Field>
            <Field label="Learning rate"><input type="number" step={0.00001} className={inp} value={lr} onChange={(e) => setLr(Number(e.target.value))} /></Field>
            <Field label="Rank"><input type="number" className={inp} value={rank} onChange={(e) => setRank(Number(e.target.value))} /></Field>
            <Field label="Alpha"><input type="number" className={inp} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} /></Field>
          </div>
          <Field label="Sampling">
            <select className={inp} value={sampling} onChange={(e) => setSampling(e.target.value)}>
              <option value="uniform">Uniform (every image equally)</option>
              <option value="balance">Balance rare concepts (flexible character)</option>
              <option value="cohesion">Favor core concept (tight look / style)</option>
            </select>
          </Field>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={captionImages} onChange={(e) => setCaptionImages(e.target.checked)} className="accent-[var(--accent)]" />
              Caption images (WD14)
            </label>
            {!captionImages && (
              <p className="text-xs text-[var(--fg-subtle)]">Style mode: trains on the trigger word only (no per-image captions) — good for style/aesthetic LoRAs.</p>
            )}
            {captionImages && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={pruneTags} onChange={(e) => setPruneTags(e.target.checked)} className="accent-[var(--accent)]" />
                Strip junk tags <span className="text-[10px] text-[var(--fg-subtle)]">(watermark, artist, quality cruft)</span>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={tte} onChange={(e) => setTte(e.target.checked)} className="accent-[var(--accent)]" />
              Train text encoder (slower, stronger)
            </label>
          </div>

          {job ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-sm font-medium mb-1 capitalize flex items-center gap-2">
                {running && <Loader2 size={14} className="animate-spin text-[var(--accent)]" />}
                {job.state}{job.state === "training" && job.total ? ` · ${job.step}/${job.total}` : ""}
              </div>
              {job.state === "training" && (
                <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden mb-1"><div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${pct}%` }} /></div>
              )}
              {job.loss != null && <div className="text-xs text-[var(--fg-subtle)]">loss {job.loss.toFixed(4)}</div>}
              {job.state === "completed" && <div className="text-sm text-[var(--success)]">✓ Saved “{job.lora}” — find it in LoRAs.</div>}
              {job.state === "failed" && <div className="text-sm text-[var(--danger)] break-words">{job.error}</div>}
              {job.state === "cancelled" && <div className="text-sm text-[var(--fg-muted)]">Cancelled — no LoRA saved.</div>}
              {running && (
                <button onClick={cancelTrain} className="mt-2 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]">Cancel training</button>
              )}
              {["completed", "failed", "cancelled"].includes(job.state) && (
                <button onClick={() => setJob(null)} className="mt-2 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]">Train another</button>
              )}
            </div>
          ) : (
            <button onClick={start} disabled={imgs.length < 4}
              className="w-full h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[var(--accent-hover)] shadow-[var(--shadow-accent)]">
              <GraduationCap size={17} /> Start training
            </button>
          )}
        </div>
      </div>

      {job && <TrainInsight job={job} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-[var(--fg-muted)] mb-1">{label}</label>{children}</div>;
}

function TrainInsight({ job }: { job: Job }) {
  const hist = job.loss_history ?? [];
  const tags = job.tags ?? [];
  const buckets = Object.entries(job.buckets ?? {});
  if (hist.length === 0 && tags.length === 0 && buckets.length === 0) return null;
  return (
    <div className="mt-5 grid lg:grid-cols-[1fr_360px] gap-5">
      {/* Loss curve */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="text-sm font-medium mb-2">Loss</div>
        {hist.length >= 2 ? <LossChart points={hist} /> : <p className="text-xs text-[var(--fg-subtle)]">Collecting loss samples…</p>}
        {hist.length > 0 && (
          <div className="text-xs text-[var(--fg-subtle)] mt-2">
            latest {hist[hist.length - 1].loss.toFixed(4)} · {hist.length} samples
          </div>
        )}
      </div>
      {/* Distributions */}
      <div className="space-y-4">
        {buckets.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-medium mb-2">Aspect buckets</div>
            <div className="flex flex-wrap gap-1.5">
              {buckets.sort((a, b) => b[1] - a[1]).map(([k, c]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs">{k} ×{c}</span>
              ))}
            </div>
          </div>
        )}
        {tags.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-medium mb-2">Concept distribution <span className="text-[10px] text-[var(--fg-subtle)] font-normal">(rarer = sampled more)</span></div>
            <div className="space-y-1.5">
              {(() => { const max = Math.max(...tags.map((t) => t[1])); return tags.map(([t, c]) => (
                <div key={t} className="flex items-center gap-2 text-xs">
                  <span className="w-28 truncate text-[var(--fg-muted)]" title={t}>{t}</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                    <div className="h-full bg-[var(--accent)]" style={{ width: `${(c / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-[var(--fg-subtle)]">{c}</span>
                </div>
              )); })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tiny dependency-free SVG line chart for the loss curve. */
function LossChart({ points }: { points: { step: number; loss: number }[] }) {
  const W = 600, H = 140, pad = 6;
  const xs = points.map((p) => p.step);
  const ys = points.map((p) => p.loss);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (x: number) => pad + ((x - minX) / Math.max(1, maxX - minX)) * (W - 2 * pad);
  const sy = (y: number) => pad + (1 - (y - minY) / Math.max(1e-9, maxY - minY)) * (H - 2 * pad);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.step).toFixed(1)},${sy(p.loss).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
