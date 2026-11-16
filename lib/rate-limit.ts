/**
 * Fixed-window rate limiter.
 * - With UPSTASH_REDIS_REST_URL / TOKEN set it is shared across all serverless instances (use this on Vercel).
 * - Without them it falls back to per-instance memory, which still blunts bursts and is fine for local dev.
 */
type Result = { ok: boolean; remaining: number; resetAt: number };

const memory = new Map<string, { count: number; resetAt: number }>();

async function upstashHit(key: string, windowMs: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, windowMs, "NX"],
      ]),
      cache: "no-store",
    });
    const json = (await res.json()) as { result: number }[];
    return json[0]?.result ?? null;
  } catch {
    return null; // never block real guests because the limiter is down
  }
}

export async function rateLimit(
  bucket: string,
  identity: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<Result> {
  const now = Date.now();
  const key = `rl:${bucket}:${identity}`;

  const remote = await upstashHit(key, windowMs);
  if (remote !== null) {
    return { ok: remote <= limit, remaining: Math.max(0, limit - remote), resetAt: now + windowMs };
  }

  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    if (memory.size > 5000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  entry.count += 1;
  return {
    ok: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}

export const LIMITS = {
  contact: { limit: 5, windowMs: 10 * 60_000 },
  availability: { limit: 60, windowMs: 60_000 },
  booking: { limit: 8, windowMs: 10 * 60_000 },
  login: { limit: 6, windowMs: 15 * 60_000 },
  coupon: { limit: 15, windowMs: 10 * 60_000 },
  lookup: { limit: 10, windowMs: 15 * 60_000 }, // manage-booking lookups: blunts reference guessing
  payment: { limit: 20, windowMs: 10 * 60_000 },
  guestCancel: { limit: 5, windowMs: 15 * 60_000 },
} as const;
