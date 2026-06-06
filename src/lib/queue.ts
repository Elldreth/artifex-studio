/**
 * Server-side serial queue. The Artifex engine has one GPU and serializes
 * internally, but funnelling concurrent LAN requests through a single in-process
 * chain keeps us from opening many parallel connections and lets us report how
 * many generations are in flight (running + waiting) for the queue indicator.
 */
let tail: Promise<void> = Promise.resolve();
let inflight = 0;

export function queueDepth(): number {
  return inflight;
}

export function runQueued<T>(fn: () => Promise<T>): Promise<T> {
  inflight++;
  const result = tail.then(fn);
  // Advance the chain regardless of success/failure, and decrement when done.
  tail = result.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
    inflight--;
  });
  return result;
}
