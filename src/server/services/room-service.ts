// src/server/services/room-service.ts
// حلقه تراکنشی OCC: خواندن -> اعمال تغییر -> ذخیره مشروط -> انتشار بلادرنگ (تا ۶ بار تلاش)
import { randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import type { GameActionPayload } from '../../contracts/actions';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type ClientRoomView,
  type ErrorCode,
  type HostReservationResult,
} from '../../contracts/types';
import { createInitialRoomState, tickPhaseByClock, type InternalRoomState } from '../../engine/index';
import { ONLINE_WINDOW_MS, projectRoomView } from '../../engine/view-projector';
import {
  actSceneTitle,
  doorCodeFromTargets,
  emblemLabelFa,
  isCorrectPunch,
  normalizeDoorCode,
} from '../../engine/ticket-puzzle';
import { isWellFormedSeatToken, normalizeSeatToken } from '../../contracts/seat-token-format';
import { checkAndRecord } from '../auth/rate-limit';
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

/** پاک‌سازی XSS، نویسه‌های مخفی/جعل جهت و نرمال‌سازی نام بازیکن (با حفظ نیم‌فاصله فارسی \u200C) */
export function sanitizePlayerName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
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

/**
 * پیدا کردن شماره صندلی از روی توکن خام؛ در صورت نامعتبر بودن null.
 * توکن پیش از مقایسه نرمال می‌شود تا لینک دعوتی که در چت فارسی کپی شده
 * (نویسهٔ پنهان RLO/LRM/نیم‌فاصله یا percent-encoded) هم صندلی خودش را پیدا کند.
 */
export function findSeatIndexByToken(state: InternalRoomState, seatToken: string): number | null {
  const token = normalizeSeatToken(seatToken);
  if (token.length < 16) return null;
  for (const seat of state.seats) {
    if (seatTokenMatches(seatToken, seat.seatTokenHash)) return seat.seatIndex;
  }
  return null;
}

/**
 * سقف تلاش‌های OCC: در بدترین حالت هر ۸ بازیکن دقیقاً در یک لحظه پانچ می‌کنند
 * و در هر دور فقط یکی برنده می‌شود؛ پس سقف باید از حداکثر تعداد بازیکن (۸) بیشتر باشد
 * تا هیچ پانچی گم نشود.
 */
export const MAX_OCC_ATTEMPTS = 16;

/**
 * اجرای یک تغییر روی اتاق با حلقه OCC (خواندن -> tick ساعت -> تغییر -> ذخیره مشروط -> انتشار).
 * اگر همه تلاش‌ها با تداخل نسخه روبه‌رو شوند، خطای CONFLICT_RETRY_EXHAUSTED پرتاب می‌شود.
 */
export async function mutateRoom<T>(
  code: string,
  mutator: (state: InternalRoomState, now: number) => T,
  repo: RoomRepository = getRoomRepository(),
): Promise<{ result: T; state: InternalRoomState }> {
  for (let attempt = 0; attempt < MAX_OCC_ATTEMPTS; attempt++) {
    const state = await repo.getRoom(code);
    if (!state) {
      const err = new Error('ROOM_NOT_FOUND') as Error & { code?: string };
      err.code = 'ROOM_NOT_FOUND';
      throw err;
    }
    const now = Date.now();
    const ticked = tickPhaseByClock(state, now);
    let result: T;
    try {
      result = mutator(state, now);
    } catch (err) {
      // حتی اگر اکشن رد شود (مثلاً CUTSCENE_LOCKED)، گذار فازِ تیک ساعت نباید گم شود:
      // ابتدا گذار را ماندگار می‌کنیم، بعد خطا را پرتاب می‌کنیم.
      if (ticked) {
        const saved = await repo.saveRoomIfVersion(state, state.version).catch(() => false);
        if (saved) publishRoomUpdate(state);
      }
      throw err;
    }
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
  // پیشبرد فاز بر اساس ساعت سرور هنگام خواندن نیز ماندگار و به همه شنونده‌های اتاق منتشر می‌شود
  if (tickPhaseByClock(state, Date.now())) {
    const saved = await repo.saveRoomIfVersion(state, state.version).catch(() => false);
    if (saved) {
      publishRoomUpdate(state);
    } else {
      const fresh = await repo.getRoom(code);
      if (fresh) return fresh;
    }
  }
  return state;
}

// ---------------------------------------------------------------------------
// موج ۲: اکشن‌های بازی، چت تیمی و نمای امن بازیکن
// ---------------------------------------------------------------------------

export class GameServiceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'GameServiceError';
  }
}

/** پیام‌های ۴۰۱ توکن صندلی: دقیق و قابل‌اقدام برای بازیکن، به‌جای «توکن معتبر نیست» مبهم. */
export const SEAT_TOKEN_MISSING_MESSAGE = 'توکن صندلی ارسال نشده است.';
export const SEAT_TOKEN_MALFORMED_MESSAGE =
  'لینک دعوت کامل به دست ما نرسیده است؛ احتمالاً هنگام کپی بخشی از آن بریده شده یا نویسهٔ پنهان چسبانده است. لینک را از همان پیام اصلی دوباره باز کنید یا از میزبان لینک تازه بخواهید.';
export const SEAT_TOKEN_UNKNOWN_MESSAGE =
  'این لینک دعوت به هیچ صندلی در این اتاق نمی‌خورد؛ از میزبان بخواهید لینک صندلی شما را دوباره بفرستد.';
export const SEAT_TOKEN_REVOKED_MESSAGE =
  'صندلی این لینک باطل شده است و با آن نمی‌توان وارد شد؛ از میزبان لینک تازه بخواهید یا اتاق تازه رزرو کنید.';

/** آیا صندلی‌ای در این اتاق با اخراج از پنل ادمین باطل (هش خالی) شده است؟ */
export function hasRevokedSeat(state: InternalRoomState | null | undefined): boolean {
  return Boolean(state?.seats.some((seat) => seat.seatTokenHash === ''));
}

/**
 * خطای ۴۰۱ با پیام دقیق. سه حالت برای بازیکن قابل تفکیک است:
 * توکن نرسیده · لینک ناقص/آلوده · لینک بیگانه با اتاق یا صندلی باطل‌شده.
 */
export function invalidSeatTokenError(
  seatToken: string,
  state?: InternalRoomState | null,
): GameServiceError {
  const token = normalizeSeatToken(seatToken);
  if (!token) return new GameServiceError('INVALID_SEAT_TOKEN', SEAT_TOKEN_MISSING_MESSAGE, 401);
  if (!isWellFormedSeatToken(token)) {
    return new GameServiceError('INVALID_SEAT_TOKEN', SEAT_TOKEN_MALFORMED_MESSAGE, 401);
  }
  return new GameServiceError(
    'INVALID_SEAT_TOKEN',
    hasRevokedSeat(state) ? SEAT_TOKEN_REVOKED_MESSAGE : SEAT_TOKEN_UNKNOWN_MESSAGE,
    401,
  );
}

function requireSeat(state: InternalRoomState, seatToken: string): number {
  const seatIndex = findSeatIndexByToken(state, seatToken);
  if (seatIndex === null) {
    throw invalidSeatTokenError(seatToken, state);
  }
  return seatIndex;
}

export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('COMPLETE_INVITATION_VIDEO') }),
  z.object({
    type: z.literal('PUNCH_MY_TICKET'),
    emblem: z.enum(['mask', 'violin', 'dancer', 'candelabra', 'rose', 'swan', 'hourglass', 'bell']),
    actNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    rowCode: z.enum(['I', 'II', 'III', 'IV']),
  }),
  z.object({ type: z.literal('UNLOCK_THEATER_DOOR'), code: z.string().min(1).max(16) }),
  z.object({
    type: z.literal('INSPECT_AUDITORIUM_HOTSPOT'),
    hotspotId: z.enum(['shattered-chandelier', 'crooked-paintings', 'three-dark-stages', 'locked-exit-doors']),
  }),
]);

export interface ActionOutcome {
  accepted: boolean;
  message: string;
  code?: ErrorCode;
  roomView: ClientRoomView;
}

/** دریافت نمای امن بازیکن + علامت‌گذاری ورود/آنلاین بودن او */
export async function getRoomViewForSeat(
  code: string,
  seatToken: string,
  repo: RoomRepository = getRoomRepository(),
): Promise<ClientRoomView> {
  try {
    const { state } = await mutateRoom(
      code,
      (s, now) => {
        const seatIndex = requireSeat(s, seatToken);
        const seat = s.seats[seatIndex] as (typeof s.seats)[number];
        seat.joined = true;
        seat.isOnline = true;
        seat.lastSeenAt = now;
        return seatIndex;
      },
      repo,
    );
    const seatIndex = requireSeat(state, seatToken);
    return projectRoomView(state, seatIndex, Date.now());
  } catch (err) {
    if (err instanceof GameServiceError) throw err;
    if (err instanceof Error && (err as Error & { code?: string }).code === 'ROOM_NOT_FOUND') {
      throw new GameServiceError('ROOM_NOT_FOUND', 'اتاق پیدا نشد.', 404);
    }
    throw err;
  }
}

/** دریافت نمای شرطی برای polling با sinceVersion بدون افزایش بی‌مورد نسخه در پنجره حضور */
export async function getRoomViewConditional(
  code: string,
  seatToken: string,
  sinceVersion: number,
  repo: RoomRepository = getRoomRepository(),
): Promise<
  | { unchanged: true; version: number; serverNow: number }
  | { unchanged: false; roomView: ClientRoomView }
> {
  if (Number.isFinite(sinceVersion) && sinceVersion > 0) {
    const state = await loadRoom(code, repo);
    if (!state) {
      throw new GameServiceError('ROOM_NOT_FOUND', 'اتاق پیدا نشد.', 404);
    }
    const seatIndex = requireSeat(state, seatToken);
    const seat = state.seats[seatIndex] as (typeof state.seats)[number];
    const now = Date.now();
    const leaseFresh =
      seat.joined &&
      seat.lastSeenAt !== null &&
      now - seat.lastSeenAt < PRESENCE_REFRESH_INTERVAL_MS;
    if (leaseFresh && state.version === sinceVersion) {
      return { unchanged: true, version: state.version, serverNow: now };
    }
  }
  const roomView = await getRoomViewForSeat(code, seatToken, repo);
  return { unchanged: false, roomView };
}

/** SSE lease cadence. Keep below the projector's 30-second online window. */
export const PRESENCE_REFRESH_INTERVAL_MS = Math.floor(ONLINE_WINDOW_MS / 2);

/** Refresh an authenticated seat's persisted presence without writing on every SSE clock tick. */
export async function touchSeatPresence(
  code: string,
  seatToken: string,
  repo: RoomRepository = getRoomRepository(),
  now = Date.now(),
): Promise<ClientRoomView> {
  for (let attempt = 0; attempt < MAX_OCC_ATTEMPTS; attempt++) {
    const state = await repo.getRoom(code);
    if (!state) throw new GameServiceError('ROOM_NOT_FOUND', 'اتاق پیدا نشد.', 404);

    const seatIndex = requireSeat(state, seatToken);
    const seat = state.seats[seatIndex] as (typeof state.seats)[number];
    const ticked = tickPhaseByClock(state, now);
    const shouldRefresh =
      !seat.joined || seat.lastSeenAt === null || now - seat.lastSeenAt >= PRESENCE_REFRESH_INTERVAL_MS;

    if (!shouldRefresh && !ticked) return projectRoomView(state, seatIndex, now);

    if (shouldRefresh) {
      seat.joined = true;
      seat.isOnline = true;
      seat.lastSeenAt = now;
    }

    if (await repo.saveRoomIfVersion(state, state.version)) {
      publishRoomUpdate(state);
      return projectRoomView(state, seatIndex, now);
    }
  }

  throw new GameServiceError(
    'CONFLICT_RETRY_EXHAUSTED',
    'به‌روزرسانی حضور همزمان چند بار تداخل داشت؛ دوباره تلاش کنید.',
    409,
  );
}

export async function performGameAction(
  code: string,
  seatToken: string,
  actionInput: unknown,
  repo: RoomRepository = getRoomRepository(),
): Promise<ActionOutcome> {
  const action = gameActionSchema.parse(actionInput) as GameActionPayload;
  const { result, state } = await mutateRoom(
    code,
    (s, now) => {
      const seatIndex = requireSeat(s, seatToken);
      const seat = s.seats[seatIndex] as (typeof s.seats)[number];
      seat.joined = true;
      seat.lastSeenAt = now;

      // قفل سخت‌گیرانه کات‌سین: در ۷۴ ثانیه پخش هیچ اکشنی پذیرفته نمی‌شود
      if (s.phase === 'door_cutscene' || s.phase === 'theater_cutscene') {
        throw new GameServiceError(
          'CUTSCENE_LOCKED',
          'در طول کات‌سین فقط می‌توانید سر خود را به چپ و راست بچرخانید.',
          409,
        );
      }

      let outcome: { accepted: boolean; message: string; code?: ErrorCode };
      switch (action.type) {
        case 'COMPLETE_INVITATION_VIDEO': {
          if (s.phase !== 'alley_puzzle') {
            throw new GameServiceError('INVALID_PHASE', 'ویدیوی دعوت‌نامه فقط در کوچه معتبر است.', 409);
          }
          seat.hasWatchedInvitation = true;
          outcome = { accepted: true, message: 'کارت دعوت دیده شد؛ بلیط‌ها در دست شماست.' };
          break;
        }
        case 'PUNCH_MY_TICKET': {
          if (s.phase !== 'alley_puzzle') {
            throw new GameServiceError('INVALID_PHASE', 'پانچ بلیط فقط در کوچه ممکن است.', 409);
          }
          if (seat.ticketPunched) {
            outcome = { accepted: true, message: 'بلیط شما قبلاً پانچ و معتبر شده است.' };
            break;
          }
          const target = s.targets[seatIndex] as (typeof s.targets)[number];
          if (!isCorrectPunch(target, action)) {
            outcome = {
              accepted: false,
              code: 'TICKET_WRONG_PUNCH',
              message: 'پانچ درست نیست؛ نماد را از کوپن هم‌تیمی و پرده و ردیف را از دو دیوار کوچه دوباره چک کنید.',
            };
            break;
          }
          seat.ticketPunched = true;
          seat.selectedPunch = {
            emblem: action.emblem,
            actNumber: action.actNumber,
            rowCode: action.rowCode,
          };
          outcome = {
            accepted: true,
            message: `بلیط پانچ شد! رقم طلایی خط برش شما: ${target.goldenDigit}`,
          };
          break;
        }
        case 'UNLOCK_THEATER_DOOR': {
          if (s.phase !== 'alley_puzzle') {
            throw new GameServiceError('INVALID_PHASE', 'قفل در فقط در کوچه باز می‌شود.', 409);
          }
          if (!s.seats.every((p) => p.ticketPunched)) {
            outcome = {
              accepted: false,
              code: 'TICKETS_NOT_ALL_PUNCHED',
              message: 'هنوز همه بلیط‌ها پانچ نشده‌اند؛ چراغ همه اعضا روی گیشه باید سبز شود.',
            };
            break;
          }
          if (!checkAndRecord(`door:${s.code}:${seatIndex}`, 5, 60_000, now)) {
            throw new GameServiceError('RATE_LIMITED', 'تلاش بیش از حد روی قفل در؛ کمی صبر کنید.', 429);
          }
          s.doorAttempts += 1;
          if (normalizeDoorCode(action.code) === doorCodeFromTargets(s.targets)) {
            s.phase = 'door_cutscene';
            s.cutsceneStartedAt = now;
            s.doorLastFeedback = 'قفل چرخید... درِ سنگین تماشاخانه در حال باز شدن است!';
            outcome = { accepted: true, message: s.doorLastFeedback };
          } else {
            s.doorLastFeedback = 'ترکیب درست نیست؛ ارقام طلایی را به ترتیب شماره صندلی کنار هم بگذارید.';
            outcome = { accepted: false, code: 'WRONG_DOOR_COMBINATION', message: s.doorLastFeedback };
          }
          break;
        }
        case 'INSPECT_AUDITORIUM_HOTSPOT': {
          if (s.phase !== 'in_theater') {
            throw new GameServiceError('INVALID_PHASE', 'بررسی سالن فقط پس از پایان کات‌سین ممکن است.', 409);
          }
          const list = s.inspectedHotspots[action.hotspotId];
          if (!list.includes(seat.playerName)) list.push(seat.playerName);
          outcome = { accepted: true, message: 'این بخش از سالن تاریک بررسی شد.' };
          break;
        }
      }
      return { seatIndex, ...outcome };
    },
    repo,
  ).catch((err: unknown) => {
    if (err instanceof Error && (err as Error & { code?: string }).code === 'ROOM_NOT_FOUND') {
      throw new GameServiceError('ROOM_NOT_FOUND', 'اتاق پیدا نشد.', 404);
    }
    throw err;
  });
  return { ...result, roomView: projectRoomView(state, result.seatIndex, Date.now()) };
}

/**
 * پاک‌سازی متن نجوا بدون حذف سرنخ‌های معما (اعداد، پرانتزها، علامت‌های نقل‌قول و غیره):
 * فقط تگ‌های واقعی HTML و نویسه‌های کنترلی/جعل جهت حذف می‌شوند و نیم‌فاصله فارسی (\u200C) حفظ می‌شود.
 */
export function sanitizeChatMessage(raw: string): string {
  return raw
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const chatSchema = z
  .object({
    text: z.string().optional().default('').transform(sanitizeChatMessage),
    shareStub: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.shareStub) {
      if (val.text.length > 500) {
        ctx.addIssue({
          code: 'custom',
          path: ['text'],
          message: 'پیام بیش از حد طولانی است.',
        });
      }
      return;
    }
    if (val.text.length < 1 || val.text.length > 400) {
      ctx.addIssue({
        code: 'custom',
        path: ['text'],
        message: 'پیام باید بین ۱ تا ۴۰۰ کاراکتر باشد.',
      });
    }
  });

export const CHAT_RATE_LIMIT_MAX = 20;
export const CHAT_RATE_LIMIT_WINDOW_MS = 10_000;

export async function sendChatMessage(
  code: string,
  seatToken: string,
  input: unknown,
  repo: RoomRepository = getRoomRepository(),
): Promise<ClientRoomView> {
  const { text, shareStub } = chatSchema.parse(input);
  const { state } = await mutateRoom(
    code,
    (s, now) => {
      const seatIndex = requireSeat(s, seatToken);
      if (!checkAndRecord(`chat:${s.code}:${seatIndex}`, CHAT_RATE_LIMIT_MAX, CHAT_RATE_LIMIT_WINDOW_MS, now)) {
        throw new GameServiceError(
          'RATE_LIMITED',
          'ارسال پیام بیش از حد سریع است؛ چند لحظه صبر کنید.',
          429,
        );
      }
      const seat = s.seats[seatIndex] as (typeof s.seats)[number];
      seat.joined = true;
      seat.isOnline = true;
      seat.lastSeenAt = now;
      if (shareStub) {
        const nextIndex = (seatIndex + 1) % s.playerCount;
        const nextSeat = s.seats[nextIndex] as (typeof s.seats)[number];
        const nextTarget = s.targets[nextIndex] as (typeof s.targets)[number];
        s.messages.push({
          id: `msg-${s.version}-${now}-${seatIndex}-stub`,
          senderName: seat.playerName,
          type: 'ticket_share',
          text: `کوپن دست من برای بلیط «${nextSeat.playerName}»: نماد «${emblemLabelFa(nextTarget.targetEmblem)}»، پردهٔ «${actSceneTitle(nextTarget.targetAct)}»`,
          createdAt: now,
        });
      }
      const isAutoCouponEcho =
        Boolean(shareStub) &&
        (text.length === 0 ||
          text.startsWith('کوپن من برای ') ||
          text.startsWith('کوپن دست من برای '));
      if (!isAutoCouponEcho) {
        s.messages.push({
          id: `msg-${s.version}-${now}-${seatIndex}`,
          senderName: seat.playerName,
          type: 'whisper',
          text,
          createdAt: now,
        });
      }
      if (s.messages.length > 100) s.messages = s.messages.slice(-100);
      return seatIndex;
    },
    repo,
  ).catch((err: unknown) => {
    if (err instanceof Error && (err as Error & { code?: string }).code === 'ROOM_NOT_FOUND') {
      throw new GameServiceError('ROOM_NOT_FOUND', 'اتاق پیدا نشد.', 404);
    }
    throw err;
  });
  const seatIndex = requireSeat(state, seatToken);
  return projectRoomView(state, seatIndex, Date.now());
}

