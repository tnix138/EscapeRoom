// تست‌های تکمیلی موج ۲ توحید: پانچ همزمان ۸ نفره (OCC) و ماندگاری گذار فاز هنگام رد اکشن
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  performGameAction,
  reserveRoom,
} from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-wave2-hardening-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const NAMES = ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳', 'سارا ۴', 'مریم ۵', 'نیما ۶', 'لیلا ۷', 'کیان ۸'];

describe('موج ۲ (تکمیلی) — پانچ همزمان همه بازیکنان بدون گم شدن هیچ پانچی', () => {
  it.each([3, 8])(
    'برای N=%i هر سه/هشت پانچ همزمان (Promise.all) موفق است و قفل در با کد جمعی باز می‌شود',
    async (n) => {
      resetRateLimits();
      const repo = new SqliteRoomRepository(path.join(tmpDir, `concurrent-${n}.db`));
      const reservation = await reserveRoom(
        { playerCount: n, playerNames: NAMES.slice(0, n) },
        repo,
      );
      const state = await repo.getRoom(reservation.roomCode);
      expect(state).not.toBeNull();

      // هر ۸ نفر دقیقاً در یک لحظه پانچ می‌کنند؛ هیچ‌کدام نباید قربانی تداخل نسخه شود
      const outcomes = await Promise.all(
        state!.seats.map((seat) => {
          const target = state!.targets[seat.seatIndex]!;
          return performGameAction(
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
        }),
      );
      expect(outcomes.every((o) => o.accepted)).toBe(true);

      const after = await repo.getRoom(reservation.roomCode);
      expect(after!.seats.every((s) => s.ticketPunched)).toBe(true);

      const code = after!.targets.map((t) => String(t.goldenDigit)).join('');
      const unlocked = await performGameAction(
        reservation.roomCode,
        reservation.invites[0]!.seatToken,
        { type: 'UNLOCK_THEATER_DOOR', code },
        repo,
      );
      expect(unlocked.accepted).toBe(true);
      expect(unlocked.roomView.phase).toBe('door_cutscene');
      repo.close();
    },
  );
});

describe('موج ۲ (تکمیلی) — گذار فاز هنگام رد اکشن در کات‌سین گم نمی‌شود', () => {
  it('اکشن قفل‌شده در مرز ۱۱ ثانیه، گذار به theater_cutscene را ماندگار می‌کند', async () => {
    resetRateLimits();
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'tick-on-lock.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: NAMES.slice(0, 3) },
      repo,
    );
    const token = reservation.invites[0]!.seatToken;
    const stored = await repo.getRoom(reservation.roomCode);
    stored!.phase = 'door_cutscene';
    // شروع کات‌سین ۱۲ ثانیه پیش بوده؛ یعنی هنگام اکشن بعدی باید در فاز سالن باشیم
    stored!.cutsceneStartedAt = Date.now() - 12_000;
    await repo.saveRoomIfVersion(stored!, stored!.version);

    await expect(
      performGameAction(
        reservation.roomCode,
        token,
        { type: 'COMPLETE_INVITATION_VIDEO' },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'CUTSCENE_LOCKED' });

    const after = await repo.getRoom(reservation.roomCode);
    expect(after!.phase).toBe('theater_cutscene');
    repo.close();
  });

  it('اکشن قفل‌شده پس از مرز ۷۴ ثانیه، فاز in_theater و زمان شروع مجدد را ماندگار می‌کند', async () => {
    resetRateLimits();
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'tick-on-lock-74.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: NAMES.slice(0, 3) },
      repo,
    );
    const stored = await repo.getRoom(reservation.roomCode);
    const startedAt = Date.now() - 80_000;
    stored!.phase = 'theater_cutscene';
    stored!.cutsceneStartedAt = startedAt;
    await repo.saveRoomIfVersion(stored!, stored!.version);

    // این اکشن به‌جای قفل شدن، بعد از گذار ماندگار به in_theater باید پذیرفته شود
    const inspected = await performGameAction(
      reservation.roomCode,
      reservation.invites[0]!.seatToken,
      { type: 'INSPECT_AUDITORIUM_HOTSPOT', hotspotId: 'crooked-paintings' },
      repo,
    );
    expect(inspected.accepted).toBe(true);
    const after = await repo.getRoom(reservation.roomCode);
    expect(after!.phase).toBe('in_theater');
    expect(after!.restartedInTheaterAt).toBe(startedAt + 74_000);
    repo.close();
  });
});
