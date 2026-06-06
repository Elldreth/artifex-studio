"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Layers, Upload, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type Lora = string | { name?: string; file?: string; bytes?: number };

export default function LorasPage() {
  const [loras, setLoras] = useState<Lora[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => fetch("/api/artifex/loras", { cache: "no-store" }).then((r) => r.json()).then((d) => setLoras(d.reachable ? (d.loras ?? []) : null)).catch(() => setLoras(null));
  useEffect(() => { reload(); }, []);

  const upload = (f: File) => {
    if (!f.name.endsWith(".safetensors")) return toast.error("Pick a .safetensors file");
    setUploading(true);
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const r = await fetch("/api/artifex/loras", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: f.name.replace(/\.safetensors$/, ""), data: fr.result }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "upload failed");
        toast.success(`Uploaded ${j.name}`); reload();
      } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
    };
    fr.readAsDataURL(f);
  };

  const nameOf = (l: Lora) => (typeof l === "string" ? l : l.name ?? l.file ?? "lora");
  const sizeOf = (l: Lora) => (typeof l === "object" && l.bytes ? ` · ${(l.bytes / 1_048_576).toFixed(1)} MB` : "");

  return (
    <div className="animate-fade-in">
      <PageHeader icon={Layers} title="loras" subtitle="Character & style LoRAs on the engine — trained here or uploaded. Stack them in a generation via the prompt."
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
          {loras.map((l, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center gap-2"><Layers size={16} className="text-[var(--accent)] shrink-0" /><span className="text-sm font-medium break-all">{nameOf(l)}</span></div>
              <div className="text-xs text-[var(--fg-subtle)] mt-1">{sizeOf(l) || "ready to stack"}</div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--fg-subtle)] mt-5 max-w-2xl">
        To use a LoRA, open the <strong>Generate</strong> page and pick it from the <strong>LoRAs</strong> list (each with its own weight slider). Select several to stack them.
      </p>
    </div>
  );
}
