// src/server/realtime/presence-tracker.ts
// حضور حرکتی هم‌تیمی‌ها (فاز ۰۳ / قرارداد #104) — حافظه‌ای و بدون پایگاه‌داده.
//
// چرا حافظه‌ای؟ چون هاب بلادرنگ اتاق (`room-hub.ts`) هم حافظه‌ای است؛ ثبت ۱۰
// هرتز موقعیت در دیتابیس هم گران است و هم برای داده‌ای که عمرش ۳۰ ثانیه است
// بی‌فایده. هر نمونه (instance) فقط بازیکنان متصل به خودش را می‌بیند؛ در
// استقرار چندنمونه‌ای باید همین لایه به Redis/pub-sub منتقل شود.
//
// قواعد قرارداد:
//  - `yaw` رادیان است و در بازهٔ [-π, π) نرمال می‌شود؛ ۰ یعنی نگاه به -z.
//  - موقعیت خارج از محدودهٔ کوچه یا مقدار غیرمتناهی **رد** می‌شود.
//  - بازیکنی که ۳۰ ثانیه ارسال نکرده، از قاب حذف می‌شود.
//  - سقف ۳۲ ورودی در هر اتاق.

/** نرخ مجاز ارسال کلاینت (ms). سرور سریع‌تر از این را نمی‌پذیرد. */
export const PRESENCE_SEND_INTERVAL_MS = 100;
/** پس از این مدت بی‌خبری، بازیکن آفلاین حساب می‌شود. */
export const PRESENCE_OFFLINE_TIMEOUT_MS = 30_000;
/** سقف تعداد ورودی‌های هم‌زمان هر اتاق. */
export const PRESENCE_MAX_PLAYERS = 32;
/** فاصلهٔ ارسال قاب `presence_update` روی SSE (ms). */
export const PRESENCE_BROADCAST_MS = 250;

/**
 * محدودهٔ مجاز موقعیت در صحنهٔ کوچه (`DEFAULT_ALLEY_BOUNDS` به‌اضافهٔ حاشیهٔ
 * نیم‌متری). اینجا تکرار شده تا لایهٔ سرور به `src/engine3d/**` (Three.js)
 * وابسته نشود.
 */
export const PRESENCE_BOUNDS = {
  minX: -9.5,
  maxX: 9.5,
  minY: 0,
  maxY: 3.2,
  minZ: -18.5,
  maxZ: 8.5,
} as const;

export interface PresenceVector {
  x: number;
  y: number;
  z: number;
}

/** رکورد کامل سمت سرور؛ `playerId` هرگز از بدنهٔ درخواست خوانده نمی‌شود. */
export interface PresenceRecord {
  playerId: string;
  seatIndex: number;
  playerName: string | null;
  position: PresenceVector;
  yaw: number;
  phase: string;
  /** ساعت سرور هنگام دریافت آخرین به‌روزرسانی (ms). */
  updatedAt: number;
}

/** شکل سیمی که در `presence_update` می‌رود. */
export interface PresenceWire {
  playerId: string;
  playerName: string | null;
  seatIndex: number;
  position: PresenceVector;
  yaw: number;
  phase: string;
  lastUpdate: number;
}

export interface PresenceIdentity {
  playerId: string;
  seatIndex: number;
  playerName?: string | null;
}

export interface RawPresenceInput {
  position?: unknown;
  yaw?: unknown;
  phase?: unknown;
}

const DEFAULT_PHASE = 'alley_puzzle';
const MAX_PHASE_LENGTH = 32;

/** نرمال‌سازی یاو در بازهٔ [-π, π)؛ ورودی نامعتبر → ۰. */
export function normalizePresenceYaw(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const twoPi = Math.PI * 2;
  let yaw = ((value + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  if (yaw >= Math.PI) yaw -= twoPi;
  return yaw;
}

function readFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function within(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/** آیا موقعیت در محدودهٔ صحنه است؟ (برای رد snapshot نامعتبر) */
export function isPresencePositionValid(position: PresenceVector): boolean {
  return (
    within(position.x, PRESENCE_BOUNDS.minX, PRESENCE_BOUNDS.maxX) &&
    within(position.y, PRESENCE_BOUNDS.minY, PRESENCE_BOUNDS.maxY) &&
    within(position.z, PRESENCE_BOUNDS.minZ, PRESENCE_BOUNDS.maxZ)
  );
}

/**
 * ورودی خام کلاینت → رکورد معتبر، یا `null` اگر داده خراب/خارج از محدوده بود.
 * هویت (playerId/seatIndex/playerName) فقط از سمت سرور می‌آید.
 */
export function sanitizePresenceInput(
  input: unknown,
  identity: PresenceIdentity,
  now = Date.now(),
): PresenceRecord | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as RawPresenceInput;
  const position = raw.position;
  if (!position || typeof position !== 'object') return null;
  const point = position as Record<string, unknown>;
  const x = readFinite(point.x);
  const y = readFinite(point.y);
  const z = readFinite(point.z);
  if (x === null || y === null || z === null) return null;

  const yaw = readFinite(raw.yaw);
  if (yaw === null) return null;
  if (yaw < -Math.PI * 4 || yaw > Math.PI * 4) return null; // چرخش بی‌معنا

  const vector: PresenceVector = { x, y, z };
  if (!isPresencePositionValid(vector)) return null;

  const phase =
    typeof raw.phase === 'string' && raw.phase.trim()
      ? raw.phase.trim().slice(0, MAX_PHASE_LENGTH)
      : DEFAULT_PHASE;

  const name =
    typeof identity.playerName === 'string' && identity.playerName.trim()
      ? identity.playerName.trim()
      : null;

  return {
    playerId: identity.playerId,
    seatIndex: identity.seatIndex,
    playerName: name,
    position: vector,
    yaw: normalizePresenceYaw(yaw),
    phase,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// انبار حافظه‌ای + انتشار
// ---------------------------------------------------------------------------

type PresenceListener = (roomCode: string) => void;

const rooms = new Map<string, Map<string, PresenceRecord>>();
const listeners = new Map<string, Set<PresenceListener>>();

/** ثبت/به‌روزرسانی حضور یک بازیکن و بیدار کردن شنونده‌های SSE. */
export function publishPresence(roomCode: string, record: PresenceRecord): void {
  let room = rooms.get(roomCode);
  if (!room) {
    room = new Map();
    rooms.set(roomCode, room);
  }
  // اگر سقف پر است و این بازیکن جدید است، قدیمی‌ترین ورودی جای خود را می‌دهد.
  if (!room.has(record.playerId) && room.size >= PRESENCE_MAX_PLAYERS) {
    let oldestId: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [playerId, entry] of room) {
      if (entry.updatedAt < oldestAt) {
        oldestAt = entry.updatedAt;
        oldestId = playerId;
      }
    }
    if (oldestId !== null) room.delete(oldestId);
  }
  room.set(record.playerId, record);

  const set = listeners.get(roomCode);
  if (set) for (const listener of set) listener(roomCode);
}

/** فهرست زندهٔ اتاق، مرتب بر اساس صندلی؛ ورودی‌های کهنه حذف می‌شوند. */
export function listPresence(roomCode: string, now = Date.now()): PresenceWire[] {
  const room = rooms.get(roomCode);
  if (!room) return [];
  const fresh: PresenceRecord[] = [];
  for (const [playerId, entry] of room) {
    if (now - entry.updatedAt > PRESENCE_OFFLINE_TIMEOUT_MS) {
      room.delete(playerId);
      continue;
    }
    fresh.push(entry);
  }
  if (room.size === 0) rooms.delete(roomCode);
  return fresh
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .slice(0, PRESENCE_MAX_PLAYERS)
    .map(toPresenceWire);
}

/** یک ورودی مشخص (برای تست یا حذف بازیکن). */
export function getPresence(roomCode: string, playerId: string): PresenceRecord | null {
  return rooms.get(roomCode)?.get(playerId) ?? null;
}

/** حذف حضور یک بازیکن (مثلاً خروج از اتاق). */
export function forgetPresence(roomCode: string, playerId: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.delete(playerId);
  if (room.size === 0) rooms.delete(roomCode);
}

/** اشتراک تغییرات حضور یک اتاق؛ خروجی تابع لغو اشتراک است. */
export function subscribePresence(roomCode: string, listener: PresenceListener): () => void {
  let set = listeners.get(roomCode);
  if (!set) {
    set = new Set();
    listeners.set(roomCode, set);
  }
  set.add(listener);
  return () => {
    const current = listeners.get(roomCode);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(roomCode);
  };
}

export function presenceListenerCount(roomCode?: string): number {
  if (roomCode === undefined) {
    let total = 0;
    for (const set of listeners.values()) total += set.size;
    return total;
  }
  return listeners.get(roomCode)?.size ?? 0;
}

/**
 * امضای سبک قاب حضور؛ استریم با مقایسهٔ آن از ارسال قاب تکراری جلوگیری می‌کند.
 * (`updatedAt` عمداً داخل امضا نیست تا حرکت آرام هم دیده شود.)
 */
export function presenceSignature(presences: readonly PresenceWire[]): string {
  if (presences.length === 0) return '';
  return presences
    .map(
      (entry) =>
        `${entry.playerId}:${entry.position.x.toFixed(2)},${entry.position.y.toFixed(2)},${entry.position.z.toFixed(2)},${entry.yaw.toFixed(3)},${entry.phase}`,
    )
    .join('|');
}

export function toPresenceWire(record: PresenceRecord): PresenceWire {
  return {
    playerId: record.playerId,
    playerName: record.playerName,
    seatIndex: record.seatIndex,
    position: record.position,
    yaw: record.yaw,
    phase: record.phase,
    lastUpdate: record.updatedAt,
  };
}

/** فقط برای تست‌ها: پاک کردن کامل حافظه و شنونده‌ها. */
export function resetPresenceStore(): void {
  rooms.clear();
  listeners.clear();
}
