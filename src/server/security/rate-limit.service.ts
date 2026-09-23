interface Bucket {
  count: number
  expiresAt: number
}

const buckets = new Map<string, Bucket>()

// Keys can be client-influenced (IP, identifier), so the map is swept once it
// grows past this size to keep memory bounded under a rotation attack.
const MAX_BUCKETS = 10_000

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt < now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  if (buckets.size >= MAX_BUCKETS) sweepExpired(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.expiresAt < now) {
    const fresh: Bucket = { count: 1, expiresAt: now + windowMs }
    buckets.set(key, fresh)
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.expiresAt - now }
  }
  bucket.count += 1
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 }
}

export function clearRateLimits() {
  buckets.clear()
}
