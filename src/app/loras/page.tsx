"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Layers, Upload, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface Lora { name: string; file?: string; bytes?: number; mtime?: number }

const fmtSize = (b?: number) => (b ? `${(b / 1_048_576).toFixed(1)} MB` : "");
const fmtDate = (m?: number) => (m ? new Date(m * 1000).toLocaleDateString() : "");

export default function LorasPage() {
  const [loras, setLoras] = useState<Lora[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () =>
    fetch("/api/artifex/loras", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLoras(d.reachable ? (d.loras ?? []).map((l: unknown) => (typeof l === "string" ? { name: l } : l)) : null))
      .catch(() => setLoras(null));
  useEffect(() => { reload(); }, []);

  const upload = (f: File) => {
    if (!f.name.endsWith(".safetensors")) return toast.error("Pick a .safetensors file");
    setUploading(true);
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const r = await fetch("/api/artifex/loras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name.replace(/\.safetensors$/, ""), data: fr.result }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "upload failed");
        toast.success(`Uploaded ${j.name}`); reload();
      } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
    };
    fr.readAsDataURL(f);
  };

  async function remove(name: string) {
    if (!confirm(`Delete LoRA "${name}"? This removes the file on the server.`)) return;
    try {
      const r = await fetch(`/api/artifex/loras/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error ?? "delete failed");
      toast.success(`Deleted ${name}`); reload();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function rename(name: string) {
    const nn = editVal.trim();
    if (!nn || nn === name) { setEditing(null); return; }
    try {
      const r = await fetch(`/api/artifex/loras/${encodeURIComponent(name)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_name: nn }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "rename failed");
      toast.success(`Renamed to ${j.name}`); setEditing(null); reload();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader icon={Layers} title="loras" subtitle="Character & style LoRAs on the engine — trained here or uploaded. Rename, delete, or stack them in a generation."
        actions={
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium disabled:opacity-50">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload .safetensors
          </button>
        } />
      <input ref={fileRef} type="file" accept=".safetensors" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

      {loras === null ? (
        <p className="text-sm text-[var(--danger)]">Engine unreachable.</p>
      ) : loras.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--fg-muted)]">
          No LoRAs yet — upload a .safetensors or train one on the Train page.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loras.map((l) => (
            <div key={l.name} className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              {editing === l.name ? (
                <div className="flex items-center gap-1.5">
                  <input autoFocus className="flex-1 h-8 px-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--accent)] text-sm outline-none"
                    value={editVal} onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") rename(l.name); if (e.key === "Escape") setEditing(null); }} />
                  <button onClick={() => rename(l.name)} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--success)] hover:bg-[var(--surface-2)]"><Check size={15} /></button>
                  <button onClick={() => setEditing(null)} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"><X size={15} /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <Layers size={16} className="text-[var(--accent)] shrink-0 mt-0.5" />
                    <span className="text-sm font-medium break-all flex-1">{l.name}</span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(l.name); setEditVal(l.name); }} title="Rename" className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"><Pencil size={13} /></button>
                      <button onClick={() => remove(l.name)} title="Delete" className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)]"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--fg-subtle)] mt-1.5">
                    {[fmtSize(l.bytes), fmtDate(l.mtime)].filter(Boolean).join(" · ") || "ready to stack"}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--fg-subtle)] mt-5 max-w-2xl">
        Use a LoRA from the <strong>Generate</strong> or <strong>Detailer</strong> page — pick it from the <strong>LoRAs</strong> list (each with its own weight). Renaming changes the file on the server, so update any saved references.
      </p>
    </div>
  );
}
