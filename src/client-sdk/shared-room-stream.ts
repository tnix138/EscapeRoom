/**
 * shared-room-stream.ts — اشتراک یک استریم SSE واحد بین هوک‌های اتاق و حضور
 * ---------------------------------------------------------------------------
 * ریشهٔ باگ گیر کردن ارسال پیام در «نجوای گروهی»:
 * قبلاً در هر تبِ اتاق، هم `useTheaterSession` و هم `usePresenceFeed` هر کدام
 * یک `EventSource` مجزا به `/api/rooms/{code}/stream?token=...` باز می‌کردند.
 * روی HTTP/1.1 (که سقف ۶ اتصال هم‌زمان به هر مبدأ در مرورگر دارد)، باز کردن ۳ تب
 * بازیکن تمام ۶ سوکت را برای همیشه قفل می‌کرد و درخواست `POST /api/rooms/{code}/chat`
 * در وضعیت Pending گیر می‌کرد («در حال فرستادن…» هرگز تمام نمی‌شد).
 *
 * این ماژول همهٔ مشترکین یک `(roomCode, token)` را روی **یک EventSource واحد**
 * هم‌رسانی می‌کند و به محض بسته شدن آخرین مشترک، اتصال را آزاد می‌کند.
 */

export interface SharedStreamHandle {
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  close: () => void;
}

interface PoolEntry {
  source: EventSource;
  refs: number;
  listeners: Map<string, Set<EventListener>>;
  boundForwarders: Map<string, EventListener>;
  lastPayloadByType: Map<string, string>;
}

const STREAM_POOL = new Map<string, PoolEntry>();

/** کلید یکتای اشتراک استریم بدون وابستگی به `sinceVersion` اولیه */
export function canonicalRoomStreamKey(rawUrl: string): string {
  const qIndex = rawUrl.indexOf('?');
  if (qIndex < 0) return rawUrl;
  const pathname = rawUrl.slice(0, qIndex);
  const params = new URLSearchParams(rawUrl.slice(qIndex + 1));
  params.delete('sinceVersion');
  params.sort();
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** ساخت آدرس اتصال بدون `sinceVersion` محدودکننده تا همهٔ مشترکین فریم اولیه را بگیرند */
export function canonicalRoomStreamConnectUrl(rawUrl: string): string {
  const qIndex = rawUrl.indexOf('?');
  if (qIndex < 0) return rawUrl;
  const pathname = rawUrl.slice(0, qIndex);
  const params = new URLSearchParams(rawUrl.slice(qIndex + 1));
  params.delete('sinceVersion');
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function activeSharedStreamCount(): number {
  return STREAM_POOL.size;
}

export function openSharedRoomStream(
  rawUrl: string,
  EventSourceCtor: typeof EventSource | undefined = typeof EventSource !== 'undefined'
    ? EventSource
    : undefined,
): SharedStreamHandle | null {
  if (!EventSourceCtor) return null;

  const key = canonicalRoomStreamKey(rawUrl);
  let entry = STREAM_POOL.get(key);
  if (!entry) {
    const connectUrl = canonicalRoomStreamConnectUrl(rawUrl);
    entry = {
      source: new EventSourceCtor(connectUrl),
      refs: 0,
      listeners: new Map(),
      boundForwarders: new Map(),
      lastPayloadByType: new Map(),
    };
    STREAM_POOL.set(key, entry);
  }

  entry.refs += 1;
  const localListeners: Array<{ type: string; listener: EventListener }> = [];
  let closed = false;
  const currentEntry = entry;

  const ensureForwarder = (type: string) => {
    if (currentEntry.boundForwarders.has(type)) return;
    const forwarder: EventListener = (event) => {
      const msgData = (event as MessageEvent<string>).data;
      if (typeof msgData === 'string') {
        currentEntry.lastPayloadByType.set(type, msgData);
      }
      const bucket = currentEntry.listeners.get(type);
      if (!bucket) return;
      for (const listener of [...bucket]) {
        try {
          listener(event);
        } catch {
          // خطای یک شنونده نباید سایر شنونده‌ها را متوقف کند
        }
      }
    };
    currentEntry.boundForwarders.set(type, forwarder);
    currentEntry.source.addEventListener(type, forwarder);
  };

  const addEventListener = (type: string, listener: EventListener) => {
    if (closed) return;
    ensureForwarder(type);
    let bucket = currentEntry.listeners.get(type);
    if (!bucket) {
      bucket = new Set();
      currentEntry.listeners.set(type, bucket);
    }
    bucket.add(listener);
    localListeners.push({ type, listener });

    // اگر این مشترک بعد از باز شدن استریم وصل شده، آخرین فریم کش‌شده را فوراً تحویل بده
    const cached = currentEntry.lastPayloadByType.get(type);
    if (cached !== undefined) {
      queueMicrotask(() => {
        if (closed || !currentEntry.listeners.get(type)?.has(listener)) return;
        const synthetic =
          typeof MessageEvent === 'function'
            ? new MessageEvent(type, { data: cached })
            : ({ type, data: cached } as unknown as Event);
        listener(synthetic);
      });
    }
  };

  const removeEventListener = (type: string, listener: EventListener) => {
    currentEntry.listeners.get(type)?.delete(listener);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    for (const item of localListeners) {
      currentEntry.listeners.get(item.type)?.delete(item.listener);
    }
    localListeners.length = 0;
    currentEntry.refs -= 1;
    if (currentEntry.refs <= 0) {
      for (const [type, forwarder] of currentEntry.boundForwarders) {
        if (typeof currentEntry.source.removeEventListener === 'function') {
          currentEntry.source.removeEventListener(type, forwarder);
        }
      }
      currentEntry.boundForwarders.clear();
      currentEntry.listeners.clear();
      currentEntry.lastPayloadByType.clear();
      currentEntry.source.close();
      if (STREAM_POOL.get(key) === currentEntry) {
        STREAM_POOL.delete(key);
      }
    }
  };

  return { addEventListener, removeEventListener, close };
}
