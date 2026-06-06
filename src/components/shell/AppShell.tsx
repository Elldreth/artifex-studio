"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wand2, Images, ImagePlus, ScanFace, SlidersHorizontal, GraduationCap, Layers, Tags, Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { HealthChip } from "@/components/HealthChip";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match: (p: string) => boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Generate", icon: Wand2, match: (p) => p === "/" },
  { href: "/img2img", label: "Image to image", icon: ImagePlus, match: (p) => p.startsWith("/img2img") },
  { href: "/detailer", label: "Detailer", icon: ScanFace, match: (p) => p.startsWith("/detailer") },
  { href: "/train", label: "Train LoRA", icon: GraduationCap, match: (p) => p.startsWith("/train") },
  { href: "/loras", label: "LoRAs", icon: Layers, match: (p) => p.startsWith("/loras") },
  { href: "/tagger", label: "Tagger", icon: Tags, match: (p) => p.startsWith("/tagger") },
  { href: "/gallery", label: "Gallery", icon: Images, match: (p) => p.startsWith("/gallery") },
  { href: "/models", label: "Model profiles", icon: SlidersHorizontal, match: (p) => p.startsWith("/models") },
];

/** Persistent left sidebar on desktop, slide-in drawer on mobile, slim top bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full">
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-[var(--bg-elevated)] shadow-[8px_0_30px_-20px_rgba(0,0,0,0.9)]">
        <Sidebar pathname={pathname} />
      </aside>

      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute top-0 bottom-0 left-0 w-60 bg-[var(--bg-elevated)] border-r border-[var(--border)] flex flex-col shadow-[var(--shadow-lg)]">
            <Sidebar pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-14 shrink-0 flex items-center gap-3 px-4 bg-[var(--bg-elevated)]/60 backdrop-blur shadow-[0_10px_30px_-24px_rgba(0,0,0,1)]">
          <button
            className="md:hidden p-1.5 rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <Link href="/" className="md:hidden"><Wordmark size="sm" /></Link>
          <div className="flex-1" />
          <HealthChip />
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full px-5 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="h-14 flex items-center px-5 justify-between">
        <Link href="/" onClick={onNavigate}><Wordmark size="md" /></Link>
        {onNavigate && (
          <button onClick={onNavigate} className="md:hidden text-[var(--fg-muted)]" aria-label="Close menu"><X size={18} /></button>
        )}
      </div>
      <nav className="flex-1 px-3 pt-2 space-y-1">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <Icon size={18} /> {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-[10px] text-[var(--fg-subtle)] leading-relaxed">
        Artifex Studio · local image generation
      </div>
    </>
  );
}
