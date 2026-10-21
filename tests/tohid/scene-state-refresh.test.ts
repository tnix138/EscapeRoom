// موج ۴ توحید: صحنه از فاز پایدار سرور مشتق می‌شود؛ دادهٔ renderer به سرور نمی‌رود.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DOOR_CUTSCENE_DURATION_MS, TOTAL_CUTSCENE_DURATION_MS } from '../../src/contracts/types';
import { doorCodeFromTargets } from '../../src/engine/ticket-puzzle';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  getRoomViewForSeat,
  performGameAction,
  reserveRoom,
} from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-scene-refresh-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

describe('موج ۴ — phase/scene پایدار در refresh بدون ذخیرهٔ transform', () => {
  it('فاز کوچه، کات‌سین و سالن تاریک پس از بستن/بازکردن SQLite از همان scene state مشتق می‌شوند', async () => {
    const dbPath = path.join(tmpDir, 'scene-state.db');
    const cutsceneStart = 1_700_000_000_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(cutsceneStart);
    let repo = new SqliteRoomRepository(dbPath);

    try {
      const reservation = await reserveRoom(
        { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
        repo,
        cutsceneStart,
      );
      const token = reservation.invites[0]!.seatToken;
      const initial = await repo.getRoom(reservation.roomCode);
      expect(initial?.phase).toBe('alley_puzzle');
      repo.close();
      repo = new SqliteRoomRepository(dbPath);
      const afterAlleyRefresh = await getRoomViewForSeat(reservation.roomCode, token, repo);
      expect(afterAlleyRefresh.phase).toBe('alley_puzzle');

      for (let seatIndex = 0; seatIndex < reservation.invites.length; seatIndex++) {
        const state = await repo.getRoom(reservation.roomCode);
        const target = state!.targets[seatIndex]!;
        const punch = await performGameAction(
          reservation.roomCode,
          reservation.invites[seatIndex]!.seatToken,
          {
            type: 'PUNCH_MY_TICKET',
            emblem: target.targetEmblem,
            actNumber: target.targetAct,
            rowCode: target.targetRowCode,
          },
          repo,
        );
        expect(punch.accepted).toBe(true);
      }

      const unlocked = await performGameAction(
        reservation.roomCode,
        token,
        { type: 'UNLOCK_THEATER_DOOR', code: doorCodeFromTargets(initial!.targets) },
        repo,
      );
      expect(unlocked.roomView.phase).toBe('door_cutscene');
      expect(unlocked.roomView.cutsceneStartedAt).toBe(cutsceneStart);

      // Browser refresh/repository restart during transition restores the persisted scene phase and clock.
      repo.close();
      repo = new SqliteRoomRepository(dbPath);
      const afterCutsceneRefresh = await getRoomViewForSeat(reservation.roomCode, token, repo);
      expect(afterCutsceneRefresh.phase).toBe('door_cutscene');
      expect(afterCutsceneRefresh.cutsceneStartedAt).toBe(cutsceneStart);

      now.mockReturnValue(cutsceneStart + DOOR_CUTSCENE_DURATION_MS);
      const theaterView = await getRoomViewForSeat(reservation.roomCode, token, repo);
      expect(theaterView.phase).toBe('theater_cutscene');
      repo.close();
      repo = new SqliteRoomRepository(dbPath);
      expect((await getRoomViewForSeat(reservation.roomCode, token, repo)).phase).toBe('theater_cutscene');

      now.mockReturnValue(cutsceneStart + TOTAL_CUTSCENE_DURATION_MS);
      const darkRoomView = await getRoomViewForSeat(reservation.roomCode, token, repo);
      expect(darkRoomView.phase).toBe('in_theater');
      expect(darkRoomView.restartedInTheaterAt).toBe(cutsceneStart + TOTAL_CUTSCENE_DURATION_MS);
      repo.close();
      repo = new SqliteRoomRepository(dbPath);
      const afterDarkRoomRefresh = await getRoomViewForSeat(reservation.roomCode, token, repo);
      expect(afterDarkRoomRefresh.phase).toBe('in_theater');
      expect(afterDarkRoomRefresh.restartedInTheaterAt).toBe(cutsceneStart + TOTAL_CUTSCENE_DURATION_MS);

      const persisted = await repo.getRoom(reservation.roomCode);
      expect(persisted).not.toHaveProperty('sceneId');
      expect(persisted).not.toHaveProperty('worldTransform');
      expect(JSON.stringify(persisted)).not.toMatch(/"(spawn|position|transform|movement)"/i);
    } finally {
      repo.close();
      now.mockRestore();
    }
  });
});
