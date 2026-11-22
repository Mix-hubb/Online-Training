// Small in-memory fixed-window rate limiter for the auth and email endpoints.
// One API instance (Railway) is enough for v1. With several instances, move this to Redis or Postgres.
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Counts one hit for `key`. Returns false when the limit for the current window is already used up. */
export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 50_000) sweep(now);
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/** True when `key` has already reached `limit` in the current window (does not count a hit). */
export function isLimited(key: string, limit: number): boolean {
  const b = buckets.get(key);
  return Boolean(b && b.resetAt > Date.now() && b.count >= limit);
}

export function clear(key: string) {
  buckets.delete(key);
}

/** Tests only: start every test with empty counters. */
export function resetRateLimits() {
  buckets.clear();
}

function sweep(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}
