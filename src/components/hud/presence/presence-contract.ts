/**
 * presence-contract.ts — قالب سیمی قرارداد حضور (فاز ۱۲ — امیرعلی)
 * ---------------------------------------------------------------------------
 * مرجع: Issue #104 «قرارداد حضور در ۳D» (پیاده‌سازی سرور: فاز ۰۳ / توحید).
 *
 * این فایل فقط تبدیل دادهٔ خام شبکه به شکل داخلی HUD است؛ هیچ fetch و هیچ DOM.
 * قواعد قرارداد که اینجا رعایت می‌شود:
 *  - `yaw` همیشه **رادیان** و در بازهٔ [-π, π) است؛ HUD برای فلش به درجه نیاز دارد.
 *  - هویت (playerId/seatIndex) را سرور می‌گذارد؛ کلاینت برای ارسال فقط
 *    `{ position, yaw, phase }` می‌فرستد.
 *  - رویداد SSE با شکل `{ presences: [...], serverNow }` می‌آید.
 *  - `receivedAt`/`lastUpdate` ساعت سرورند؛ کهنگی باید با `serverNow` سنجیده شود.
 *  - هر ورودی خراب بی‌صدا رد می‌شود؛ HUD هرگز به‌خاطر دادهٔ شبکه نمی‌شکند.
 */

import {
  normalizeRemotePlayers,
  type RemotePlayer,
  type RemotePlayerInput,
} from './presence-hud';

/** یک رکورد حضور همان‌طور که سرور می‌فرستد. */
export interface PresenceEntryWire {
  playerId: string;
  seatIndex?: number;
  playerName?: string;
  position: { x: number; y: number; z: number };
  /** رادیان، در بازهٔ [-π, π). */
  yaw?: number;
  phase?: string;
  lastUpdate?: number;
  receivedAt?: number;
}

export interface PresenceFrame {
  presences: RemotePlayer[];
  /** ساعت سرور (ms)؛ اگر در قاب نبود `null`. */
  serverNow: number | null;
}

/** آدرس‌های قرارداد ۲ — تنها مسیرهای مجاز این HUD. */
export function presenceEndpoint(roomCode: string): string {
  return `/api/rooms/${encodeURIComponent(roomCode)}/presence`;
}

export function presenceStreamUrl(roomCode: string, seatToken: string): string {
  return `/api/rooms/${encodeURIComponent(roomCode)}/stream?token=${encodeURIComponent(seatToken)}`;
}

/** نرمال‌سازی رادیان به بازهٔ [-π, π). */
export function normalizeRadians(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const twoPi = Math.PI * 2;
  let radians = ((value + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  if (radians === -Math.PI) radians = Math.PI;
  return radians;
}

/** تبدیل درجهٔ موتور (`PlayerTransform.yawDeg`) به رادیان قرارداد. */
export function yawDegToRadians(yawDeg: number): number {
  return normalizeRadians(((Number.isFinite(yawDeg) ? yawDeg : 0) * Math.PI) / 180);
}

/** تبدیل رادیان سرور به درجه برای هندسهٔ HUD. */
export function yawRadiansToDegrees(yawRad: number): number {
  if (!Number.isFinite(yawRad)) return 0;
  return (normalizeRadians(yawRad) * 180) / Math.PI;
}

export interface PublishableTransform {
  x: number;
  y: number;
  z: number;
  yawDeg: number;
}

export interface PresencePublishBody {
  position: { x: number; y: number; z: number };
  yaw: number;
  phase: string;
}

/**
 * بدنهٔ ارسال با قاعدهٔ قرارداد: بدون `playerId` و `seatIndex` (سرور از توکن
 * می‌خواند) و `yaw` رادیان. مقدارهای غیرمتناهی به صفر تبدیل می‌شوند تا سرور
 * به‌خاطر یک فریم خراب ۴۰۰ ندهد.
 */
export function buildPresencePublishBody(
  transform: PublishableTransform | null | undefined,
  phase: string,
): PresencePublishBody | null {
  if (!transform) return null;
  const { x, y, z, yawDeg } = transform;
  if (![x, y, z, yawDeg].every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return null;
  }
  return {
    position: { x, y, z },
    yaw: yawDegToRadians(yawDeg),
    phase: typeof phase === 'string' && phase.trim() ? phase.trim() : 'alley_puzzle',
  };
}

/** آیا حرکت به‌قدری تغییر کرده که ارسال تازه لازم باشد؟ (صرفه‌جویی در ۱۰Hz) */
export function shouldPublishTransform(
  previous: PublishableTransform | null,
  next: PublishableTransform | null,
  minPositionMeters = 0.02,
  minYawDeg = 0.5,
): boolean {
  if (!next) return false;
  if (!previous) return true;
  const moved = Math.hypot(next.x - previous.x, next.y - previous.y, next.z - previous.z);
  if (moved >= minPositionMeters) return true;
  const turned = Math.abs(normalizeRadians(yawDegToRadians(next.yawDeg) - yawDegToRadians(previous.yawDeg)));
  return (turned * 180) / Math.PI >= minYawDeg;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readServerNow(source: Record<string, unknown> | null): number | null {
  if (!source) return null;
  for (const key of ['serverNow', 'receivedAt'] as const) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

/**
 * خواندن قاب SSE: `{ presences: [...] , serverNow }`.
 * برای سازگاری، `{ data: { presences } }`، `{ snapshots }` (شکل قدیمی فاز ۰۴)
 * و آرایهٔ خالی هم پذیرفته می‌شود. ورودی ناشناخته → قاب خالی.
 */
export function readPresenceFrame(payload: unknown): PresenceFrame {
  if (Array.isArray(payload)) {
    return { presences: normalizeRemotePlayers(payload as RemotePlayerInput[]), serverNow: null };
  }
  const root = asRecord(payload);
  if (!root) return { presences: [], serverNow: null };

  const nested = asRecord(root.data);
  const list = root.presences ?? root.snapshots ?? nested?.presences ?? nested?.snapshots;
  const serverNow = readServerNow(root) ?? readServerNow(nested);
  return {
    presences: Array.isArray(list) ? normalizeRemotePlayers(list as RemotePlayerInput[]) : [],
    serverNow,
  };
}

/**
 * ادغام قاب تازه در فهرست فعلی با قاعدهٔ «تازه‌ترین snapshot هر بازیکن».
 * بازیکنی که در قاب نیست حذف نمی‌شود؛ حذف فقط با کهنگی (۳۰ ثانیه) انجام
 * می‌شود تا یک قاب ناقص باعث پرش نشانگر نشود.
 */
export function mergePresenceFrames(
  current: readonly RemotePlayer[],
  incoming: readonly RemotePlayer[],
  limit = 32,
): RemotePlayer[] {
  const byId = new Map<string, RemotePlayer>();
  for (const player of current) byId.set(player.playerId, player);
  for (const player of incoming) {
    const previous = byId.get(player.playerId);
    if (!previous || player.updatedAt >= previous.updatedAt) byId.set(player.playerId, player);
  }
  return [...byId.values()]
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
    .slice(0, Math.max(1, limit));
}

/** تصحیح ساعت: اختلاف ساعت سرور و مرورگر از `serverNow - receivedAt`. */
export function clockOffsetFromFrame(serverNow: number | null, receivedAt: number): number {
  if (!Number.isFinite(serverNow) || !Number.isFinite(receivedAt) || serverNow === null) return 0;
  const offset = serverNow - receivedAt;
  // اختلاف بزرگ‌تر از یک دقیقه یعنی داده خراب است، نه ساعت واقعی.
  return Math.abs(offset) > 60_000 ? 0 : offset;
}

/** «الان» بر اساس ساعت سرور؛ اگر اختلافی نباشد ساعت مرورگر. */
export function serverClockNow(offset: number, clientNow = Date.now()): number {
  return clientNow + (Number.isFinite(offset) ? offset : 0);
}

/**
 * تأخیر تلاش دوبارهٔ probe وقتی سرویس حضور موقتاً در دسترس نیست (ms).
 * `null` یعنی تلاش دیگری نکن. سه تلاش با فاصلهٔ فزاینده کافی است تا یک
 * ری‌استارت کوتاه سرور، HUD را برای کل جلسه خاموش نکند.
 */
export const PRESENCE_PROBE_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;

export function presenceProbeRetryDelay(attempt: number): number | null {
  if (!Number.isFinite(attempt) || attempt < 0) return null;
  return PRESENCE_PROBE_RETRY_DELAYS_MS[Math.floor(attempt)] ?? null;
}
