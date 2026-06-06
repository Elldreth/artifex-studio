/** crypto.randomUUID() only exists in a secure context (https/localhost). On a
 *  plain-http LAN origin it's undefined, so fall back to timestamp+random. */
export function uid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* not a secure context */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
