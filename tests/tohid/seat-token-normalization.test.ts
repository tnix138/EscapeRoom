// ۴۰۱ «توکن صندلی معتبر نیست» هنگام ورود از لینک دعوت — نرمال‌سازی توکن + پیام دقیق
// سناریوی واقعی: بازیکن لینک دعوت را از چت فارسی کپی می‌کند؛ توکن با نویسهٔ پنهان
// (RLO/LRM/نیم‌فاصله) یا percent-encoded به سرور می‌رسد و هش آن با صندلی نمی‌خواند.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  SEAT_TOKEN_LENGTH,
  isWellFormedSeatToken,
  normalizeSeatToken,
} from '../../src/contracts/seat-token-format';
import { getRoomRepository } from '../../src/server/db/repository';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { performGameAction } from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-seat-token-'));
const previousStorageDriver = process.env.STORAGE_DRIVER;
const previousDbPath = process.env.ESCAPEROOM_DB_PATH;
process.env.STORAGE_DRIVER = 'sqlite';
process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'route.db');

afterAll(() => {
  const repo = getRoomRepository();
  if (repo instanceof SqliteRoomRepository) repo.close();
  if (previousStorageDriver === undefined) delete process.env.STORAGE_DRIVER;
  else process.env.STORAGE_DRIVER = previousStorageDriver;
  if (previousDbPath === undefined) delete process.env.ESCAPEROOM_DB_PATH;
  else process.env.ESCAPEROOM_DB_PATH = previousDbPath;
  rmSync(tmpDir, { recursive: true, force: true });
});

interface ReservationEnvelope {
  ok: boolean;
  data: {
    roomCode: string;
    playerCount: number;
    invites: Array<{ seatIndex: number; playerName: string; seatToken: string; invitePath: string }>;
  };
}

const PLAYER_NAMES = ['میزبان الف', 'بازیکن ب', 'بازیکن ج'];

async function reserveRoom(): Promise<ReservationEnvelope['data']> {
  const { POST } = await import('../../src/app/api/rooms/route');
  const response = await POST(
    new Request('http://localhost/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: PLAYER_NAMES.length, playerNames: PLAYER_NAMES }),
    }),
  );
  expect(response.status).toBe(201);
  const body = (await response.json()) as ReservationEnvelope;
  expect(body.ok).toBe(true);
  return body.data;
}

async function postAction(roomCode: string, seatToken: string) {
  const { POST } = await import('../../src/app/api/rooms/[code]/action/route');
  const response = await POST(
    new Request(`http://localhost/api/rooms/${roomCode}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Seat-Token': seatToken },
      body: JSON.stringify({ type: 'COMPLETE_INVITATION_VIDEO' }),
    }),
    { params: Promise.resolve({ code: roomCode }) },
  );
  return response;
}

describe('قالب توکن صندلی', () => {
  const CLEAN = 'mFoKqDmqPnLSRv6hfOrQPKMZyd21hX572ZKA7qWUXpC2d9x0';

  it('نویسه‌های پنهان و فاصلهٔ چسبیده به توکن کپی‌شده را حذف می‌کند', () => {
    expect(normalizeSeatToken(`${CLEAN}\u202E\u200E`)).toBe(CLEAN); // RLO + LRM انتهای لینک چت فارسی
    expect(normalizeSeatToken(`\u200F ${CLEAN}\n`)).toBe(CLEAN);
    expect(normalizeSeatToken(`${CLEAN.slice(0, 10)}\u200C${CLEAN.slice(10)}`)).toBe(CLEAN); // نیم‌فاصله وسط لینک
    expect(normalizeSeatToken(`\uFEFF${CLEAN}`)).toBe(CLEAN);
  });

  it('توکن percent-encoded و دوبار encode شده را decode می‌کند و توکن سالم را دست‌نخورده نگه می‌دارد', () => {
    expect(normalizeSeatToken(CLEAN)).toBe(CLEAN);
    expect(normalizeSeatToken(`${CLEAN}%E2%80%AE%E2%80%8E`)).toBe(CLEAN);
    expect(normalizeSeatToken(encodeURIComponent(`${CLEAN}\u202E`))).toBe(CLEAN);
    expect(normalizeSeatToken('abc%zz')).toBe('abc%zz'); // decode ناموفق نباید توکن را نابود کند
  });

  it('ورودی تهی و غیررشته‌ای را رشتهٔ خالی برمی‌گرداند', () => {
    expect(normalizeSeatToken(null)).toBe('');
    expect(normalizeSeatToken(undefined)).toBe('');
    expect(normalizeSeatToken(42)).toBe('');
    expect(normalizeSeatToken('   ')).toBe('');
  });

  it('توکن ۴۸ کاراکتری base64url سالم و توکن ناقص را از هم تشخیص می‌دهد', () => {
    expect(CLEAN).toHaveLength(SEAT_TOKEN_LENGTH);
    expect(isWellFormedSeatToken(CLEAN)).toBe(true);
    expect(isWellFormedSeatToken(`${CLEAN}-_`)).toBe(false); // طول اشتباه
    expect(isWellFormedSeatToken(CLEAN.slice(0, SEAT_TOKEN_LENGTH - 1))).toBe(false);
    expect(isWellFormedSeatToken(`${CLEAN}\u202E`)).toBe(false); // نویسهٔ پنهان = ناقص
    expect(isWellFormedSeatToken('')).toBe(false);
  });
});

describe('ورود با لینک دعوت آلوده — POST /api/rooms/[code]/action', () => {
  it('توکن percent-encoded (آدرس decode‌نشده در Vercel) هم بازیکن را وارد کوچه می‌کند', async () => {
    const room = await reserveRoom();
    const invite = room.invites[0]!;
    const response = await postAction(room.roomCode, `${invite.seatToken}%E2%80%AE`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      data: { accepted: boolean; roomView: { me: { hasWatchedInvitation: boolean; playerName: string } } };
    };
    expect(body.ok).toBe(true);
    expect(body.data.accepted).toBe(true);
    expect(body.data.roomView.me.hasWatchedInvitation).toBe(true);
    expect(body.data.roomView.me.playerName).toBe(PLAYER_NAMES[0]);
  });

  it('توکن دوبار encode شده (کپی از پیام‌رسان) هم پذیرفته می‌شود', async () => {
    const room = await reserveRoom();
    const invite = room.invites[1]!;
    const response = await postAction(room.roomCode, encodeURIComponent(`${invite.seatToken}%20`));
    expect(response.status).toBe(200);
  });

  it('اکشن با توکن آلوده به نویسهٔ پنهان در لایهٔ سرویس هم صندلی درست را پیدا می‌کند', async () => {
    const room = await reserveRoom();
    const invite = room.invites[2]!;
    const outcome = await performGameAction(
      room.roomCode,
      `${invite.seatToken}\u202E\u200E`,
      { type: 'COMPLETE_INVITATION_VIDEO' },
    );
    expect(outcome.accepted).toBe(true);
    expect(outcome.roomView.me.seatIndex).toBe(2);
  });

  it('استریم SSE با توکن دوبار encode شده در ?token= هم ۴۰۱ نمی‌دهد', async () => {
    const room = await reserveRoom();
    const invite = room.invites[0]!;
    const { GET } = await import('../../src/app/api/rooms/[code]/stream/route');
    const token = encodeURIComponent(`${invite.seatToken}%E2%80%AE`);
    const response = await GET(
      new Request(`http://localhost/api/rooms/${room.roomCode}/stream?token=${token}`),
      { params: Promise.resolve({ code: room.roomCode }) },
    );
    expect(response.status).toBe(200);
    await response.body?.cancel();
  });

  it('توکن خالی همچنان ۴۰۱ «ارسال نشده» می‌گیرد', async () => {
    const room = await reserveRoom();
    const response = await postAction(room.roomCode, '');
    expect(response.status).toBe(401);
    const body = (await response.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.error.code).toBe('INVALID_SEAT_TOKEN');
    expect(body.error.message).toContain('ارسال نشده');
  });
});

describe('پیام ۴۰۱ برای بازیکن — به‌جای «توکن معتبر نیست» مبهم', () => {
  it('لینک ناقص/بریده را با راهنمای کپی دوباره گزارش می‌کند', async () => {
    const room = await reserveRoom();
    const response = await postAction(room.roomCode, 'mFoKqDmqPnLSRv'); // توکن بریده‌شده هنگام کپی
    expect(response.status).toBe(401);
    const body = (await response.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.error.code).toBe('INVALID_SEAT_TOKEN');
    expect(body.error.message).toContain('کامل');
    expect(body.error.message).toContain('میزبان');
  });

  it('توکن سالم اما بیگانه با اتاق را با راهنمای گرفتن لینک تازه گزارش می‌کند', async () => {
    const room = await reserveRoom();
    const other = await reserveRoom();
    const foreignToken = other.invites[0]!.seatToken;
    expect(isWellFormedSeatToken(foreignToken)).toBe(true);
    const response = await postAction(room.roomCode, foreignToken);
    expect(response.status).toBe(401);
    const body = (await response.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.error.message).toContain('لینک');
    expect(body.error.message).not.toBe('توکن صندلی معتبر نیست.');
  });

  it('صندلی باطل‌شده (اخراج از پنل ادمین) پیام مشخص خودش را دارد', async () => {
    const room = await reserveRoom();
    const invite = room.invites[1]!;
    const repo = getRoomRepository();
    expect(await repo.deleteSeat(room.roomCode, invite.seatIndex)).toBe(true);

    const response = await postAction(room.roomCode, invite.seatToken);
    expect(response.status).toBe(401);
    const body = (await response.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.error.code).toBe('INVALID_SEAT_TOKEN');
    expect(body.error.message).toContain('باطل');

    // صندلی‌های دیگر همان اتاق سالم می‌مانند
    const healthy = await postAction(room.roomCode, room.invites[0]!.seatToken);
    expect(healthy.status).toBe(200);
  });
});
