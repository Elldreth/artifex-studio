/**
 * Artifex takes sampler/scheduler/steps/cfg/style/seed via the prompt DSL
 * (`--flag value`) rather than top-level fields; size + negative + image +
 * strength are top-level. Shared by the txt2img and img2img proxy routes.
 */
export interface DslOpts {
  prompt: string;
  style?: string;
  sampler?: string;
  scheduler?: string;
  steps?: number;
  cfg?: number;
  seed?: number;
}

export function buildDslPrompt(o: DslOpts): string {
  const parts = [o.prompt.trim()];
  if (o.style) parts.push(`--style ${o.style}`);
  if (o.sampler) parts.push(`--sampler ${o.sampler}`);
  if (o.scheduler) parts.push(`--scheduler ${o.scheduler}`);
  if (o.steps) parts.push(`--steps ${o.steps}`);
  if (o.cfg) parts.push(`--cfg ${o.cfg}`);
  if (o.seed !== undefined) parts.push(`--seed ${o.seed}`);
  return parts.join(" ");
}
