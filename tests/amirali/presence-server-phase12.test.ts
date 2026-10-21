import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  PRESENCE_MAX_PLAYERS,
  PRESENCE_OFFLINE_TIMEOUT_MS,
  forgetPresence,
  getPresence,
  isPresencePositionValid,
  listPresence,
  normalizePresenceYaw,
  presenceListenerCount,
  presenceSignature,
  publishPresence,
  resetPresenceStore,
  sanitizePresenceInput,
  subscribePresence,
} from '../../src/server/realtime/presence-tracker';
import {
  GameServiceError,
  reserveRoom,
} from '../../src/server/services/room-service';
import {
  getSeatPresences,
  publishSeatPresence,
} from '../../src/server/services/presence-service';

/**
 * فاز ۰۳ / ۱۲ — سرور حضور حرکتی (قرارداد #104)
 * -------------------------------------------------------------------------
 * این فایل همان چیزی را قفل می‌کند که HUD فاز ۱۲ انتظار دارد:
 *  - `POST /api/rooms/{code}/presence` با هویت از توکن و `yaw` رادیان
 *  - `GET  /api/rooms/{code}/presence` برای probe کلاینت
 *  - قاب `presence_update` = `{ presences, serverNow }` روی همان استریم
 *  - پاک‌سازی ۳۰ ثانیه‌ای، سقف ۳۲ نفر، رد موقعیت خارج از محدوده
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-presence-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const NOW = 1_792_610_264_622;

const identity = { playerId: 'p-seat-1', seatIndex: 0, playerName: 'امیرعلی' };

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    position: { x: 0, y: 1.65, z: -3 },
    yaw: Math.PI / 2,
    phase: 'alley_puzzle',
    ...overrides,
  };
}

beforeEach(() => {
  resetPresenceStore();
  resetRateLimits();
});

afterEach(() => {
  resetPresenceStore();
  resetRateLimits();
});

describe('فاز ۰۳ — اعتبارسنجی snapshot حضور', () => {
  it('snapshot معتبر با هویت سروری و yaw نرمال‌شده ساخته می‌شود', () => {
    const record = sanitizePresenceInput(validInput({ yaw: Math.PI * 2 + 0.5 }), identity, NOW);
    expect(record).not.toBeNull();
    expect(record).toEqual({
      playerId: 'p-seat-1',
      seatIndex: 0,
      playerName: 'امیرعلی',
      position: { x: 0, y: 1.65, z: -3 },
      yaw: expect.closeTo(0.5, 6),
      phase: 'alley_puzzle',
      updatedAt: NOW,
    });
    expect(record!.yaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(record!.yaw).toBeLessThan(Math.PI);
  });

  it('playerId و seatIndex داخل بدنه نادیده گرفته می‌شوند (ضد جعل هویت)', () => {
    const record = sanitizePresenceInput(
      validInput({ playerId: 'hacker', seatIndex: 7 }),
      identity,
      NOW,
    );
    expect(record?.playerId).toBe('p-seat-1');
    expect(record?.seatIndex).toBe(0);
  });

  it('موقعیت خارج از محدودهٔ کوچه رد می‌شود', () => {
    for (const bad of [
      { x: 100, y: 1.65, z: 0 },
      { x: 0, y: 1.65, z: -100 },
      { x: 0, y: -5, z: 0 },
      { x: 0, y: 50, z: 0 },
    ]) {
      expect(sanitizePresenceInput({ position: bad, yaw: 0 }, identity, NOW), JSON.stringify(bad)).toBeNull();
    }
    expect(isPresencePositionValid({ x: 9.5, y: 0, z: 8.5 })).toBe(true);
    expect(isPresencePositionValid({ x: 9.6, y: 1, z: 0 })).toBe(false);
  });

  it('مقدار غیرمتناهی، رشته یا بدنهٔ خراب رد می‌شود', () => {
    for (const bad of [
      null,
      undefined,
      'x',
      7,
      {},
      { position: null, yaw: 0 },
      { position: { x: Number.NaN, y: 1, z: 0 }, yaw: 0 },
      { position: { x: 0, y: 1, z: 0 }, yaw: Number.POSITIVE_INFINITY },
      { position: { x: '0', y: 1, z: 0 }, yaw: 0 },
      { yaw: 0 },
    ]) {
      expect(sanitizePresenceInput(bad, identity, NOW), JSON.stringify(bad)).toBeNull();
    }
  });

  it('yaw درست نرمال و مقدار نامعتبر صفر می‌شود', () => {
    expect(normalizePresenceYaw(0)).toBe(0);
    expect(normalizePresenceYaw(Math.PI)).toBeCloseTo(-Math.PI, 10);
    expect(normalizePresenceYaw(Math.PI * 2 + 0.25)).toBeCloseTo(0.25, 10);
    expect(normalizePresenceYaw(-Math.PI * 2 - 0.25)).toBeCloseTo(-0.25, 10);
    expect(normalizePresenceYaw(Number.NaN)).toBe(0);
  });

  it('فاز خالی به پیش‌فرض و فاز بلند بریده می‌شود', () => {
    expect(sanitizePresenceInput(validInput({ phase: '   ' }), identity, NOW)?.phase).toBe('alley_puzzle');
    expect(
      sanitizePresenceInput(validInput({ phase: 'x'.repeat(200) }), identity, NOW)?.phase.length,
    ).toBe(32);
  });
});

describe('فاز ۰۳ — انبار حافظه‌ای حضور', () => {
  it('چند بازیکن بر اساس صندلی مرتب برمی‌گردند', () => {
    publishPresence('ROOM01', sanitizePresenceInput(validInput(), { ...identity, seatIndex: 2, playerId: 'p3' }, NOW)!);
    publishPresence('ROOM01', sanitizePresenceInput(validInput(), { ...identity, seatIndex: 0, playerId: 'p1' }, NOW)!);
    const list = listPresence('ROOM01', NOW + 10);
    expect(list.map((entry) => entry.playerId)).toEqual(['p1', 'p3']);
    expect(list[0]).toMatchObject({ playerName: 'امیرعلی', lastUpdate: NOW, phase: 'alley_puzzle' });
  });

  it('بازیکن بی‌خبر بیش از ۳۰ ثانیه حذف می‌شود، نه ۲۹ ثانیه', () => {
    publishPresence('ROOM02', sanitizePresenceInput(validInput(), identity, NOW)!);
    expect(listPresence('ROOM02', NOW + PRESENCE_OFFLINE_TIMEOUT_MS - 1)).toHaveLength(1);
    expect(listPresence('ROOM02', NOW + PRESENCE_OFFLINE_TIMEOUT_MS + 1)).toHaveLength(0);
    expect(getPresence('ROOM02', identity.playerId)).toBeNull();
  });

  it('سقف ۳۲ نفر رعایت می‌شود و قدیمی‌ترین جای خود را می‌دهد', () => {
    for (let index = 0; index < PRESENCE_MAX_PLAYERS + 5; index += 1) {
      const record = sanitizePresenceInput(
        validInput(),
        { playerId: `p${index}`, seatIndex: index, playerName: null },
        NOW + index,
      );
      publishPresence('ROOM03', record!);
    }
    const list = listPresence('ROOM03', NOW + 100);
    expect(list).toHaveLength(PRESENCE_MAX_PLAYERS);
    // پنج نفر اول (قدیمی‌ترین‌ها) جای خود را داده‌اند.
    expect(list.some((entry) => entry.playerId === 'p0')).toBe(false);
    expect(list.some((entry) => entry.playerId === 'p36')).toBe(true);
  });

  it('خروج بازیکن از اتاق حذفش می‌کند', () => {
    publishPresence('ROOM04', sanitizePresenceInput(validInput(), identity, NOW)!);
    forgetPresence('ROOM04', identity.playerId);
    expect(listPresence('ROOM04', NOW)).toHaveLength(0);
    forgetPresence('ROOM04', 'ناموجود');
  });

  it('شنونده‌ها با هر انتشار بیدار می‌شوند و لغو اشتراک کار می‌کند', () => {
    let calls = 0;
    const unsubscribe = subscribePresence('ROOM05', () => {
      calls += 1;
    });
    expect(presenceListenerCount('ROOM05')).toBe(1);
    publishPresence('ROOM05', sanitizePresenceInput(validInput(), identity, NOW)!);
    publishPresence('ROOM05', sanitizePresenceInput(validInput(), identity, NOW + 100)!);
    expect(calls).toBe(2);
    unsubscribe();
    unsubscribe(); // لغو دوباره نباید خطا بدهد
    expect(presenceListenerCount('ROOM05')).toBe(0);
    publishPresence('ROOM05', sanitizePresenceInput(validInput(), identity, NOW + 200)!);
    expect(calls).toBe(2);
  });

  it('امضای قاب با حرکت عوض می‌شود و برای فهرست خالی خالی است', () => {
    const first = listPresence('ROOM06', NOW);
    expect(presenceSignature(first)).toBe('');
    publishPresence('ROOM06', sanitizePresenceInput(validInput(), identity, NOW)!);
    const before = presenceSignature(listPresence('ROOM06', NOW));
    publishPresence(
      'ROOM06',
      sanitizePresenceInput(validInput({ position: { x: 1, y: 1.65, z: -3 } }), identity, NOW + 100)!,
    );
    const after = presenceSignature(listPresence('ROOM06', NOW + 100));
    expect(before).not.toBe(after);
    expect(after).toContain('p-seat-1');
  });
});

describe('فاز ۰۳ — سرویس با توکن صندلی (SQLite موقت)', () => {
  async function setup() {
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'presence.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['امیرعلی', 'هم‌تیمی', 'سوم'] },
      repo,
      NOW,
    );
    return { repo, reservation };
  }

  it('ثبت با توکن معتبر، نام و صندلی را از سرور می‌آورد', async () => {
    const { repo, reservation } = await setup();
    const seatToken = reservation.invites[0]!.seatToken;
    const frame = await publishSeatPresence(
      reservation.roomCode,
      seatToken,
      validInput(),
      repo,
      NOW + 1_000,
    );
    expect(frame.serverNow).toBe(NOW + 1_000);
    expect(frame.presences).toHaveLength(1);
    expect(frame.presences[0]).toMatchObject({
      playerName: 'امیرعلی',
      seatIndex: 0,
      position: { x: 0, y: 1.65, z: -3 },
      lastUpdate: NOW + 1_000,
    });
    expect(frame.presences[0]!.yaw).toBeCloseTo(Math.PI / 2, 6);
  });

  it('توکن نامعتبر ۴۰۱ و اتاق ناموجود ۴۰۴ می‌گیرد', async () => {
    const { repo, reservation } = await setup();
    await expect(
      publishSeatPresence(reservation.roomCode, 'x'.repeat(48), validInput(), repo, NOW),
    ).rejects.toMatchObject({ code: 'INVALID_SEAT_TOKEN', status: 401 });

    await expect(
      publishSeatPresence('ZZZZZZ', reservation.invites[0]!.seatToken, validInput(), repo, NOW),
    ).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND', status: 404 });

    await expect(
      publishSeatPresence(reservation.roomCode, '', validInput(), repo, NOW),
    ).rejects.toBeInstanceOf(GameServiceError);
  });

  it('بدنهٔ خراب یا موقعیت خارج از محدوده ۴۰۰ می‌گیرد و چیزی ذخیره نمی‌کند', async () => {
    const { repo, reservation } = await setup();
    const seatToken = reservation.invites[0]!.seatToken;
    for (const bad of [null, {}, { position: { x: 'a', y: 1, z: 2 }, yaw: 0 }, validInput({ yaw: 'x' })]) {
      await expect(
        publishSeatPresence(reservation.roomCode, seatToken, bad, repo, NOW),
      ).rejects.toMatchObject({ status: 400 });
    }
    await expect(
      publishSeatPresence(
        reservation.roomCode,
        seatToken,
        validInput({ position: { x: 500, y: 1, z: 0 } }),
        repo,
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(listPresence(reservation.roomCode, NOW)).toHaveLength(0);
  });

  it('GET فهرست را برای probe کلاینت برمی‌گرداند', async () => {
    const { repo, reservation } = await setup();
    const seatToken = reservation.invites[0]!.seatToken;
    const empty = await getSeatPresences(reservation.roomCode, seatToken, repo, NOW);
    expect(empty).toEqual({ presences: [], serverNow: NOW });
    await publishSeatPresence(reservation.roomCode, seatToken, validInput(), repo, NOW + 5);
    const frame = await getSeatPresences(reservation.roomCode, seatToken, repo, NOW + 10);
    expect(frame.presences).toHaveLength(1);
  });

  it('ارسال پشت‌سرهم بیش از سقف، ۴۲۹ می‌گیرد (ضد سیل)', async () => {
    const { repo, reservation } = await setup();
    const seatToken = reservation.invites[0]!.seatToken;
    let limited = false;
    for (let index = 0; index < 55; index += 1) {
      try {
        await publishSeatPresence(reservation.roomCode, seatToken, validInput(), repo, NOW);
      } catch (err) {
        limited = (err as GameServiceError).status === 429;
        break;
      }
    }
    expect(limited).toBe(true);
  });

  it('هر صندلی فقط خودش را می‌بیند؛ دو صندلی دو ورودی می‌سازند', async () => {
    const { repo, reservation } = await setup();
    const [seatA, seatB] = reservation.invites;
    await publishSeatPresence(reservation.roomCode, seatA!.seatToken, validInput(), repo, NOW + 10);
    await publishSeatPresence(
      reservation.roomCode,
      seatB!.seatToken,
      validInput({ position: { x: 3, y: 1.6, z: -8 }, yaw: -1 }),
      repo,
      NOW + 20,
    );
    const frame = await getSeatPresences(reservation.roomCode, seatA!.seatToken, repo, NOW + 30);
    expect(frame.presences.map((entry) => entry.seatIndex)).toEqual([0, 1]);
    expect(frame.presences[1]!.position).toEqual({ x: 3, y: 1.6, z: -8 });
  });
});

describe('فاز ۰۳ — اتصال به استریم SSE', () => {
  const streamSource = read('../../src/app/api/rooms/[code]/stream/route.ts');
  const routeSource = read('../../src/app/api/rooms/[code]/presence/route.ts');

  it('استریم قاب presence_update با serverNow می‌فرستد', () => {
    expect(streamSource).toContain("send('presence_update', { presences, serverNow })");
    expect(streamSource).toContain('subscribePresence(code');
    expect(streamSource).toContain('flushPresence(true)');
    expect(streamSource).toContain('PRESENCE_BROADCAST_MS');
  });

  it('اشتراک حضور در پایان استریم آزاد می‌شود (بدون نشتی شنونده)', () => {
    expect(streamSource).toContain('if (unsubscribePresence) unsubscribePresence();');
    const occurrences = streamSource.split('unsubscribePresence()').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2); // هم abort و هم cancel
  });

  it('مسیر حضور فقط GET و POST دارد و هویت را از هدر می‌خواند', () => {
    expect(routeSource).toContain('export async function GET');
    expect(routeSource).toContain('export async function POST');
    expect(routeSource).toContain("req.headers.get('x-seat-token')");
    expect(routeSource).not.toContain('body.playerId');
    expect(routeSource).not.toContain('body?.playerId');
  });
});
