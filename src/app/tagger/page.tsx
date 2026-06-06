"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Tags, Upload, X, Copy, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface TagResult { all?: string[]; general?: string[]; character?: string[]; rating?: Record<string, number> }
const inp = "w-full rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-2 text-sm focus:border-[var(--accent)] outline-none";

export default function TaggerPage() {
  const [src, setSrc] = useState<string | null>(null);
  const [gen, setGen] = useState(0.35);
  const [chr, setChr] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TagResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (f: File) => { const fr = new FileReader(); fr.onload = () => { setSrc(fr.result as string); setRes(null); }; fr.readAsDataURL(f); };

  const run = useCallback(async () => {
    if (!src) return toast.error("Add an image");
    setBusy(true); setRes(null);
    try {
      const r = await fetch("/api/artifex/tag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: src, general_threshold: gen, character_threshold: chr }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "tagging failed");
      setRes(d);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }, [src, gen, chr]);

  const allTags = (res?.all ?? [...(res?.character ?? []), ...(res?.general ?? [])]).join(", ");

  return (
    <div className="animate-fade-in">
      <PageHeader icon={Tags} title="tagger" subtitle="Read WD1.4 booru tags from an image — handy for prompts and captioning training sets." />
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          {src ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full rounded-lg border border-[var(--border)]" />
              <button onClick={() => setSrc(null)} className="absolute top-2 right-2 p-1 rounded bg-black/60 text-white"><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
              className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] py-12 text-sm text-[var(--fg-muted)] hover:border-[var(--accent)] flex flex-col items-center gap-1"><Upload size={20} /> Drop / click to choose</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-[var(--fg-muted)] mb-1">General threshold · {gen}</label><input type="range" min={0.1} max={0.9} step={0.05} value={gen} onChange={(e) => setGen(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></div>
            <div><label className="block text-xs text-[var(--fg-muted)] mb-1">Character threshold · {chr}</label><input type="range" min={0.1} max={0.95} step={0.05} value={chr} onChange={(e) => setChr(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></div>
          </div>
          <button onClick={run} disabled={busy || !src} className="w-full h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[var(--accent-hover)] shadow-[var(--shadow-accent)]">{busy ? <Loader2 size={17} className="animate-spin" /> : <Tags size={17} />} {busy ? "Tagging…" : "Tag image"}</button>
        </div>

        <div>
          {res ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">Tags</span>
                <button onClick={() => { navigator.clipboard?.writeText(allTags).then(() => toast.success("Copied")).catch(() => toast.error("Copy needs https/localhost")); }} className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1"><Copy size={13} /> Copy all</button>
              </div>
              <textarea readOnly className={`${inp} min-h-[120px] resize-y text-xs`} value={allTags} />
              {res.character && res.character.length > 0 && <TagGroup label="Character" tags={res.character} />}
              {res.general && res.general.length > 0 && <TagGroup label="General" tags={res.general} />}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] h-full min-h-[40vh] flex items-center justify-center text-sm text-[var(--fg-subtle)]">Tags will appear here.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TagGroup({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--fg-subtle)] mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs">{t}</span>)}</div>
    </div>
  );
}
