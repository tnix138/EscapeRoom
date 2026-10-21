// موج ۹ توحید: تعامل hotspot توسط سرور ثبت، احراز و پس از reopen حفظ می‌شود.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { GameServiceError, getRoomViewForSeat, performGameAction, reserveRoom } from '../../src/server/services/room-service';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-persistent-exploration-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

describe('موج ۹ — کاوش سالن با هویت seat و persistence سرور', () => {
  it('کاوش تکراری idempotent است، هویت از token می‌آید و state پس از reopen بازیابی می‌شود', async () => {
    const dbPath = path.join(tmpDir, 'hotspots.db');
    let repo = new SqliteRoomRepository(dbPath);
    try {
      const playerNames = ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'];
      const reservation = await reserveRoom({ playerCount: 3, playerNames }, repo);
      const startedAt = Date.now() - 74_000;
      const room = await repo.getRoom(reservation.roomCode);
      expect(room).not.toBeNull();
      room!.phase = 'in_theater';
      room!.cutsceneStartedAt = startedAt - 11_000;
      room!.restartedInTheaterAt = startedAt;
      expect(await repo.saveRoomIfVersion(room!, room!.version)).toBe(true);

      // کوچه هنوز قفل است؛ یک client نمی‌تواند hotspot progress پیشاپیش ثبت کند.
      const alleyReservation = await reserveRoom(
        { playerCount: 3, playerNames: ['الف ۱', 'ب ۲', 'پ ۳'] },
        repo,
      );
      await expect(
        performGameAction(
          alleyReservation.roomCode,
          alleyReservation.invites[0]!.seatToken,
          { type: 'INSPECT_AUDITORIUM_HOTSPOT', hotspotId: 'locked-exit-doors' },
          repo,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_PHASE' });

      const token0 = reservation.invites[0]!.seatToken;
      const token1 = reservation.invites[1]!.seatToken;
      const inspect = (token: string, extra?: Record<string, unknown>) =>
        performGameAction(
          reservation.roomCode,
          token,
          { type: 'INSPECT_AUDITORIUM_HOTSPOT', hotspotId: 'locked-exit-doors', ...extra },
          repo,
        );

      const first = await inspect(token0, { playerName: 'متقلب جعلی' });
      expect(first.accepted).toBe(true);
      expect(first.roomView.auditorium?.inspectedHotspots['locked-exit-doors']).toEqual(['توحید ۱']);

      const repeated = await inspect(token0);
      expect(repeated.roomView.auditorium?.inspectedHotspots['locked-exit-doors']).toEqual(['توحید ۱']);

      await expect(inspect('invalid-seat-token-00000000')).rejects.toBeInstanceOf(GameServiceError);
      const secondSeat = await inspect(token1);
      expect(secondSeat.roomView.auditorium?.inspectedHotspots['locked-exit-doors']).toEqual([
        'توحید ۱',
        'امیرعلی ۲',
      ]);

      repo.close();
      repo = new SqliteRoomRepository(dbPath);
      const refreshed = await getRoomViewForSeat(
        reservation.roomCode,
        reservation.invites[2]!.seatToken,
        repo,
      );
      expect(refreshed.phase).toBe('in_theater');
      expect(refreshed.restartedInTheaterAt).toBe(startedAt);
      expect(refreshed.auditorium?.inspectedHotspots['locked-exit-doors']).toEqual([
        'توحید ۱',
        'امیرعلی ۲',
      ]);
    } finally {
      repo.close();
    }
  });
});
