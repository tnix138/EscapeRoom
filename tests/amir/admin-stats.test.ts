// تست فاز ۱۰ — داشبورد آمار: هم‌خوانی با دیتابیس، لیست اتاق‌ها و بازیکنان، خطاها
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scryptSync } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-admin-stats-'));
process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'stats.db');

import { GET as statsRoute } from '../../src/app/api/admin/stats/route';
import { GET as roomsRoute } from '../../src/app/api/admin/rooms/route';
import { GET as playersRoute } from '../../src/app/api/admin/players/route';
import { GET as errorsRoute } from '../../src/app/api/admin/errors/route';
import { POST as loginRoute } from '../../src/app/api/admin/login/route';
import { createAdminEvent, type AdminStatsView, type AdminPlayerView, type RoomSummary } from '../../src/contracts/admin';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { getRoomRepository } from '../../src/server/db/repository';
import { getRoomViewForSeat, reserveRoom } from '../../src/server/services/room-service';

const ADMIN_USERNAME = 'amir-admin';
const ADMIN_PASSWORD = 'ramz-e-panel-1234';
const ADMIN_SECRET = 'stats-session-secret-value';

function hashPassword(password: string): string {
  const salt = 'feedfacecafebeef';
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

let cookie = '';

beforeAll(async () => {
  process.env.ADMIN_USERNAME = ADMIN_USERNAME;
  process.env.ADMIN_PASSWORD_HASH = hashPassword(ADMIN_PASSWORD);
  process.env.ADMIN_SESSION_SECRET = ADMIN_SECRET;
});

beforeEach(async () => {
  resetRateLimits();
  const res = await loginRoute(
    new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.10' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    }),
  );
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
});

function authed(url: string): Request {
  return new Request(url, { headers: { cookie } });
}

interface ListBody<T> {
  ok: boolean;
  data: T;
  error?: { code: string; message: string };
}

describe('فاز ۱۰ — داشبورد آمار', () => {
  it('آمار با جدول اتاق‌ها هم‌خوان است', async () => {
    const repo = getRoomRepository();
    const before = await repo.listRooms(500);
    const reservation = await reserveRoom({
      playerCount: 3,
      playerNames: ['امیر الف', 'امیرعلی ب', 'نازنین ج'],
    });

    const res = await statsRoute(authed('http://localhost/api/admin/stats'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody<AdminStatsView>;

    const all = await repo.listRooms(500);
    expect(body.data.rooms).toBe(all.length);
    expect(body.data.rooms).toBe(before.length + 1);
    expect(body.data.players).toBeGreaterThanOrEqual(0);
    expect(body.data.phases.alley_puzzle).toBeGreaterThanOrEqual(1);
    expect(body.data.serverNow).toBeGreaterThan(0);
    expect(reservation.roomCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('رویدادها و نرخ خطا از admin_events خوانده می‌شوند', async () => {
    const repo = getRoomRepository();
    const base = await statsRoute(authed('http://localhost/api/admin/stats'));
    const baseStats = ((await base.json()) as ListBody<AdminStatsView>).data;

    await repo.recordAdminEvent(
      createAdminEvent({ type: 'room_created', roomCode: 'ABC123', id: 'st-1' }),
    );
    await repo.recordAdminEvent(
      createAdminEvent({
        type: 'error',
        roomCode: 'ABC123',
        payload: { code: 'INTERNAL_ERROR', message: 'خطای آزمایشی' },
        id: 'st-2',
      }),
    );

    const res = await statsRoute(authed('http://localhost/api/admin/stats'));
    const stats = ((await res.json()) as ListBody<AdminStatsView>).data;
    expect(stats.events).toBe(baseStats.events + 2);
    expect(stats.errors).toBe(baseStats.errors + 1);
    expect(stats.errorRate).toBeGreaterThan(0);
    expect(stats.errorRate).toBeLessThanOrEqual(1);
  });

  it('لیست اتاق‌ها خلاصهٔ امن می‌دهد و هیچ توکنی ندارد', async () => {
    const reservation = await reserveRoom({
      playerCount: 3,
      playerNames: ['اتاق الف', 'اتاق ب', 'اتاق ج'],
    });

    const res = await roomsRoute(authed('http://localhost/api/admin/rooms'));
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain('seatToken');
    expect(raw).not.toContain('seatTokenHash');

    const body = JSON.parse(raw) as ListBody<{ rooms: RoomSummary[] }>;
    const room = body.data.rooms.find((item) => item.code === reservation.roomCode);
    expect(room).toMatchObject({ code: reservation.roomCode, phase: 'alley_puzzle' });
    expect(room?.version).toBeGreaterThanOrEqual(1);
  });

  it('بازیکنان آنلاین پس از ورود به اتاق در لیست دیده می‌شوند', async () => {
    const reservation = await reserveRoom({
      playerCount: 3,
      playerNames: ['بازیکن یک', 'بازیکن دو', 'بازیکن سه'],
    });
    const firstToken = reservation.invites[0]?.seatToken as string;
    await getRoomViewForSeat(reservation.roomCode, firstToken);

    const res = await playersRoute(authed('http://localhost/api/admin/players'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody<{ players: AdminPlayerView[] }>;
    const player = body.data.players.find(
      (item) => item.roomCode === reservation.roomCode && item.playerName === 'بازیکن یک',
    );
    expect(player).toMatchObject({ seatIndex: 0, isOnline: true });
    expect(player?.lastSeenAt).toBeGreaterThan(0);
  });

  it('لیست خطاها فقط رویدادهای error را برمی‌گرداند', async () => {
    const repo = getRoomRepository();
    await repo.recordAdminEvent(
      createAdminEvent({
        type: 'error',
        roomCode: 'ERR999',
        payload: { code: 'CONFLICT_RETRY_EXHAUSTED', message: 'تداخل ذخیره' },
        id: 'err-1',
      }),
    );
    await repo.recordAdminEvent(
      createAdminEvent({ type: 'chat_message', roomCode: 'ERR999', id: 'chat-1' }),
    );

    const res = await errorsRoute(authed('http://localhost/api/admin/errors?limit=50'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody<{
      errors: Array<{
        id: string;
        type: string;
        roomCode: string | null;
        payload: Record<string, unknown>;
      }>;
    }>;
    expect(body.data.errors.every((event) => event.type === 'error')).toBe(true);
    const target = body.data.errors.find((event) => event.id === 'err-1');
    expect(target).toMatchObject({ type: 'error', roomCode: 'ERR999' });
    expect(target?.payload.code).toBe('CONFLICT_RETRY_EXHAUSTED');
    expect(body.data.errors.some((event) => event.id === 'chat-1')).toBe(false);
  });

  it('limit نامعتبر در لیست خطاها ۴۰۰ می‌گیرد', async () => {
    const res = await errorsRoute(authed('http://localhost/api/admin/errors?limit=0'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');

    const tooBig = await errorsRoute(authed('http://localhost/api/admin/errors?limit=5000'));
    expect(tooBig.status).toBe(400);
  });

  it('بدون نشست ادمین، همهٔ endpointهای آمار ۴۰۱ می‌دهند', async () => {
    const urls = [
      'http://localhost/api/admin/stats',
      'http://localhost/api/admin/rooms',
      'http://localhost/api/admin/players',
      'http://localhost/api/admin/errors',
    ];
    const routes = [statsRoute, roomsRoute, playersRoute, errorsRoute];
    for (const [index, route] of routes.entries()) {
      const res = await route(new Request(urls[index] as string));
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('UNAUTHORIZED');
    }
  });
});
