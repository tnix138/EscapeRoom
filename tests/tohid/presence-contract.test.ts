// تست فاز ۰۳ — قرارداد حضور: آخرین snapshot، انقضای ۳۰ ثانیه، سقف ۵۰ درخواست در ثانیه
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ALLEY_PRESENCE_BOUNDS,
  PRESENCE_TTL_MS,
  THEATER_PRESENCE_BOUNDS,
  normalizeYaw,
  presenceBoundsForPhase,
} from '../../src/contracts/presence';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { createPresenceCoalescer, type PresenceScheduler } from '../../src/server/presence/presence-coalescer';
import {
  getRoomPresence,
  presenceListenerCount,
  resetPresenceStore,
  subscribePresence,
} from '../../src/server/presence/presence-store';
import { getSeatPresence, submitSeatPresence } from '../../src/server/presence/presence-service';
import {
  GameServiceError,
  loadRoom,
  reserveRoom,
} from '../../src/server/services/room-service';
import type { PresenceEntry } from '../../src/contracts/presence';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-presence-'));
const START = 1_700_000_000_000;

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

let roomCounter = 0;

async function setupRoom() {
  const repo = new SqliteRoomRepository(path.join(tmpDir, `presence-${roomCounter++}.db`));
  const reservation = await reserveRoom(
    { playerCount: 3, playerNames: ['توحید الف', 'علیرضا ب', 'امیرعلی ج'] },
    repo,
    START,
  );
  const tokens = reservation.invites.map((invite) => invite.seatToken);
  const state = await loadRoom(reservation.roomCode, repo);
  return { repo, code: reservation.roomCode, tokens, state };
}

const validBody = (overrides: Record<string, unknown> = {}) => ({
  position: { x: 1, y: 1.65, z: 4 },
  yaw: 0.4,
  phase: 'alley_puzzle',
  ...overrides,
});

async function catchServiceError(promise: Promise<unknown>): Promise<GameServiceError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof GameServiceError) return err;
    throw err;
  }
  throw new Error('انتظار خطای سرویس می‌رفت ولی درخواست موفق شد.');
}

beforeEach(() => {
  resetRateLimits();
  resetPresenceStore();
});

describe('فاز ۰۳ — snapshot حضور معتبر', () => {
  it('snapshot معتبر را می‌پذیرد و هویت را از صندلی احرازشده می‌گیرد', async () => {
    const { repo, code, tokens, state } = await setupRoom();

    const result = await submitSeatPresence(
      { roomCode: code, seatToken: tokens[0] as string, repo, now: START + 1_000 },
      validBody({
        // تلاش برای جعل هویت هم‌تیمی؛ سرور باید نادیده بگیرد
        playerId: 'hacker-id',
        seatIndex: 2,
        lastUpdate: START + 900,
      }),
    );

    expect(result.entry.seatIndex).toBe(0);
    expect(result.entry.playerId).toBe(state?.seats[0]?.playerId);
    expect(result.entry.playerName).toBe('توحید الف');
    expect(result.entry.position).toEqual({ x: 1, y: 1.65, z: 4 });
    expect(result.entry.receivedAt).toBe(START + 1_000);
    expect(result.entry.lastUpdate).toBe(START + 900);
    expect(result.presences).toHaveLength(1);
  });

  it('فقط آخرین snapshot هر صندلی را نگه می‌دارد (بدون تاریخچه)', async () => {
    const { repo, code, tokens } = await setupRoom();

    await submitSeatPresence({ roomCode: code, seatToken: tokens[0] as string, repo, now: START }, validBody());
    await submitSeatPresence(
      { roomCode: code, seatToken: tokens[0] as string, repo, now: START + 100 },
      validBody({ position: { x: -2, y: 1.65, z: -6 }, yaw: 2 }),
    );

    const presences = getRoomPresence(code, START + 150);
    expect(presences).toHaveLength(1);
    expect(presences[0]?.position).toEqual({ x: -2, y: 1.65, z: -6 });
    expect(presences[0]?.receivedAt).toBe(START + 100);
  });

  it('هر دو هم‌تیمی را با شناسه و نام جدا برمی‌گرداند', async () => {
    const { repo, code, tokens } = await setupRoom();

    await submitSeatPresence({ roomCode: code, seatToken: tokens[0] as string, repo, now: START }, validBody());
    await submitSeatPresence(
      { roomCode: code, seatToken: tokens[1] as string, repo, now: START + 50 },
      validBody({ position: { x: 3, y: 1.65, z: 1 } }),
    );

    const presences = getRoomPresence(code, START + 60);
    expect(presences.map((entry) => entry.seatIndex)).toEqual([0, 1]);
    expect(presences.map((entry) => entry.playerName)).toEqual(['توحید الف', 'علیرضا ب']);

    const forSeat0 = await getSeatPresence({
      roomCode: code,
      seatToken: tokens[0] as string,
      repo,
      now: START + 70,
    });
    expect(forSeat0.presences).toHaveLength(2);
  });

  it('زاویهٔ دید را در بازهٔ [-π, π) نرمال می‌کند', async () => {
    const { repo, code, tokens } = await setupRoom();
    const result = await submitSeatPresence(
      { roomCode: code, seatToken: tokens[0] as string, repo, now: START },
      validBody({ yaw: Math.PI * 3 }),
    );
    expect(result.entry.yaw).toBeCloseTo(-Math.PI, 6);
    expect(normalizeYaw(Math.PI * 2.5)).toBeCloseTo(Math.PI / 2, 6);
    expect(normalizeYaw(0)).toBe(0);
  });
});

describe('فاز ۰۳ — رد کردن snapshot نامعتبر', () => {
  it('موقعیت خارج از محدودهٔ کوچه را با پیام فارسی رد می‌کند', async () => {
    const { repo, code, tokens } = await setupRoom();
    const err = await catchServiceError(
      submitSeatPresence(
        { roomCode: code, seatToken: tokens[0] as string, repo, now: START },
        validBody({ position: { x: 999, y: 1.65, z: 0 } }),
      ),
    );
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(400);
    expect(err.message).toContain('خارج از محدودهٔ جهان');

    // زیر زمین (y منفی) و آن‌سوی دیوار (z دورتر از عمق کوچه) هم رد می‌شوند
    await expect(
      submitSeatPresence(
        { roomCode: code, seatToken: tokens[0] as string, repo, now: START },
        validBody({ position: { x: 0, y: -2, z: 0 } }),
      ),
    ).rejects.toBeInstanceOf(GameServiceError);
    await expect(
      submitSeatPresence(
        { roomCode: code, seatToken: tokens[0] as string, repo, now: START },
        validBody({ position: { x: 0, y: 1.65, z: 40 } }),
      ),
    ).rejects.toBeInstanceOf(GameServiceError);
  });

  it('مختصات غیرعددی، NaN و بدنهٔ خالی را رد می‌کند و هیچ snapshot ذخیره نمی‌شود', async () => {
    const { repo, code, tokens } = await setupRoom();

    await expect(
      submitSeatPresence(
        { roomCode: code, seatToken: tokens[0] as string, repo, now: START },
        validBody({ position: { x: Number.NaN, y: 1.65, z: 0 } }),
      ),
    ).rejects.toThrow();
    await expect(
      submitSeatPresence(
        { roomCode: code, seatToken: tokens[0] as string, repo, now: START },
        validBody({ position: { x: 'چپ', y: 1.65, z: 0 } }),
      ),
    ).rejects.toThrow();
    await expect(
      submitSeatPresence({ roomCode: code, seatToken: tokens[0] as string, repo, now: START }, null),
    ).rejects.toThrow();

    expect(getRoomPresence(code, START)).toHaveLength(0);
  });

  it('توکن صندلی نامعتبر و اتاق ناموجود را جدا تشخیص می‌دهد', async () => {
    const { repo, code } = await setupRoom();

    const badToken = await catchServiceError(
      submitSeatPresence({ roomCode: code, seatToken: 'x'.repeat(48), repo, now: START }, validBody()),
    );
    expect(badToken.code).toBe('INVALID_SEAT_TOKEN');
    expect(badToken.status).toBe(401);

    const missingRoom = await catchServiceError(
      submitSeatPresence(
        { roomCode: 'ZZZZZZ', seatToken: 'y'.repeat(48), repo, now: START },
        validBody(),
      ),
    );
    expect(missingRoom.code).toBe('ROOM_NOT_FOUND');
    expect(missingRoom.status).toBe(404);
  });
});

describe('فاز ۰۳ — انقضای ۳۰ ثانیه‌ای حضور', () => {
  it('snapshot قدیمی‌تر از ۳۰ ثانیه پاک می‌شود و هم‌تیمی آن را نمی‌بیند', async () => {
    const { repo, code, tokens } = await setupRoom();

    await submitSeatPresence({ roomCode: code, seatToken: tokens[0] as string, repo, now: START }, validBody());
    await submitSeatPresence(
      { roomCode: code, seatToken: tokens[1] as string, repo, now: START },
      validBody(),
    );

    // یکی از دونفر تازه‌سازی می‌کند؛ آن یکی که ساکت مانده باید بعد از ۳۰ ثانیه محو شود
    await submitSeatPresence(
      { roomCode: code, seatToken: tokens[0] as string, repo, now: START + 31_000 },
      validBody(),
    );

    const visible = getRoomPresence(code, START + 31_000);
    expect(visible.map((entry) => entry.seatIndex)).toEqual([0]);

    // دقیقاً روی مرز TTL هم منقضی حساب می‌شود
    expect(getRoomPresence(code, START + 61_000)).toHaveLength(0);
    expect(PRESENCE_TTL_MS).toBe(30_000);
  });

  it('حضور اتاق‌ها با هم قاطی نمی‌شود', async () => {
    const first = await setupRoom();
    const second = await setupRoom();

    await submitSeatPresence(
      { roomCode: first.code, seatToken: first.tokens[0] as string, repo: first.repo, now: START },
      validBody(),
    );

    expect(getRoomPresence(first.code, START)).toHaveLength(1);
    expect(getRoomPresence(second.code, START)).toHaveLength(0);
  });
});

describe('فاز ۰۳ — سقف ۵۰ درخواست در ثانیه', () => {
  it('۵۰ درخواست را قبول و درخواست پنجاه‌ویکم را با RATE_LIMITED رد می‌کند', async () => {
    const { repo, code, tokens } = await setupRoom();
    const seatToken = tokens[0] as string;

    for (let i = 0; i < 50; i++) {
      await submitSeatPresence(
        { roomCode: code, seatToken, repo, now: START + i },
        validBody({ position: { x: i / 10, y: 1.65, z: 0 } }),
      );
    }

    const limited = await catchServiceError(
      submitSeatPresence({ roomCode: code, seatToken, repo, now: START + 900 }, validBody()),
    );
    expect(limited.code).toBe('RATE_LIMITED');
    expect(limited.status).toBe(429);

    // صندلی دیگر همان اتاق مستقل است
    await expect(
      submitSeatPresence(
        { roomCode: code, seatToken: tokens[1] as string, repo, now: START + 900 },
        validBody(),
      ),
    ).resolves.toBeTruthy();

    // بعد از پنجرهٔ یک‌ثانیه‌ای سهمیه آزاد می‌شود
    await expect(
      submitSeatPresence({ roomCode: code, seatToken, repo, now: START + 1_500 }, validBody()),
    ).resolves.toBeTruthy();
  });
});

describe('فاز ۰۳ — انتشار بلادرنگ برای SSE', () => {
  it('هر ثبت، وضعیت کامل اتاق را برای شنونده منتشر می‌کند و با لغو اشتراک متوقف می‌شود', async () => {
    const { repo, code, tokens } = await setupRoom();
    const received: PresenceEntry[][] = [];
    expect(presenceListenerCount(code)).toBe(0);
    const unsubscribe = subscribePresence(code, (entries) => received.push(entries));
    expect(presenceListenerCount(code)).toBe(1);

    await submitSeatPresence({ roomCode: code, seatToken: tokens[0] as string, repo, now: START }, validBody());
    await submitSeatPresence(
      { roomCode: code, seatToken: tokens[1] as string, repo, now: START + 20 },
      validBody(),
    );

    expect(received).toHaveLength(2);
    expect(received[0]).toHaveLength(1);
    expect(received[1]).toHaveLength(2);

    unsubscribe();
    expect(presenceListenerCount(code)).toBe(0);
    await submitSeatPresence(
      { roomCode: code, seatToken: tokens[2] as string, repo, now: START + 40 },
      validBody(),
    );
    expect(received).toHaveLength(2);
  });

  it('هم‌جوشی، فرکانس ارسال را زیر فشار ۸ بازیکن محدود می‌کند', () => {
    const scheduled: Array<() => void> = [];
    const scheduler: PresenceScheduler = {
      schedule: (callback) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      cancel: () => {
        scheduled.pop();
      },
    };
    const emitted: PresenceEntry[][] = [];
    const coalescer = createPresenceCoalescer((entries) => emitted.push([...entries]), {
      flushMs: 50,
      scheduler,
    });

    const entry = (seatIndex: number): PresenceEntry => ({
      playerId: `p${seatIndex}`,
      playerName: `بازیکن ${seatIndex}`,
      seatIndex,
      position: { x: 0, y: 1.65, z: 0 },
      yaw: 0,
      phase: 'alley_puzzle',
      lastUpdate: START,
      receivedAt: START,
    });

    for (let i = 0; i < 8; i++) coalescer.push([entry(i)]);
    expect(scheduled).toHaveLength(1);
    expect(emitted).toHaveLength(0);

    scheduled.shift()?.();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toHaveLength(1);

    coalescer.dispose();
    coalescer.push([entry(0)]);
    coalescer.dispose();
    expect(emitted).toHaveLength(1);
  });
});

describe('فاز ۰۳ — محدوده‌های جهان', () => {
  it('هر فاز محدودهٔ خودش را دارد و کوچه با هندسهٔ سه‌بعدی هم‌خوان است', () => {
    expect(presenceBoundsForPhase('alley_puzzle')).toEqual(ALLEY_PRESENCE_BOUNDS);
    expect(presenceBoundsForPhase('door_cutscene')).toEqual(ALLEY_PRESENCE_BOUNDS);
    expect(presenceBoundsForPhase('in_theater')).toEqual(THEATER_PRESENCE_BOUNDS);
    expect(ALLEY_PRESENCE_BOUNDS.minX).toBe(-9);
    expect(ALLEY_PRESENCE_BOUNDS.maxX).toBe(9);
    expect(ALLEY_PRESENCE_BOUNDS.minZ).toBe(-18);
    expect(ALLEY_PRESENCE_BOUNDS.maxZ).toBe(8);
  });

  it('در فاز سالن، مختصاتی که در کوچه رد می‌شد پذیرفته می‌شود', async () => {
    const { repo, code, tokens } = await setupRoom();
    await expect(
      submitSeatPresence(
        { roomCode: code, seatToken: tokens[0] as string, repo, now: START },
        validBody({ phase: 'alley_puzzle', position: { x: 12, y: 2, z: 0 } }),
      ),
    ).rejects.toBeInstanceOf(GameServiceError);

    await expect(
      submitSeatPresence(
        { roomCode: code, seatToken: tokens[0] as string, repo, now: START + 10 },
        validBody({ phase: 'in_theater', position: { x: 12, y: 2, z: 0 } }),
      ),
    ).resolves.toBeTruthy();
  });
});
