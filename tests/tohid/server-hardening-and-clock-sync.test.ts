// تست سخت‌سازی ساعت سرور، گذار فاز در مسیر خواندن (loadRoom) و polling شرطی sinceVersion
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  computeClockOffset,
  computeCutsceneElapsedMs,
} from '../../src/client-sdk/cutscene-clock';
import {
  DOOR_CUTSCENE_DURATION_MS,
  TOTAL_CUTSCENE_DURATION_MS,
} from '../../src/contracts/types';
import { type InternalRoomState } from '../../src/engine/index';
import type { RoomRepository } from '../../src/server/db/repository';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { subscribeRoom } from '../../src/server/realtime/room-hub';
import {
  getRoomViewConditional,
  getRoomViewForSeat,
  loadRoom,
  PRESENCE_REFRESH_INTERVAL_MS,
  reserveRoom,
} from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-clock-hardening-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

describe('سخت‌سازی کات‌سین و مسیر خواندن اتاق (موج ۷ و ۸)', () => {
  it('loadRoom هنگام عبور از مرز ۱۱ و ۷۴ ثانیه، هم در DB ذخیره می‌کند و هم به room-hub منتشر می‌کند', async () => {
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'load-publish.db'));
    const start = 1_700_100_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(start);

    try {
      const reservation = await reserveRoom(
        { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
        repo,
        start,
      );
      const state = await repo.getRoom(reservation.roomCode);
      state!.phase = 'door_cutscene';
      state!.cutsceneStartedAt = start;
      await repo.saveRoomIfVersion(state!, state!.version);

      const broadcasts: Array<{ phase: string; version: number }> = [];
      const unsub = subscribeRoom(reservation.roomCode, (updated) => {
        broadcasts.push({ phase: updated.phase, version: updated.version });
      });

      nowSpy.mockReturnValue(start + DOOR_CUTSCENE_DURATION_MS);
      const atTheater = await loadRoom(reservation.roomCode, repo);
      expect(atTheater?.phase).toBe('theater_cutscene');
      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0]?.phase).toBe('theater_cutscene');

      nowSpy.mockReturnValue(start + TOTAL_CUTSCENE_DURATION_MS);
      const atDarkRoom = await loadRoom(reservation.roomCode, repo);
      expect(atDarkRoom?.phase).toBe('in_theater');
      expect(atDarkRoom?.restartedInTheaterAt).toBe(start + TOTAL_CUTSCENE_DURATION_MS);
      expect(broadcasts).toHaveLength(2);
      expect(broadcasts[1]?.phase).toBe('in_theater');

      unsub();
    } finally {
      repo.close();
      nowSpy.mockRestore();
    }
  });

  it('در صورت باختن مسابقه OCC هنگام تیک ساعت در loadRoom، وضعیت ماندگار واقعی را برمی‌گرداند', async () => {
    const sqlite = new SqliteRoomRepository(path.join(tmpDir, 'load-occ-race.db'));
    const start = 1_700_200_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(start);

    try {
      const reservation = await reserveRoom(
        { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
        sqlite,
        start,
      );
      const seeded = await sqlite.getRoom(reservation.roomCode);
      seeded!.phase = 'door_cutscene';
      seeded!.cutsceneStartedAt = start;
      await sqlite.saveRoomIfVersion(seeded!, seeded!.version);

      // شبیه‌سازی تداخل همزمان heartbeat دیگر دقیقاً پیش از saveRoomIfVersion
      let racedOnce = false;
      const racingRepo: RoomRepository = {
        driver: 'sqlite',
        createRoom: (s) => sqlite.createRoom(s),
        getRoom: (c) => sqlite.getRoom(c),
        async saveRoomIfVersion(s: InternalRoomState, expectedVersion: number) {
          if (!racedOnce) {
            racedOnce = true;
            const winner = await sqlite.getRoom(s.code);
            winner!.phase = 'theater_cutscene';
            await sqlite.saveRoomIfVersion(winner!, winner!.version);
          }
          return sqlite.saveRoomIfVersion(s, expectedVersion);
        },
        // متدهای پنل ادمین (فاز ۱۰/۱۳) به این تست ربطی ندارند؛ به ریپازیتوری واقعی واگذار می‌شوند
        listRooms: (limit) => sqlite.listRooms(limit),
        recordAdminEvent: (event) => sqlite.recordAdminEvent(event),
        listAdminEvents: (options) => sqlite.listAdminEvents(options),
        deleteSeat: (roomCode, seatIndex) => sqlite.deleteSeat(roomCode, seatIndex),
      };

      nowSpy.mockReturnValue(start + DOOR_CUTSCENE_DURATION_MS + 50);
      const loaded = await loadRoom(reservation.roomCode, racingRepo);
      const persisted = await sqlite.getRoom(reservation.roomCode);
      expect(loaded?.phase).toBe('theater_cutscene');
      expect(loaded?.version).toBe(persisted?.version);
    } finally {
      sqlite.close();
      nowSpy.mockRestore();
    }
  });

  it('getRoomViewConditional در پنجره lease بدون افزایش نسخه unchanged برمی‌گرداند و پس از تغییر، نمای تازه می‌دهد', async () => {
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'conditional-get.db'));
    const t0 = 1_700_300_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0);

    try {
      const reservation = await reserveRoom(
        { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
        repo,
        t0,
      );
      const token0 = reservation.invites[0]!.seatToken;
      const token1 = reservation.invites[1]!.seatToken;

      const initialView = await getRoomViewForSeat(reservation.roomCode, token0, repo);
      const vAfterJoin = initialView.version;

      // استعلام مجدد با همان نسخه در پنجره حضور: هیچ نوشتن اضافه‌ای در دیتابیس رخ نمی‌دهد
      nowSpy.mockReturnValue(t0 + 2_000);
      const unchanged = await getRoomViewConditional(reservation.roomCode, token0, vAfterJoin, repo);
      expect(unchanged).toEqual({
        unchanged: true,
        version: vAfterJoin,
        serverNow: t0 + 2_000,
      });
      expect((await repo.getRoom(reservation.roomCode))?.version).toBe(vAfterJoin);

      // پس از ورود هم‌تیمی دیگر نسخه بالا می‌رود و استعلام شرطی نمای کامل را برمی‌گرداند
      nowSpy.mockReturnValue(t0 + 3_000);
      await getRoomViewForSeat(reservation.roomCode, token1, repo);
      const changed = await getRoomViewConditional(reservation.roomCode, token0, vAfterJoin, repo);
      expect(changed.unchanged).toBe(false);
      if (!changed.unchanged) {
        expect(changed.roomView.version).toBeGreaterThan(vAfterJoin);
      }

      // پس از پایان پنجره lease نیز حضور تازه و نسخه به‌روز می‌شود
      const latestVersion = (await repo.getRoom(reservation.roomCode))!.version;
      nowSpy.mockReturnValue(t0 + 3_000 + PRESENCE_REFRESH_INTERVAL_MS + 100);
      const leaseRefreshed = await getRoomViewConditional(
        reservation.roomCode,
        token0,
        latestVersion,
        repo,
      );
      expect(leaseRefreshed.unchanged).toBe(false);
    } finally {
      repo.close();
      nowSpy.mockRestore();
    }
  });

  it('محاسبات ساعت کات‌سین در برابر NaN و بی‌نهایت مقاوم است و هرگز NaN تولید نمی‌کند', () => {
    expect(computeClockOffset(Number.NaN, 1_000)).toBe(0);
    expect(computeClockOffset(1_000, Number.POSITIVE_INFINITY)).toBe(0);
    expect(computeCutsceneElapsedMs(1_000, Number.NaN, 6_000)).toBe(5_000);
    expect(computeCutsceneElapsedMs(Number.NaN, 0, 6_000)).toBe(0);
    expect(computeCutsceneElapsedMs(1_000, 0, Number.NaN)).toBe(0);
  });
});
