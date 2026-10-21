// src/server/auth/rate-limit.ts — جلوگیری ساده و حافظه‌ای از Brute-force روی قفل درب تئاتر
interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return false;
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length === 0) {
    buckets.delete(key);
    return false;
  }
  return bucket.hits.length >= limit;
}

export function recordHit(key: string, now = Date.now()): void {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits.push(now);
  buckets.set(key, bucket);
}

export function checkAndRecord(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (isRateLimited(key, limit, windowMs, now)) return false;
  recordHit(key, now);
  return true;
}

/** فقط برای تست‌ها */
export function resetRateLimits(): void {
  buckets.clear();
}
