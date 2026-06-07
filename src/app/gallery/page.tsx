"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Images, Download, Trash2, X, CheckSquare, Square, GraduationCap, ImagePlus, ScanFace, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { listItems, deleteItem, clearAll, type HistItem } from "@/lib/db";

export default function GalleryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistItem[] | null>(null);
  const [sel, setSel] = useState<HistItem | null>(null);          // lightbox
  const [selMode, setSelMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const reload = () => listItems().then(setItems).catch(() => setItems([]));
  useEffect(() => { reload(); }, []);

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exitSelect = () => { setSelMode(false); setPicked(new Set()); };
  const pickedItems = () => (items ?? []).filter((it) => picked.has(it.id));

  async function removeMany(ids: string[]) {
    for (const id of ids) await deleteItem(id);
    setSel(null); exitSelect(); reload();
  }
  function downloadMany(its: HistItem[]) {
    its.forEach((it, i) => setTimeout(() => {
      const a = document.createElement("a"); a.href = it.dataUrl; a.download = `artifex-${it.ts}.png`; a.click();
    }, i * 250));
  }
  function sendTo(to: "train" | "img2img" | "detailer", its: HistItem[]) {
    if (its.length === 0) return;
    if (to === "train") sessionStorage.setItem("artifex:train-images", JSON.stringify(its.map((i) => i.dataUrl)));
    else sessionStorage.setItem(`artifex:${to}-src`, its[0].dataUrl);
    router.push(`/${to}`);
  }

  const onTile = (it: HistItem) => (selMode ? toggle(it.id) : setSel(it));

  return (
    <div className="animate-fade-in">
      <PageHeader icon={Images} title="gallery" subtitle="Your generations on this device (stored in your browser). Select to delete, download, or send to Train / img2img / Detailer."
        actions={items && items.length > 0 ? (
          selMode ? (
            <button onClick={exitSelect} className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]">Done</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setSelMode(true)} className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center gap-1.5"><CheckSquare size={15} /> Select</button>
              <button onClick={async () => { if (confirm("Clear all history on this device?")) { await clearAll(); reload(); toast.success("Cleared"); } }}
                className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]">Clear all</button>
            </div>
          )
        ) : undefined}
      />

      {selMode && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 shadow-[var(--shadow)]">
          <span className="text-sm font-medium">{picked.size} selected</span>
          <button onClick={() => setPicked(new Set((items ?? []).map((i) => i.id)))} className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-1"><CheckCheck size={13} /> All</button>
          <button onClick={() => setPicked(new Set())} className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]">None</button>
          <div className="flex-1" />
          <Action label="Train" icon={GraduationCap} disabled={picked.size < 1} onClick={() => sendTo("train", pickedItems())} />
          <Action label="img2img" icon={ImagePlus} disabled={picked.size !== 1} onClick={() => sendTo("img2img", pickedItems())} />
          <Action label="Detailer" icon={ScanFace} disabled={picked.size !== 1} onClick={() => sendTo("detailer", pickedItems())} />
          <Action label="Download" icon={Download} disabled={picked.size < 1} onClick={() => downloadMany(pickedItems())} />
          <Action label="Delete" icon={Trash2} danger disabled={picked.size < 1} onClick={() => { if (confirm(`Delete ${picked.size} image(s)?`)) removeMany([...picked]); }} />
        </div>
      )}

      {items === null ? (
        <p className="text-sm text-[var(--fg-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--fg-muted)]">
          Nothing here yet — generate an image and it&apos;ll appear in this gallery.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => {
            const on = picked.has(it.id);
            return (
              <button key={it.id} onClick={() => onTile(it)}
                className={`group relative rounded-xl overflow-hidden border bg-[var(--bg-elevated)] aspect-[3/4] ${on ? "border-[var(--accent)] ring-2 ring-[var(--accent-ring)]" : "border-[var(--border)]"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.dataUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" />
                {selMode && (
                  <span className={`absolute top-2 left-2 ${on ? "text-[var(--accent)]" : "text-white/80"}`}>
                    {on ? <CheckSquare size={20} /> : <Square size={20} />}
                  </span>
                )}
                {!selMode && (
                  <span className="absolute inset-x-0 bottom-0 p-2 text-[11px] text-left text-white/90 bg-gradient-to-t from-black/70 to-transparent line-clamp-2">{it.prompt}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {sel && !selMode && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col md:flex-row" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sel.dataUrl} alt="" className="md:w-2/3 w-full object-contain bg-black max-h-[60vh] md:max-h-[92vh]" />
            <div className="md:w-1/3 w-full p-4 flex flex-col gap-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Details</h3>
                <button onClick={() => setSel(null)} className="text-[var(--fg-muted)] hover:text-[var(--fg)]"><X size={18} /></button>
              </div>
              <Meta label="Model" value={sel.model} />
              <Meta label="Prompt" value={sel.prompt} />
              {sel.negative && <Meta label="Negative" value={sel.negative} />}
              <Meta label="Settings" value={Object.entries(sel.settings).map(([k, v]) => `${k}: ${v}`).join(" · ")} />
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button onClick={() => sendTo("img2img", [sel])} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"><ImagePlus size={15} /> img2img</button>
                <button onClick={() => sendTo("detailer", [sel])} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"><ScanFace size={15} /> Detailer</button>
              </div>
              <div className="flex gap-2 mt-auto pt-2">
                <a href={sel.dataUrl} download={`artifex-${sel.ts}.png`} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium"><Download size={15} /> Download</a>
                <button onClick={() => removeMany([sel.id])} className="px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]"><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Action({ label, icon: Icon, onClick, disabled, danger }: { label: string; icon: React.ComponentType<{ size?: number }>; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1 disabled:opacity-40 ${danger ? "border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
      <Icon size={14} /> {label}
    </button>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--fg-subtle)]">{label}</div>
      <div className="text-sm text-[var(--fg)] break-words">{value}</div>
    </div>
  );
}
