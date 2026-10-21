// تست‌های موج ۱ توحید: بقای داده بعد از ری‌استارت، OCC، امنیت توکن‌ها و عدم نشت جواب‌ها
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createPreviewRoomState } from '../../src/client-sdk/preview-fixtures';
import { projectRoomView } from '../../src/engine/view-projector';
import { generateSeatToken, hashSeatToken, seatTokenMatches } from '../../src/server/auth/seat-token';
import { createSqliteRepository } from '../../src/server/db/repository';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { reserveRoom, sanitizePlayerName } from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-test-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

describe('موج ۱ — رزرو ۳ تا ۸ نفره و لینک‌های دعوت نام‌دار', () => {
  it.each([3, 4, 5, 6, 7, 8])('برای %i بازیکن لینک اختصاصی با نام هر نفر صادر می‌کند', async (n) => {
    const repo = new SqliteRoomRepository(path.join(tmpDir, `r${n}.db`));
    const names = Array.from({ length: n }, (_, i) => `بازیکن${i + 1} الف`);
    const result = await reserveRoom({ playerCount: n, playerNames: names }, repo);
    expect(result.playerCount).toBe(n);
    expect(result.invites).toHaveLength(n);
    expect(new Set(result.invites.map((i) => i.seatToken)).size).toBe(n);
    for (const invite of result.invites) {
      expect(invite.seatToken).toHaveLength(48);
      expect(invite.invitePath).toBe(`/invite/${result.roomCode}/${invite.seatToken}`);
      expect(names).toContain(invite.playerName);
    }
    repo.close();
  });

  it('تعداد کمتر از ۳ یا بیشتر از ۸ و نام کوتاه/تکراری را رد می‌کند', async () => {
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'invalid.db'));
    await expect(reserveRoom({ playerCount: 2, playerNames: ['الف الف', 'ب ب'] }, repo)).rejects.toThrow();
    await expect(
      reserveRoom({ playerCount: 3, playerNames: ['x', 'ب ب', 'ج ج'] }, repo),
    ).rejects.toThrow();
    await expect(
      reserveRoom({ playerCount: 3, playerNames: ['سام سام', 'سام سام', 'ج ج'] }, repo),
    ).rejects.toThrow();
    repo.close();
  });

  it('نام‌ها را از XSS پاک‌سازی می‌کند', () => {
    expect(sanitizePlayerName('<script>alert(1)</script>توحید')).not.toContain('<');
    expect(sanitizePlayerName('  توحید   رضا ')).toBe('توحید رضا');
  });
});

describe('موج ۱ — پایداری SQLite و OCC', () => {
  it('وضعیت اتاق بعد از بستن و باز کردن دوباره دیتابیس باقی می‌ماند', async () => {
    const dbPath = path.join(tmpDir, 'persist.db');
    const repo1 = new SqliteRoomRepository(dbPath);
    const result = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید الف', 'امیرعلی ب', 'علیرضا ج'] },
      repo1,
    );
    repo1.close();
    const repo2 = new SqliteRoomRepository(dbPath);
    const loaded = await repo2.getRoom(result.roomCode);
    expect(loaded?.playerCount).toBe(3);
    expect(loaded?.seats.map((s) => s.playerName)).toEqual(['توحید الف', 'امیرعلی ب', 'علیرضا ج']);
    repo2.close();
  });

  it('ذخیره مشروط OCC با نسخه کهنه شکست می‌خورد و با نسخه جاری موفق می‌شود', async () => {
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'occ.db'));
    const result = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید الف', 'امیرعلی ب', 'علیرضا ج'] },
      repo,
    );
    const a = await repo.getRoom(result.roomCode);
    const b = await repo.getRoom(result.roomCode);
    expect(a && b).toBeTruthy();
    expect(await repo.saveRoomIfVersion(a!, a!.version)).toBe(true);
    // b هنوز نسخه قبلی را دارد -> باید رد شود تا هیچ به‌روزرسانی همزمانی گم نشود
    expect(await repo.saveRoomIfVersion(b!, b!.version)).toBe(false);
    repo.close();
  });

  it('در دیتابیس فقط هش SHA-256 توکن نگهداری می‌شود، نه متن خام', async () => {
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'hash.db'));
    const result = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید الف', 'امیرعلی ب', 'علیرضا ج'] },
      repo,
    );
    const loaded = await repo.getRoom(result.roomCode);
    for (const [i, seat] of (loaded?.seats ?? []).entries()) {
      const raw = result.invites[i]?.seatToken as string;
      expect(seat.seatTokenHash).toBe(hashSeatToken(raw));
      expect(JSON.stringify(loaded)).not.toContain(raw);
      expect(seatTokenMatches(raw, seat.seatTokenHash)).toBe(true);
    }
    repo.close();
  });
});

describe('موج ۱ — امنیت نمای کلاینت و فیكسچر پیش‌نمایش', () => {
  it('توکن تولیدی ۴۸ کاراکتری و یکتاست', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSeatToken()));
    expect(tokens.size).toBe(100);
    for (const t of tokens) expect(t).toHaveLength(48);
  });

  it('createPreviewRoomState بدون سرور برای هر فاز و تعداد ۳ تا ۸ نمای معتبر می‌سازد', () => {
    for (const phase of ['alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater'] as const) {
      const view = createPreviewRoomState(phase, 5);
      expect(view.phase).toBe(phase);
      expect(view.playerCount).toBe(5);
      expect(view.players).toHaveLength(5);
      expect(view.me.playerName).toBe('توحید');
      // کوپن دست من باید کلید نفر بعدی حلقه باشد
      expect(view.myHeldTickets.companionStub.targetTeammateName).toBe('امیرعلی');
    }
    expect(createPreviewRoomState('in_theater', 3).auditorium?.chandelierShatteredOnFloor).toBe(true);
    expect(createPreviewRoomState('alley_puzzle', 3).auditorium).toBeNull();
  });

  it('پیش از پانچ، رقم طلایی و پاسخ بلیط در نمای کلاینت نشت نمی‌کند', async () => {
    const repo = createSqliteRepository(path.join(tmpDir, 'leak.db'));
    const result = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید الف', 'امیرعلی ب', 'علیرضا ج'] },
      repo,
    );
    const state = await repo.getRoom(result.roomCode);
    const view = projectRoomView(state!, 0, Date.now());
    expect(view.myHeldTickets.mainTicket.revealedGoldenDigit).toBeNull();
    expect(view.myHeldTickets.mainTicket.selectedPunch).toBeNull();
    expect(view.players.every((p) => p.revealedDoorDigit === null)).toBe(true);
    (repo as SqliteRoomRepository).close();
  });
});
