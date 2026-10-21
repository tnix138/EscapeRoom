// تست فاز ۱۳ — ابزارهای مدیریتی: حذف بازیکن، باطل شدن توکن و ثبت رویداد
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scryptSync } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-admin-players-'));
process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'players.db');

import { GET as playersRoute } from '../../src/app/api/admin/players/route';
import { DELETE as deletePlayerRoute } from '../../src/app/api/admin/players/[id]/route';
import { POST as loginRoute } from '../../src/app/api/admin/login/route';
import type { AdminPlayerView } from '../../src/contracts/admin';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { getRoomRepository } from '../../src/server/db/repository';
import { getRoomViewForSeat, reserveRoom } from '../../src/server/services/room-service';
import { playersOfRooms } from '../../src/server/admin/queries';

const ADMIN_USERNAME = 'amir-moderator';
const ADMIN_PASSWORD = 'ramz-e-moderation-9';
const ADMIN_SECRET = 'players-session-secret-value';

function hashPassword(password: string, salt = 'cafebabe00112233'): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

beforeAll(() => {
  process.env.ADMIN_USERNAME = ADMIN_USERNAME;
  process.env.ADMIN_PASSWORD_HASH = hashPassword(ADMIN_PASSWORD);
  process.env.ADMIN_SESSION_SECRET = ADMIN_SECRET;
});

let cookie = '';

beforeEach(async () => {
  resetRateLimits();
  delete process.env.ADMIN_ROLE;
  const res = await loginRoute(
    new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.18.0.5' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    }),
  );
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
});

function authed(url: string, method = 'GET'): Request {
  return new Request(url, { method, headers: { cookie } });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

interface ListBody<T> {
  ok: boolean;
  data: T;
  error?: { code: string; message: string };
}

async function setupRoom(names: string[]) {
  const reservation = await reserveRoom({ playerCount: names.length, playerNames: names });
  for (const invite of reservation.invites) {
    await getRoomViewForSeat(reservation.roomCode, invite.seatToken);
  }
  return reservation;
}

describe('فاز ۱۳ — حذف بازیکن', () => {
  it('بازیکن را حذف می‌کند، صندلی آزاد می‌شود و توکنش باطل می‌گردد', async () => {
    const reservation = await setupRoom(['ناظر الف', 'بازیکن بدرفتار', 'تماشاگر ج']);
    const target = reservation.invites[1]!;

    const listBefore = await playersRoute(authed('http://localhost/api/admin/players'));
    const before = (await listBefore.json()) as ListBody<{ players: AdminPlayerView[] }>;
    const player = before.data.players.find(
      (item) => item.roomCode === reservation.roomCode && item.seatIndex === 1,
    );
    expect(player?.playerName).toBe('بازیکن بدرفتار');
    expect(player?.playerId).toBeTruthy();
    expect(player?.seatLabel).toBeTruthy();

    const res = await deletePlayerRoute(
      authed(
        `http://localhost/api/admin/players/${encodeURIComponent(player!.playerId)}`,
        'DELETE',
      ),
      params(player!.playerId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody<{ removed: boolean; roomCode: string; seatIndex: number }>;
    expect(body.data).toMatchObject({
      removed: true,
      roomCode: reservation.roomCode,
      seatIndex: 1,
    });

    // توکن صندلی حذف‌شده دیگر کار نمی‌کند
    await expect(getRoomViewForSeat(reservation.roomCode, target.seatToken)).rejects.toThrow();

    // صندلی آزاد شده و نام پیش‌فرض گرفته است
    const state = await getRoomRepository().getRoom(reservation.roomCode);
    expect(state?.seats[1]?.joined).toBe(false);
    expect(state?.seats[1]?.playerName).toBe('صندلی 2');
    expect(state?.seats[1]?.seatTokenHash).toBe('');

    // بقیهٔ بازیکنان دست‌نخورده‌اند
    const listAfter = await playersRoute(authed('http://localhost/api/admin/players'));
    const after = (await listAfter.json()) as ListBody<{ players: AdminPlayerView[] }>;
    expect(
      after.data.players.some(
        (item) => item.roomCode === reservation.roomCode && item.seatIndex === 1,
      ),
    ).toBe(false);
    expect(
      after.data.players.some(
        (item) => item.roomCode === reservation.roomCode && item.seatIndex === 0,
      ),
    ).toBe(true);
  });

  it('رویداد player_removed با نام ادمین در admin_events ثبت می‌شود', async () => {
    const reservation = await setupRoom(['یک الف', 'دو ب', 'سه ج']);
    const repo = getRoomRepository();
    const state = await repo.getRoom(reservation.roomCode);
    const playerId = state!.seats[2]!.playerId;

    const res = await deletePlayerRoute(
      authed(`http://localhost/api/admin/players/${playerId}`, 'DELETE'),
      params(playerId),
    );
    expect(res.status).toBe(200);

    const events = await repo.listAdminEvents({ type: 'player_removed', roomCode: reservation.roomCode });
    expect(events).toHaveLength(1);
    expect(events[0]?.playerId).toBe(playerId);
    expect(events[0]?.payload).toMatchObject({
      seatIndex: 2,
      playerName: 'سه ج',
      byAdmin: ADMIN_USERNAME,
    });
  });

  it('شناسهٔ ناشناس ۴۰۴ با کد قراردادی PLAYER_NOT_FOUND می‌دهد', async () => {
    const res = await deletePlayerRoute(
      authed('http://localhost/api/admin/players/seat-unknown', 'DELETE'),
      params('seat-unknown'),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('PLAYER_NOT_FOUND');
  });

  it('نقش viewer اجازهٔ حذف ندارد و ۴۰۳ می‌گیرد', async () => {
    process.env.ADMIN_ROLE = 'viewer';
    resetRateLimits();
    const login = await loginRoute(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.18.0.6' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
      }),
    );
    const viewerCookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const reservation = await setupRoom(['الف یک', 'ب دو', 'ج سه']);
    const state = await getRoomRepository().getRoom(reservation.roomCode);
    const playerId = state!.seats[0]!.playerId;

    const res = await deletePlayerRoute(
      new Request(`http://localhost/api/admin/players/${playerId}`, {
        method: 'DELETE',
        headers: { cookie: viewerCookie },
      }),
      params(playerId),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');

    // بازیکن حذف نشده است
    const after = await getRoomRepository().getRoom(reservation.roomCode);
    expect(after?.seats[0]?.joined).toBe(true);
  });

  it('بدون نشست، حذف بازیکن ۴۰۱ می‌گیرد', async () => {
    const res = await deletePlayerRoute(
      new Request('http://localhost/api/admin/players/seat-1', { method: 'DELETE' }),
      params('seat-1'),
    );
    expect(res.status).toBe(401);
  });
});

describe('فاز ۱۳ — لیست بازیکنان', () => {
  it('صندلی‌های آزاد در لیست نمی‌آیند', async () => {
    const reservation = await setupRoom(['فقط یک', 'فقط دو', 'فقط سه']);
    const repo = getRoomRepository();
    const state = await repo.getRoom(reservation.roomCode);

    const players = playersOfRooms(state ? [state] : []);
    expect(players).toHaveLength(3);
    expect(players.map((item) => item.seatIndex).sort()).toEqual([0, 1, 2]);

    // بعد از حذف یک صندلی، لیست یک نفر کمتر می‌شود
    await repo.deleteSeat(reservation.roomCode, 0);
    const after = await repo.getRoom(reservation.roomCode);
    expect(playersOfRooms(after ? [after] : [])).toHaveLength(2);
  });
});
