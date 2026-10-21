// src/server/services/room-service.ts
// حلقه تراکنشی OCC: خواندن -> اعمال تغییر -> ذخیره مشروط -> انتشار بلادرنگ (تا ۶ بار تلاش)
import { randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import { MAX_PLAYERS, MIN_PLAYERS, type HostReservationResult } from '../../contracts/types';
import { createInitialRoomState, tickPhaseByClock, type InternalRoomState } from '../../engine/index';
import { generateSeatToken, hashSeatToken, seatTokenMatches } from '../auth/seat-token';
import { getRoomRepository, type RoomRepository } from '../db/repository';
import { publishRoomUpdate } from '../realtime/room-hub';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون حروف/ارقام مبهم

export function generateRoomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** پاک‌سازی XSS و نرمال‌سازی نام بازیکن: حذف تگ/کاراکتر کنترلی و فشردن فاصله‌ها */
export function sanitizePlayerName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const reserveRoomSchema = z.object({
  playerCount: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS),
  playerNames: z
    .array(z.string())
    .transform((names) => names.map(sanitizePlayerName))
    .refine((names) => names.every((n) => n.length >= 2 && n.length <= 24), {
      message: 'نام هر بازیکن باید بین ۲ تا ۲۴ کاراکتر باشد.',
    })
    .refine((names) => new Set(names).size === names.length, {
      message: 'نام بازیکنان باید متفاوت باشد.',
    }),
});

export type ReserveRoomInput = z.input<typeof reserveRoomSchema>;

export async function reserveRoom(
  input: unknown,
  repo: RoomRepository = getRoomRepository(),
  now = Date.now(),
): Promise<HostReservationResult> {
  const parsed = reserveRoomSchema.parse(input);
  if (parsed.playerNames.length !== parsed.playerCount) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['playerNames'],
        message: 'تعداد نام‌ها باید دقیقاً برابر تعداد بازیکنان باشد.',
      },
    ]);
  }

  // تلاش برای ساخت کد یکتا (در صورت برخورد کد، کد تازه تولید می‌شود)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    if (await repo.getRoom(code)) continue;

    const seatTokens = parsed.playerNames.map(() => generateSeatToken());
    const state = createInitialRoomState({
      code,
      playerNames: parsed.playerNames,
      seatTokenHashes: seatTokens.map(hashSeatToken),
      seed: randomBytes(4).readUInt32LE(0),
      now,
    });
    await repo.createRoom(state);
    publishRoomUpdate(state);

    return {
      roomCode: code,
      playerCount: parsed.playerCount,
      invites: state.seats.map((seat, i) => ({
        seatIndex: seat.seatIndex,
        playerName: seat.playerName,
        seatLabel: seat.seatLabel,
        seatToken: seatTokens[i] as string,
        invitePath: `/invite/${code}/${seatTokens[i] as string}`,
      })),
    };
  }
  throw new Error('ROOM_CODE_GENERATION_FAILED');
}

/** پیدا کردن شماره صندلی از روی توکن خام؛ در صورت نامعتبر بودن null */
export function findSeatIndexByToken(state: InternalRoomState, seatToken: string): number | null {
  if (!seatToken || seatToken.length < 16) return null;
  for (const seat of state.seats) {
    if (seatTokenMatches(seatToken, seat.seatTokenHash)) return seat.seatIndex;
  }
  return null;
}

/**
 * اجرای یک تغییر روی اتاق با حلقه OCC (خواندن -> tick ساعت -> تغییر -> ذخیره مشروط -> انتشار).
 * اگر ۶ بار پشت سر هم تداخل نسخه رخ دهد، خطای CONFLICT_RETRY_EXHAUSTED پرتاب می‌شود.
 */
export async function mutateRoom<T>(
  code: string,
  mutator: (state: InternalRoomState, now: number) => T,
  repo: RoomRepository = getRoomRepository(),
): Promise<{ result: T; state: InternalRoomState }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = await repo.getRoom(code);
    if (!state) {
      const err = new Error('ROOM_NOT_FOUND') as Error & { code?: string };
      err.code = 'ROOM_NOT_FOUND';
      throw err;
    }
    const now = Date.now();
    const ticked = tickPhaseByClock(state, now);
    const result = mutator(state, now);
    const changed = ticked || (state as unknown as { __dirty?: boolean }).__dirty === true;
    // mutatorها با تغییر مستقیم فیلدها کار می‌کنند؛ برای سادگی موج ۱ همیشه ذخیره مشروط انجام می‌شود
    void changed;
    const saved = await repo.saveRoomIfVersion(state, state.version);
    if (saved) {
      publishRoomUpdate(state);
      return { result, state };
    }
  }
  const err = new Error('CONFLICT_RETRY_EXHAUSTED') as Error & { code?: string };
  err.code = 'CONFLICT_RETRY_EXHAUSTED';
  throw err;
}

export async function loadRoom(
  code: string,
  repo: RoomRepository = getRoomRepository(),
): Promise<InternalRoomState | null> {
  const state = await repo.getRoom(code);
  if (!state) return null;
  // پیشبرد فاز بر اساس ساعت سرور هنگام خواندن نیز ماندگار می‌شود
  if (tickPhaseByClock(state, Date.now())) {
    await repo.saveRoomIfVersion(state, state.version).catch(() => false);
  }
  return state;
}
