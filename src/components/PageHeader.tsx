import type { LucideIcon } from "lucide-react";

/** A teal pill header — the studio's calm take on candy.oh's PageHeader. */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1
          className="inline-flex items-center gap-2.5 rounded-full pl-4 pr-5 py-1.5 text-[1.5rem] leading-tight font-semibold lowercase tracking-[-0.02em] text-[var(--accent-fg)] shadow-[var(--shadow-accent)]"
          style={{ background: "var(--accent)" }}
        >
          {Icon && <Icon size={20} className="shrink-0 opacity-90" strokeWidth={2.25} />}
          <span>{title}</span>
        </h1>
        {subtitle && <p className="text-sm text-[var(--fg-muted)] mt-2.5 ml-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
