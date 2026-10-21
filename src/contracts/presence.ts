// src/contracts/presence.ts — قرارداد ۲: حضور بازیکن در جهان سه‌بعدی (فاز ۰۳ — توحید)
// منبع: docs/CONTRACTS.md قرارداد ۲ و docs/features/multiplayer-presence.md
//
// سرور فقط «آخرین snapshot» هر صندلی را نگه می‌دارد (بدون تاریخچه) و ۳۰ ثانیه پس از
// آخرین به‌روزرسانی آن را پاک می‌کند. هویت بازیکن (playerId / seatIndex / playerName)
// هرگز از بدنهٔ درخواست پذیرفته نمی‌شود؛ از صندلی احرازشده با seat token خوانده می‌شود.
import { z } from 'zod';

/** بعد از این مدت، snapshot بازیکن از دید هم‌تیمی‌ها حذف می‌شود (قرارداد ۲). */
export const PRESENCE_TTL_MS = 30_000;

/** نرخ ارسال پیشنهادی کلاینت: ۵ تا ۱۰ بار در ثانیه. */
export const PRESENCE_MIN_CLIENT_HZ = 5;
export const PRESENCE_MAX_CLIENT_HZ = 10;

/** سقف سرور: ۵۰ درخواست در ثانیه برای هر صندلی. */
export const PRESENCE_RATE_LIMIT_PER_SEC = 50;
export const PRESENCE_RATE_WINDOW_MS = 1_000;

/**
 * فاصلهٔ هم‌جوشی ارسال snapshot به همهٔ اتصالات SSE یک اتاق.
 * ۵۰ میلی‌ثانیه باعث می‌شود با ۸ بازیکن با نرخ ۱۰Hz حداکثر ۲۰ رویداد در ثانیه
 * برای هر اتصال ارسال شود، ولی تأخیر دیدن حرکت هم‌تیمی زیر ۲۰۰ms بماند.
 */
export const PRESENCE_STREAM_FLUSH_MS = 50;

export interface PresenceVector3 {
  x: number;
  y: number;
  z: number;
}

/** شکل snapshot که کلاینت در بدنهٔ POST /api/rooms/[code]/presence می‌فرستد. */
export interface PresenceSnapshot {
  /** توسط سرور از صندلی احرازشده پر می‌شود؛ مقدار ارسالی کلاینت نادیده گرفته می‌شود. */
  playerId: string;
  /** توسط سرور از توکن صندلی تعیین می‌شود؛ مقدار ارسالی کلاینت نادیده گرفته می‌شود. */
  seatIndex: number;
  position: PresenceVector3;
  /** چرخش حول محور عمودی به رادیان، نرمال‌شده در بازهٔ [-π, π). */
  yaw: number;
  /** فاز بازی هنگام ثبت snapshot. */
  phase: string;
  /** ساعت کلاینت در لحظهٔ ارسال؛ سرور receivedAt خودش را مرجع می‌داند. */
  lastUpdate: number;
}

/** نمای snapshot در سرور و در استریم SSE (شامل نام نمایشی و زمان دریافت سرور). */
export interface PresenceEntry extends PresenceSnapshot {
  playerName: string;
  /** ساعت سرور هنگام دریافت؛ مرجع انقضای ۳۰ ثانیه‌ای. */
  receivedAt: number;
}

/** پیام event: presence_update در استریم SSE. */
export interface PresenceStreamPayload {
  presences: PresenceEntry[];
  serverNow: number;
}

export interface PresenceBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** هم‌راستا با DEFAULT_ALLEY_BOUNDS در src/engine3d/types.ts (مالک: علیرضا). */
export const ALLEY_PRESENCE_BOUNDS: PresenceBounds = {
  minX: -9,
  maxX: 9,
  minY: 0,
  maxY: 3.2,
  minZ: -18,
  maxZ: 8,
};

/** سالن کوچک با ۲۰ صندلی پلکانی؛ با حاشیهٔ امن برای راهروها و صحنه. */
export const THEATER_PRESENCE_BOUNDS: PresenceBounds = {
  minX: -14,
  maxX: 14,
  minY: 0,
  maxY: 7,
  minZ: -22,
  maxZ: 14,
};

export function presenceBoundsForPhase(phase: string): PresenceBounds {
  return phase === 'in_theater' || phase === 'theater_cutscene'
    ? THEATER_PRESENCE_BOUNDS
    : ALLEY_PRESENCE_BOUNDS;
}

/** نرمال‌سازی به بازهٔ [-π, π) با تحمل مقادیر چنددوره‌ای. */
export function normalizeYaw(yaw: number): number {
  const twoPi = Math.PI * 2;
  let normalized = yaw % twoPi;
  if (normalized >= Math.PI) normalized -= twoPi;
  if (normalized < -Math.PI) normalized += twoPi;
  return normalized;
}

export function isInsidePresenceBounds(
  position: PresenceVector3,
  bounds: PresenceBounds,
): boolean {
  return (
    position.x >= bounds.minX &&
    position.x <= bounds.maxX &&
    position.y >= bounds.minY &&
    position.y <= bounds.maxY &&
    position.z >= bounds.minZ &&
    position.z <= bounds.maxZ
  );
}

/** پیام فارسی خطای خارج بودن موقعیت از محدودهٔ جهان. */
export function describePresenceBounds(bounds: PresenceBounds): string {
  return `موقعیت خارج از محدودهٔ جهان است (x: ${bounds.minX} تا ${bounds.maxX}، y: ${bounds.minY} تا ${bounds.maxY}، z: ${bounds.minZ} تا ${bounds.maxZ}).`;
}

const finiteNumber = z
  .number({ invalid_type_error: 'مختصات موقعیت باید عدد باشد.' })
  .refine((value) => Number.isFinite(value), 'مختصات موقعیت باید عدد متناهی باشد.');

/**
 * طرح اعتبارسنجی بدنهٔ presence.
 * playerId و seatIndex اختیاری‌اند و فقط برای سازگاری شکل قرارداد پذیرفته می‌شوند؛
 * مقادیرشان کنار گذاشته می‌شود تا کسی نتواند خودش را جای هم‌تیمی جا بزند.
 * همهٔ پیام‌های خطا فارسی‌اند (قرارداد ۴).
 */
export const presenceSnapshotSchema = z.object(
  {
    playerId: z
      .string({ invalid_type_error: 'شناسهٔ بازیکن باید متن باشد.' })
      .max(64, 'شناسهٔ بازیکن بیش از حد بلند است.')
      .optional(),
    seatIndex: z
      .number({ invalid_type_error: 'شمارهٔ صندلی باید عدد باشد.' })
      .int('شمارهٔ صندلی باید عدد صحیح باشد.')
      .min(0, 'شمارهٔ صندلی معتبر نیست.')
      .max(19, 'شمارهٔ صندلی معتبر نیست.')
      .optional(),
    position: z.object(
      { x: finiteNumber, y: finiteNumber, z: finiteNumber },
      { required_error: 'موقعیت بازیکن الزامی است.', invalid_type_error: 'موقعیت بازیکن معتبر نیست.' },
    ),
    yaw: z
      .number({ invalid_type_error: 'زاویهٔ دید باید عدد باشد.' })
      .refine((value) => Number.isFinite(value), 'زاویهٔ دید باید عدد متناهی باشد.'),
    phase: z
      .string({ invalid_type_error: 'فاز بازی باید متن باشد.' })
      .min(1, 'فاز بازی الزامی است.')
      .max(32, 'نام فاز بیش از حد بلند است.'),
    lastUpdate: z
      .number({ invalid_type_error: 'زمان ارسال باید عدد باشد.' })
      .int('زمان ارسال باید عدد صحیح باشد.')
      .nonnegative('زمان ارسال نمی‌تواند منفی باشد.')
      .optional(),
  },
  { required_error: 'بدنهٔ snapshot حضور الزامی است.', invalid_type_error: 'بدنهٔ snapshot حضور معتبر نیست.' },
);
