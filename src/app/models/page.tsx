"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SlidersHorizontal, Save, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DetailerStack, cleanSlot, type Slot, type Detector } from "@/components/DetailerStack";

type Profile = Record<string, unknown>;
interface Agg {
  reachable: boolean;
  config?: Record<string, Profile>;
  models?: string[];
  defaultKey?: string;
  detailers?: { detailers?: Slot[]; generic?: Slot; all_detectors?: Detector[] };
  samplers?: { samplers?: string[]; schedulers?: string[] };
  identity?: { id: string; label: string }[];
  styles?: { id: string; label: string }[];
}
const DEFAULT_KEY = "__default__";
const inp = "w-full h-9 px-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-sm focus:border-[var(--accent)] outline-none";
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export default function ModelProfilesPage() {
  const [data, setData] = useState<Agg | null>(null);
  const [selected, setSelected] = useState(DEFAULT_KEY);
  const [profile, setProfile] = useState<Profile>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d: Agg = await fetch("/api/artifex/model-config", { cache: "no-store" }).then((r) => r.json());
      setData(d);
      const key = selected in (d.config ?? {}) || selected === DEFAULT_KEY ? selected : DEFAULT_KEY;
      setSelected(key);
      setProfile({ ...(d.config?.[key] ?? {}) });
    } catch { setData({ reachable: false }); }
  }, [selected]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const select = (k: string) => { setSelected(k); setProfile({ ...(data?.config?.[k] ?? {}) }); };
  const inherited = useCallback((k: string) => (selected === DEFAULT_KEY ? undefined : data?.config?.[DEFAULT_KEY]?.[k]), [data, selected]);
  const set = (k: string, v: unknown) => setProfile((p) => { const n = { ...p }; if (v === "" || v === null || v === undefined) delete n[k]; else n[k] = v; return n; });

  async function save() {
    setSaving(true);
    try {
      const clean: Profile = { ...profile };
      if (Array.isArray(clean.detailers)) clean.detailers = (clean.detailers as Slot[]).map(cleanSlot);
      const r = await fetch(`/api/artifex/model-config/${encodeURIComponent(selected)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: clean }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "save failed");
      toast.success(`Saved ${selected === DEFAULT_KEY ? "Default" : selected}`);
      await load();
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function reset() {
    if (selected === DEFAULT_KEY) { setProfile({}); return; }
    setSaving(true);
    try { const r = await fetch(`/api/artifex/model-config/${encodeURIComponent(selected)}`, { method: "DELETE" }); if (!r.ok) throw new Error("reset failed"); toast.success("Reverted to Default"); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }

  const tabs = useMemo(() => [DEFAULT_KEY, ...(data?.models ?? [])], [data]);
  if (!data) return <Shell><p className="text-sm text-[var(--fg-muted)]">Loading…</p></Shell>;
  if (!data.reachable) return <Shell><p className="text-sm text-[var(--danger)]">Engine unreachable.</p></Shell>;

  const detailers = (profile.detailers as Slot[] | undefined) ?? [];
  const styles = data.styles ?? [], samplers = data.samplers?.samplers ?? [], schedulers = data.samplers?.schedulers ?? [], identity = data.identity ?? [];

  return (
    <Shell>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((k) => {
          const active = k === selected, over = k !== DEFAULT_KEY && k in (data.config ?? {});
          return (
            <button key={k} onClick={() => select(k)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${active ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)]"}`}>
              {k === DEFAULT_KEY ? "Default" : k}{over && <span className="ml-1.5 text-[10px] opacity-70">●</span>}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-[var(--fg-muted)] mb-4 max-w-2xl">
        {selected === DEFAULT_KEY ? "The Default profile every model inherits. Blank = the engine's built-in default." : "Blank fields inherit the Default (shown as the placeholder); only what you set overrides it."}
      </p>

      <div className="space-y-5 max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Style type"><Sel value={str(profile.default_style)} onChange={(v) => set("default_style", v)} ph={str(inherited("default_style"))} opts={styles.map((s) => ({ v: s.id, l: s.label }))} /></Field>
          <Field label="Prompt style"><Sel value={str(profile.prompt_style)} onChange={(v) => set("prompt_style", v)} ph={str(inherited("prompt_style"))} opts={[{ v: "tags", l: "Danbooru tags" }, { v: "natural", l: "Natural prose" }]} /></Field>
          <Field label="IP-Adapter"><Sel value={str(profile.default_identity)} onChange={(v) => set("default_identity", v)} ph={str(inherited("default_identity"))} opts={[{ v: "none", l: "None" }, ...identity.map((m) => ({ v: m.id, l: m.label }))]} /></Field>
          <Field label="Upscaler"><input className={inp} value={str(profile.upscaler)} placeholder={str(inherited("upscaler")) || "default"} onChange={(e) => set("upscaler", e.target.value)} /></Field>
          <Field label="Sampler"><Sel value={str(profile.sampler)} onChange={(v) => set("sampler", v)} ph={str(inherited("sampler"))} opts={samplers.map((x) => ({ v: x, l: x }))} /></Field>
          <Field label="Scheduler"><Sel value={str(profile.scheduler)} onChange={(v) => set("scheduler", v)} ph={str(inherited("scheduler"))} opts={schedulers.map((x) => ({ v: x, l: x }))} /></Field>
          <Num label="Steps" k="steps" profile={profile} set={set} inh={inherited} />
          <Num label="CFG" k="cfg" step={0.5} profile={profile} set={set} inh={inherited} />
          <Num label="CLIP skip" k="clip_skip" profile={profile} set={set} inh={inherited} />
          <Num label="Hires factor" k="hires" step={0.1} profile={profile} set={set} inh={inherited} />
          <Num label="Hires denoise" k="hires_denoise" step={0.05} profile={profile} set={set} inh={inherited} />
          <Num label="Hires steps" k="hires_steps" profile={profile} set={set} inh={inherited} />
        </div>

        <div>
          <div className="text-sm font-medium mb-1">Detailer stack</div>
          <DetailerStack value={detailers} onChange={(v) => set("detailers", v)} detectors={data.detailers?.all_detectors ?? []} registry={data.detailers?.detailers ?? []} generic={data.detailers?.generic ?? {}} />
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium disabled:opacity-50"><Save size={15} /> {saving ? "Saving…" : "Save"}</button>
          <button onClick={reset} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"><RotateCcw size={14} /> {selected === DEFAULT_KEY ? "Clear all" : "Reset to Default"}</button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in"><PageHeader icon={SlidersHorizontal} title="model profiles" subtitle="Per-model defaults — each model inherits the Default; override only what differs, including its detailer stack." />{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="block text-xs text-[var(--fg-muted)] mb-1">{label}</label>{children}</div>; }
function Sel({ value, onChange, opts, ph }: { value: string; onChange: (v: string) => void; opts: { v: string; l: string }[]; ph?: string }) {
  return <select className={inp} value={value} onChange={(e) => onChange(e.target.value)}><option value="">{ph ? `Inherit (${ph})` : "Inherit"}</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>;
}
function Num({ label, k, step, profile, set, inh }: { label: string; k: string; step?: number; profile: Profile; set: (k: string, v: unknown) => void; inh: (k: string) => unknown }) {
  return <Field label={label}><input type="number" step={step ?? 1} className={inp} value={profile[k] === undefined ? "" : String(profile[k])} placeholder={str(inh(k))} onChange={(e) => set(k, e.target.value === "" ? "" : Number(e.target.value))} /></Field>;
}
