// src/server/presence/presence-store.ts — نگه‌داری آخرین snapshot هر صندلی در حافظه
// (فاز ۰۳ — توحید). بدون تاریخچه: هر snapshot تازه جای قبلی را می‌گیرد و ورودی‌های
// قدیمی‌تر از PRESENCE_TTL_MS در همان اتاق پاک می‌شوند.
import { PRESENCE_TTL_MS, type PresenceEntry } from '../../contracts/presence';

type Listener = (entries: PresenceEntry[]) => void;

/** اتاق → صندلی → آخرین snapshot */
const rooms = new Map<string, Map<number, PresenceEntry>>();
/** اتاق → شنونده‌های استریم */
const listenersByRoom = new Map<string, Set<Listener>>();

function roomKey(code: string): string {
  return code.toUpperCase();
}

/** حذف snapshotهای منقضی و برگرداندن وضعیت باقی‌مانده به ترتیب صندلی. */
export function pruneRoomPresence(
  code: string,
  now = Date.now(),
  ttlMs = PRESENCE_TTL_MS,
): PresenceEntry[] {
  const key = roomKey(code);
  const map = rooms.get(key);
  if (!map) return [];
  for (const [seatIndex, entry] of [...map]) {
    if (now - entry.receivedAt >= ttlMs) map.delete(seatIndex);
  }
  if (map.size === 0) {
    rooms.delete(key);
    return [];
  }
  return [...map.values()].sort((a, b) => a.seatIndex - b.seatIndex);
}

export function getRoomPresence(
  code: string,
  now = Date.now(),
  ttlMs = PRESENCE_TTL_MS,
): PresenceEntry[] {
  return pruneRoomPresence(code, now, ttlMs);
}

/**
 * ثبت snapshot تازه (همیشه جایگزین آخرین snapshot همان صندلی) و انتشار وضعیت
 * کامل اتاق برای شنونده‌های SSE. خروجی، وضعیت جاری اتاق پس از پاک‌سازی است.
 */
export function submitPresence(code: string, entry: PresenceEntry): PresenceEntry[] {
  const key = roomKey(code);
  const map = rooms.get(key) ?? new Map<number, PresenceEntry>();
  rooms.set(key, map);
  map.set(entry.seatIndex, entry);

  const snapshot = pruneRoomPresence(code, entry.receivedAt);
  const set = listenersByRoom.get(key);
  if (set) {
    for (const listener of [...set]) {
      try {
        listener(snapshot);
      } catch {
        // خطای یک شنونده نباید انتشار برای بقیه را متوقف کند
      }
    }
  }
  return snapshot;
}

export function subscribePresence(code: string, listener: Listener): () => void {
  const key = roomKey(code);
  const set = listenersByRoom.get(key) ?? new Set<Listener>();
  set.add(listener);
  listenersByRoom.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listenersByRoom.delete(key);
  };
}

export function presenceListenerCount(code: string): number {
  return listenersByRoom.get(roomKey(code))?.size ?? 0;
}

/** فقط برای تست‌ها: پاک کردن کامل حافظهٔ presence و شنونده‌ها. */
export function resetPresenceStore(): void {
  rooms.clear();
  listenersByRoom.clear();
}
