// src/server/presence/presence-coalescer.ts — هم‌جوشی snapshotهای حضور برای ارسال SSE
// (فاز ۰۳ — توحید). با ۸ بازیکن و نرخ ۱۰Hz، ارسال هر snapshot به‌صورت جداگانه
// هر اتصال را خفه می‌کند؛ این ماژول آخرین وضعیت را نگه می‌دارد و حداکثر هر flushMs
// یک بار منتشر می‌کند، بدون اینکه کهنه‌شدن داده از flushMs بیشتر شود.
import { PRESENCE_STREAM_FLUSH_MS, type PresenceEntry } from '../../contracts/presence';

export interface PresenceScheduler {
  schedule(callback: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

const defaultScheduler: PresenceScheduler = {
  schedule: (callback, ms) => setTimeout(callback, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface PresenceCoalescer {
  push(entries: readonly PresenceEntry[]): void;
  /** ارسال فوری آخرین وضعیت (اگر چیزی در صف باشد) */
  flush(): void;
  dispose(): void;
}

export function createPresenceCoalescer(
  emit: (entries: readonly PresenceEntry[]) => void,
  options: { flushMs?: number; scheduler?: PresenceScheduler } = {},
): PresenceCoalescer {
  const flushMs = options.flushMs ?? PRESENCE_STREAM_FLUSH_MS;
  const scheduler = options.scheduler ?? defaultScheduler;
  let latest: PresenceEntry[] | null = null;
  let handle: unknown = null;

  const flush = () => {
    if (handle !== null) {
      scheduler.cancel(handle);
      handle = null;
    }
    if (latest === null) return;
    const payload = latest;
    latest = null;
    emit(payload);
  };

  return {
    push(entries) {
      latest = [...entries];
      if (handle !== null) return;
      handle = scheduler.schedule(() => {
        handle = null;
        flush();
      }, flushMs);
    },
    flush,
    dispose() {
      if (handle !== null) {
        scheduler.cancel(handle);
        handle = null;
      }
      latest = null;
    },
  };
}
