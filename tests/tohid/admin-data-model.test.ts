// تست مدل دادهٔ پنل ادمین (فاز ۱۰ و ۱۳) — SQLite، نمای امن، رویدادها و حذف بازیکن
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_SESSION_TTL_MS,
  canModerate,
  canView,
  createAdminEvent,
  createAdminSession,
  isAdminSessionExpired,
} from '../../src/contracts/admin';
import { buildAdminStats, summarizeRoom, summarizeRooms } from '../../src/server/admin/room-summary';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { ONLINE_WINDOW_MS } from '../../src/engine/view-projector';
import {
  findSeatIndexByToken,
  loadRoom,
  reserveRoom,
  touchSeatPresence,
} from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-admin-'));
const START = 1_700_300_000_000;
let counter = 0;

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

async function setup(count = 3) {
  const repo = new SqliteRoomRepository(path.join(tmpDir, `admin-${counter++}.db`));
  const names = Array.from({ length: count }, (_, i) => `بازیکن ${i + 1} الف`);
  const reservation = await reserveRoom({ playerCount: count, playerNames: names }, repo, START);
  return {
    repo,
    code: reservation.roomCode,
    tokens: reservation.invites.map((invite) => invite.seatToken),
  };
}

describe('ادمین — جلسهٔ قرارداد ۵', () => {
  it('جلسه را با عمر پیش‌فرض ۸ ساعت می‌سازد و انقضا را تشخیص می‌دهد', () => {
    const now = 1_700_000_000_000;
    const session = createAdminSession({ adminId: 'a1', username: 'tohid', role: 'superadmin', now });
    expect(session.expiresAt).toBe(now + ADMIN_SESSION_TTL_MS);
    expect(ADMIN_SESSION_TTL_MS).toBe(8 * 60 * 60 * 1_000);
    expect(isAdminSessionExpired(session, now + 1_000)).toBe(false);
    expect(isAdminSessionExpired(session, session.expiresAt)).toBe(true);
  });

  it('فقط superadmin و moderator اجازهٔ مدیریت دارند و نقش ناشناخته دسترسی ندارد', () => {
    expect(canModerate('superadmin')).toBe(true);
    expect(canModerate('moderator')).toBe(true);
    expect(canModerate('viewer')).toBe(false);
    expect(canView('viewer')).toBe(true);
    expect(canView('hacker')).toBe(false);
  });
});

describe('ادمین — خلاصهٔ اتاق', () => {
  it('صندلی‌های پر و آنلاین را جدا می‌شمارد و هیچ دادهٔ حساسی ندارد', async () => {
    const { repo, code, tokens } = await setup(4);

    // دو بازیکن وارد می‌شوند و یکی تازه‌سازی حضور می‌کند
    await touchSeatPresence(code, tokens[0] as string, repo, START + 1_000);
    await touchSeatPresence(code, tokens[1] as string, repo, START + 1_000);

    const state = await loadRoom(code, repo);
    const summary = summarizeRoom(state!, START + 2_000);

    expect(summary.code).toBe(code);
    expect(summary.playerCount).toBe(4);
    expect(summary.occupiedSeats).toBe(2);
    expect(summary.onlineCount).toBe(2);
    expect(summary.phase).toBe('alley_puzzle');
    expect(summary.hasAuditoriumRestart).toBe(false);
    // هیچ توکن یا کد دری در نما نیست
    expect(JSON.stringify(summary)).not.toContain('seatToken');
    expect(Object.keys(summary)).not.toContain('seats');
    expect(Object.keys(summary)).not.toContain('targets');
  });

  it('بعد از پایان پنجرهٔ آنلاین، بازیکن آفلاین شمرده می‌شود', async () => {
    const { repo, code, tokens } = await setup(3);
    await touchSeatPresence(code, tokens[0] as string, repo, START + 1_000);
    const state = await loadRoom(code, repo);

    expect(summarizeRoom(state!, START + 2_000).onlineCount).toBe(1);
    expect(summarizeRoom(state!, START + 1_000 + ONLINE_WINDOW_MS + 1).onlineCount).toBe(0);
  });

  it('اتاق‌ها را جدیدترین‌اول مرتب و محدود می‌کند', async () => {
    // هر دو اتاق در یک دیتابیس، مثل پروداکشن
    const repo = new SqliteRoomRepository(path.join(tmpDir, `multi-${counter++}.db`));
    const first = await reserveRoom(
      { playerCount: 3, playerNames: ['الف اول', 'ب اول', 'ج اول'] },
      repo,
      START,
    );
    const second = await reserveRoom(
      { playerCount: 3, playerNames: ['الف دوم', 'ب دوم', 'ج دوم'] },
      repo,
      START + 1_000,
    );
    await touchSeatPresence(
      second.roomCode,
      second.invites[0]?.seatToken as string,
      repo,
      START + 5_000,
    );

    const rooms = await repo.listRooms(10);
    expect(rooms.length).toBe(2);

    const limited = summarizeRooms(rooms, START + 6_000, 1);
    expect(limited).toHaveLength(1);
    expect(limited[0]?.code).toBe(second.roomCode);

    const sorted = summarizeRooms(rooms, START + 6_000, 10);
    expect(sorted[0]?.updatedAt).toBeGreaterThanOrEqual(sorted[1]?.updatedAt ?? 0);
    expect(sorted[0]?.code).toBe(second.roomCode);
    expect(new Set(sorted.map((item) => item.code))).toEqual(
      new Set([first.roomCode, second.roomCode]),
    );
    repo.close();
  });

  it('آمار کلی با جدول اتاق‌ها هم‌خوان است', () => {
    const now = START;
    const stats = buildAdminStats(
      [
        { code: 'AAA111', phase: 'alley_puzzle', playerCount: 3, occupiedSeats: 3, onlineCount: 2, version: 4, createdAt: now, updatedAt: now, hasAuditoriumRestart: false },
        { code: 'BBB222', phase: 'in_theater', playerCount: 4, occupiedSeats: 2, onlineCount: 1, version: 9, createdAt: now, updatedAt: now, hasAuditoriumRestart: true },
      ],
      7,
      now,
    );
    expect(stats).toMatchObject({ rooms: 2, players: 5, online: 3, events: 7, serverNow: now });
    expect(stats.phases.alley_puzzle).toBe(1);
    expect(stats.phases.in_theater).toBe(1);
    expect(stats.phases.door_cutscene).toBe(0);
  });
});

describe('ادمین — رویدادها (قرارداد ۶)', () => {
  it('رویداد را ذخیره و جدیدترین‌اول برمی‌گرداند', async () => {
    const { repo, code } = await setup();
    await repo.recordAdminEvent(
      createAdminEvent({ type: 'room_created', roomCode: code, createdAt: START, id: 'e1' }),
    );
    await repo.recordAdminEvent(
      createAdminEvent({
        type: 'player_joined',
        roomCode: code,
        playerId: 'seat-1',
        payload: { seatIndex: 0 },
        createdAt: START + 10,
        id: 'e2',
      }),
    );

    const events = await repo.listAdminEvents();
    expect(events.map((event) => event.id)).toEqual(['e2', 'e1']);
    expect(events[0]?.payload).toEqual({ seatIndex: 0 });
    expect(events[1]?.playerId).toBeNull();
  });

  it('بر اساس اتاق و نوع فیلتر و بر اساس limit محدود می‌کند', async () => {
    const { repo, code } = await setup();
    for (let i = 0; i < 5; i++) {
      await repo.recordAdminEvent(
        createAdminEvent({ type: 'door_attempt', roomCode: code, createdAt: START + i, id: `d${i}` }),
      );
    }
    await repo.recordAdminEvent(
      createAdminEvent({ type: 'error', roomCode: 'ZZZ999', createdAt: START + 99, id: 'err' }),
    );

    const doorAttempts = await repo.listAdminEvents({ roomCode: code, type: 'door_attempt' });
    expect(doorAttempts).toHaveLength(5);
    expect(doorAttempts[0]?.id).toBe('d4');

    const errors = await repo.listAdminEvents({ type: 'error' });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.roomCode).toBe('ZZZ999');

    const limited = await repo.listAdminEvents({ limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited[0]?.id).toBe('err');
  });

  it('شناسهٔ تکراری را رد می‌کند (کلید اصلی)', async () => {
    const { repo } = await setup();
    const event = createAdminEvent({ type: 'room_created', id: 'dup', createdAt: START });
    await repo.recordAdminEvent(event);
    await expect(repo.recordAdminEvent(event)).rejects.toThrow();
  });
});

describe('ادمین — حذف بازیکن (فاز ۱۳)', () => {
  it('صندلی را آزاد و توکن را باطل می‌کند و نسخه را بالا می‌برد', async () => {
    const { repo, code, tokens } = await setup(3);
    const before = await loadRoom(code, repo);
    const targetSeat = before!.seats[1];
    const removedName = targetSeat?.playerName;
    const versionBefore = before!.version;

    expect(await repo.deleteSeat(code, 1)).toBe(true);

    const after = await loadRoom(code, repo);
    expect(after!.version).toBe(versionBefore + 1);
    expect(after!.seats[1]?.joined).toBe(false);
    expect(after!.seats[1]?.isOnline).toBe(false);
    expect(after!.seats[1]?.seatTokenHash).toBe('');
    expect(after!.seats[1]?.playerName).not.toBe(removedName);
    expect(after!.seats[1]?.playerName).toBe('صندلی 2');
    // صندلی‌های دیگر دست‌نخورده‌اند
    expect(after!.seats[0]?.seatTokenHash).toBe(before!.seats[0]?.seatTokenHash);

    // توکن حذف‌شده دیگر معتبر نیست؛ توکن بقیه هنوز کار می‌کند
    expect(findSeatIndexByToken(after!, tokens[1] as string)).toBeNull();
    expect(findSeatIndexByToken(after!, tokens[0] as string)).toBe(0);
  });

  it('اتاق ناموجود یا شمارهٔ صندلی نامعتبر را false برمی‌گرداند', async () => {
    const { repo, code } = await setup(3);
    expect(await repo.deleteSeat('ZZZZZZ', 0)).toBe(false);
    expect(await repo.deleteSeat(code, 9)).toBe(false);
    expect(await repo.deleteSeat(code, -1)).toBe(false);
  });

  it('بعد از حذف، بازیکن حذف‌شده با توکن قدیمی نمی‌تواند وارد شود', async () => {
    const { repo, code, tokens } = await setup(3);
    await repo.deleteSeat(code, 0);
    await expect(touchSeatPresence(code, tokens[0] as string, repo, START + 1_000)).rejects.toThrow();
    await expect(touchSeatPresence(code, tokens[1] as string, repo, START + 1_000)).resolves.toBeTruthy();
  });
});

describe('ادمین — پایداری و مایگریشن', () => {
  it('رویدادها بعد از بستن و باز کردن دیتابیس می‌مانند', async () => {
    const dbPath = path.join(tmpDir, 'persist-events.db');
    const first = new SqliteRoomRepository(dbPath);
    await first.recordAdminEvent(
      createAdminEvent({ type: 'puzzle_solved', roomCode: 'ABC123', createdAt: START + 5, id: 'p1' }),
    );
    first.close();

    const second = new SqliteRoomRepository(dbPath);
    const events = await second.listAdminEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('puzzle_solved');
    expect(events[0]?.roomCode).toBe('ABC123');
    second.close();
  });

  it('مایگریشن ۰۰۲ جدول admin_events و RLS را می‌سازد', () => {
    const sql = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/002_admin_events.sql'),
      'utf8',
    );
    expect(sql).toContain('create table if not exists public.admin_events');
    expect(sql).toContain('enable row level security');
    for (const type of ['room_created', 'player_joined', 'puzzle_solved', 'error']) {
      expect(sql).toContain(type);
    }
    expect(sql.toLowerCase()).not.toContain('service_role_key');
  });
});

beforeEach(() => {
  // هیچ وضعیت مشترکی بین تست‌ها لازم نیست؛ هر تست دیتابیس تازه می‌سازد
});
