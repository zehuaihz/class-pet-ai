interface Bucket {
  count: number
  expiresAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
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
