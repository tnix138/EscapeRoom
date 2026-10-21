// موج ۶ توحید: سقف brute-force قفل کوچه، جدا برای هر seat و در پنجرهٔ متحرک
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { performGameAction, reserveRoom } from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-alley-security-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));
afterEach(() => {
  vi.useRealTimers();
  resetRateLimits();
});

describe('موج ۶ — محدودسازی تلاش‌های قفل تماشاخانه', () => {
  it('پنج تلاش در هر seat را می‌پذیرد، ششم را در ۶۰ ثانیه رد می‌کند و پس از انقضا دوباره اجازه می‌دهد', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T16:00:00.000Z'));
    resetRateLimits();

    const repo = new SqliteRoomRepository(path.join(tmpDir, 'door-rate-limit.db'));
    try {
      const reservation = await reserveRoom(
        { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
        repo,
      );
      const state = await repo.getRoom(reservation.roomCode);
      expect(state).not.toBeNull();

      // باز کردن در فقط پس از پانچ همهٔ بلیط‌ها مجاز است.
      for (const seat of state!.seats) {
        const target = state!.targets[seat.seatIndex]!;
        const outcome = await performGameAction(
          reservation.roomCode,
          reservation.invites[seat.seatIndex]!.seatToken,
          {
            type: 'PUNCH_MY_TICKET',
            emblem: target.targetEmblem,
            actNumber: target.targetAct,
            rowCode: target.targetRowCode,
          },
          repo,
        );
        expect(outcome.accepted).toBe(true);
      }

      const makeAttempt = (seatIndex: number) =>
        performGameAction(
          reservation.roomCode,
          reservation.invites[seatIndex]!.seatToken,
          { type: 'UNLOCK_THEATER_DOOR', code: '000' },
          repo,
        );

      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await makeAttempt(0);
        expect(result.accepted).toBe(false);
        expect(result.code).toBe('WRONG_DOOR_COMBINATION');
      }

      // سقف به هر صندلی اعمال می‌شود، نه به کل گروه.
      const otherSeatAttempt = await makeAttempt(1);
      expect(otherSeatAttempt.accepted).toBe(false);
      expect(otherSeatAttempt.code).toBe('WRONG_DOOR_COMBINATION');

      await expect(makeAttempt(0)).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        status: 429,
      });
      const limitedState = await repo.getRoom(reservation.roomCode);
      expect(limitedState!.doorAttempts).toBe(6);
      expect(limitedState!.phase).toBe('alley_puzzle');

      vi.advanceTimersByTime(60_001);
      const afterWindow = await makeAttempt(0);
      expect(afterWindow.accepted).toBe(false);
      expect(afterWindow.code).toBe('WRONG_DOOR_COMBINATION');
      const recoveredState = await repo.getRoom(reservation.roomCode);
      expect(recoveredState!.doorAttempts).toBe(7);
    } finally {
      repo.close();
    }
  });
});
