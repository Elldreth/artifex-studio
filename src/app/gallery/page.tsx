"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Images, Download, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { listItems, deleteItem, clearAll, type HistItem } from "@/lib/db";

export default function GalleryPage() {
  const [items, setItems] = useState<HistItem[] | null>(null);
  const [sel, setSel] = useState<HistItem | null>(null);

  const reload = () => listItems().then(setItems).catch(() => setItems([]));
  useEffect(() => { reload(); }, []);

  async function remove(id: string) {
    await deleteItem(id);
    if (sel?.id === id) setSel(null);
    reload();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Images}
        title="gallery"
        subtitle="Your generations on this device (stored in your browser)."
        actions={items && items.length > 0 ? (
          <button
            onClick={async () => { if (confirm("Clear all history on this device?")) { await clearAll(); reload(); toast.success("Cleared"); } }}
            className="text-sm px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]"
          >Clear all</button>
        ) : undefined}
      />

      {items === null ? (
        <p className="text-sm text-[var(--fg-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-sm text-[var(--fg-muted)]">
          Nothing here yet — generate an image and it&apos;ll appear in this gallery.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <button key={it.id} onClick={() => setSel(it)}
              className="group relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-elevated)] aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.dataUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" />
              <span className="absolute inset-x-0 bottom-0 p-2 text-[11px] text-left text-white/90 bg-gradient-to-t from-black/70 to-transparent line-clamp-2">
                {it.prompt}
              </span>
            </button>
          ))}
        </div>
      )}

      {sel && (
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
              <div className="flex gap-2 mt-auto pt-2">
                <a href={sel.dataUrl} download={`artifex-${sel.ts}.png`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium">
                  <Download size={15} /> Download
                </a>
                <button onClick={() => remove(sel.id)}
                  className="px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
