/**
 * In-memory rate limiter — adequate for single-server / serverless edge deployments.
 * For multi-instance deployments, replace the Map with Redis.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Prune expired entries every minute to avoid memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 60_000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check and increment the rate-limit counter for a given key.
 *
 * @param key       Unique identifier (e.g. IP address, user id)
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window size in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/** Extract IP from a Next.js request (works for both App Router and Edge). */
export function getIp(req: Request): string {
  return (
    (req.headers as any).get?.("x-forwarded-for")?.split(",")[0]?.trim() ??
    (req.headers as any).get?.("x-real-ip") ??
    "unknown"
  );
}
