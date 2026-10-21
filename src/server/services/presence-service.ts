// src/server/services/presence-service.ts
// سرویس حضور حرکتی (فاز ۰۳ / قرارداد #104).
//
// مسیرها این فایل را صدا می‌زنند و همهٔ منطق (اعتبار توکن، اعتبارسنجی بدنه و
// محدودهٔ صحنه) همین‌جاست تا بدون HTTP هم تست شود.
import { z } from 'zod';
import { checkAndRecord } from '../auth/rate-limit';
import { getRoomRepository, type RoomRepository } from '../db/repository';
import {
  listPresence,
  publishPresence,
  sanitizePresenceInput,
  type PresenceWire,
} from '../realtime/presence-tracker';
import {
  GameServiceError,
  findSeatIndexByToken,
  loadRoom,
} from './room-service';

/** بیشینهٔ درخواست حضور در هر ثانیه برای یک صندلی — مطابق معیار فاز ۰۳ (۵۰/ثانیه). */
export const PRESENCE_RATE_LIMIT_MAX = 50;
export const PRESENCE_RATE_LIMIT_WINDOW_MS = 1_000;

export const presencePublishSchema = z.object({
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  // رادیان؛ بازهٔ بزرگ‌تر از [-π, π] پذیرفته و نرمال می‌شود (کلاینت ممکن است
  // زاویهٔ انباشته بفرستد)، ولی مقدار بی‌معنا رد می‌شود.
  yaw: z.number(),
  phase: z.string().max(64).optional(),
});

export interface PresenceFrame {
  presences: PresenceWire[];
  serverNow: number;
}

/**
 * اعتبارسنجی توکن صندلی و برگرداندن اتاق.
 * خطاها با کدهای قرارداد ۴ برمی‌گردند: ۴۰۴ اتاق، ۴۰۱ توکن.
 */
async function requireRoomSeat(
  code: string,
  seatToken: string,
  repo: RoomRepository,
): Promise<{ state: NonNullable<Awaited<ReturnType<typeof loadRoom>>>; seatIndex: number }> {
  if (!seatToken) {
    throw new GameServiceError('INVALID_SEAT_TOKEN', 'توکن صندلی ارسال نشده است.', 401);
  }
  const state = await loadRoom(code, repo);
  if (!state) {
    throw new GameServiceError('ROOM_NOT_FOUND', 'اتاق پیدا نشد.', 404);
  }
  const seatIndex = findSeatIndexByToken(state, seatToken);
  if (seatIndex === null) {
    throw new GameServiceError('INVALID_SEAT_TOKEN', 'توکن صندلی معتبر نیست.', 401);
  }
  return { state, seatIndex };
}

/**
 * ثبت یک snapshot حضور. هویت بازیکن از توکن خوانده می‌شود، نه از بدنه.
 * موقعیت خارج از محدوده یا مقدار غیرمتناهی → ۴۰۰ (نه ذخیرهٔ دادهٔ خراب).
 */
export async function publishSeatPresence(
  code: string,
  seatToken: string,
  body: unknown,
  repo: RoomRepository = getRoomRepository(),
  now = Date.now(),
): Promise<PresenceFrame> {
  const { state, seatIndex } = await requireRoomSeat(code, seatToken, repo);

  if (!checkAndRecord(`presence:${code}:${seatIndex}`, PRESENCE_RATE_LIMIT_MAX, PRESENCE_RATE_LIMIT_WINDOW_MS, now)) {
    throw new GameServiceError('RATE_LIMITED', 'درخواست‌های حضور بیش از حد مجاز است.', 429);
  }

  const parsed = presencePublishSchema.safeParse(body);
  if (!parsed.success) {
    throw new GameServiceError('VALIDATION_ERROR', 'بدنهٔ درخواست حضور معتبر نیست.', 400);
  }

  const seat = state.seats[seatIndex];
  if (!seat) {
    throw new GameServiceError('INVALID_SEAT_TOKEN', 'صندلی پیدا نشد.', 401);
  }

  const record = sanitizePresenceInput(
    parsed.data,
    { playerId: seat.playerId, seatIndex, playerName: seat.playerName },
    now,
  );
  if (!record) {
    throw new GameServiceError(
      'VALIDATION_ERROR',
      'موقعیت ارسالی خارج از محدودهٔ صحنه یا نامعتبر است.',
      400,
    );
  }

  publishPresence(code, record);
  return { presences: listPresence(code, now), serverNow: now };
}

/**
 * فهرست فعلی حضور اتاق برای یک صندلی معتبر.
 * کلاینت با این مسیر وجود سرویس را probe می‌کند (GET).
 */
export async function getSeatPresences(
  code: string,
  seatToken: string,
  repo: RoomRepository = getRoomRepository(),
  now = Date.now(),
): Promise<PresenceFrame> {
  await requireRoomSeat(code, seatToken, repo);
  return { presences: listPresence(code, now), serverNow: now };
}
