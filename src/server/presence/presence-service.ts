// src/server/presence/presence-service.ts — سرویس حضور: احراز صندلی، سقف نرخ،
// اعتبارسنجی موقعیت و ثبت آخرین snapshot (فاز ۰۳ — توحید)
import { ZodError } from 'zod';
import {
  PRESENCE_RATE_LIMIT_PER_SEC,
  PRESENCE_RATE_WINDOW_MS,
  describePresenceBounds,
  isInsidePresenceBounds,
  normalizeYaw,
  presenceBoundsForPhase,
  presenceSnapshotSchema,
  type PresenceEntry,
} from '../../contracts/presence';
import { checkAndRecord } from '../auth/rate-limit';
import type { RoomRepository } from '../db/repository';
import {
  GameServiceError,
  findSeatIndexByToken,
  loadRoom,
} from '../services/room-service';
import { getRoomPresence, submitPresence } from './presence-store';

export interface PresenceAuthInput {
  roomCode: string;
  seatToken: string;
  repo?: RoomRepository;
  now?: number;
}

export interface SubmitPresenceResult {
  entry: PresenceEntry;
  /** وضعیت جاری همهٔ هم‌تیمی‌ها (شامل خود بازیکن) */
  presences: PresenceEntry[];
  serverNow: number;
}

export function presenceRateLimitKey(roomCode: string, seatIndex: number): string {
  return `presence:${roomCode.toUpperCase()}:${seatIndex}`;
}

/** پیدا کردن صندلی از توکن؛ خطاهای فارسی مطابق قرارداد ۴ (ApiError). */
async function requireSeat(input: PresenceAuthInput, now: number) {
  const state = await loadRoom(input.roomCode, input.repo);
  if (!state) {
    throw new GameServiceError('ROOM_NOT_FOUND', 'اتاق پیدا نشد.', 404);
  }
  const seatIndex = findSeatIndexByToken(state, input.seatToken);
  if (seatIndex === null) {
    throw new GameServiceError('INVALID_SEAT_TOKEN', 'توکن صندلی معتبر نیست.', 401);
  }
  const seat = state.seats[seatIndex];
  if (!seat) {
    throw new GameServiceError('INVALID_SEAT_TOKEN', 'صندلی این توکن پیدا نشد.', 401);
  }
  return { seat, seatIndex, phase: state.phase, now };
}

/**
 * ثبت snapshot حضور یک بازیکن.
 * هویت از صندلی احرازشده گرفته می‌شود و position/yaw اعتبارسنجی و نرمال می‌شوند.
 */
export async function submitSeatPresence(
  input: PresenceAuthInput,
  body: unknown,
): Promise<SubmitPresenceResult> {
  const now = input.now ?? Date.now();
  const { seat, seatIndex } = await requireSeat(input, now);

  // سقف ۵۰ درخواست در ثانیه برای هر صندلی (قرارداد ۲)
  const allowed = checkAndRecord(
    presenceRateLimitKey(input.roomCode, seatIndex),
    PRESENCE_RATE_LIMIT_PER_SEC,
    PRESENCE_RATE_WINDOW_MS,
    now,
  );
  if (!allowed) {
    throw new GameServiceError(
      'RATE_LIMITED',
      'تعداد ارسال موقعیت بیش از حد مجاز است؛ کمی صبر کنید.',
      429,
    );
  }

  const snapshot = presenceSnapshotSchema.parse(body);
  const bounds = presenceBoundsForPhase(snapshot.phase);
  if (!isInsidePresenceBounds(snapshot.position, bounds)) {
    throw new GameServiceError('VALIDATION_ERROR', describePresenceBounds(bounds), 400);
  }

  const entry: PresenceEntry = {
    // هویت همیشه از سرور؛ playerId/seatIndex ارسالی کلاینت نادیده گرفته می‌شود
    playerId: seat.playerId,
    seatIndex,
    playerName: seat.playerName,
    position: {
      x: snapshot.position.x,
      y: snapshot.position.y,
      z: snapshot.position.z,
    },
    yaw: normalizeYaw(snapshot.yaw),
    phase: snapshot.phase,
    lastUpdate: snapshot.lastUpdate ?? now,
    receivedAt: now,
  };

  const presences = submitPresence(input.roomCode, entry);
  return { entry, presences, serverNow: now };
}

/**
 * خواندن وضعیت حضور اتاق برای یک صندلی احرازشده.
 * برای کلاینت‌هایی که SSE ندارند و به‌عنوان fallback پس از reconnect استفاده می‌شود.
 */
export async function getSeatPresence(input: PresenceAuthInput): Promise<{
  presences: PresenceEntry[];
  serverNow: number;
}> {
  const now = input.now ?? Date.now();
  await requireSeat(input, now);
  return { presences: getRoomPresence(input.roomCode, now), serverNow: now };
}

/** برای تست‌ها: تشخیص ZodError بدون وابستگی به پیام انگلیسی */
export function isPresenceValidationError(err: unknown): err is ZodError {
  return err instanceof ZodError;
}
