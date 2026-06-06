/**
 * Artifex Studio wordmark: teal "artifex" + muted "studio", lowercase, in the
 * body font — calm and unfussy, the SFW counterpart to candy.oh's wordmark.
 */
export function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "text-lg" : "text-xl";
  return (
    <span className={`${cls} font-bold tracking-tight lowercase select-none`}>
      <span className="text-[var(--accent)]">artifex</span>
      <span className="text-[var(--fg-muted)] font-medium"> studio</span>
    </span>
  );
}
