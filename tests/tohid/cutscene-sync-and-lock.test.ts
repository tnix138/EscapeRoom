// تست موج ۲: گذار ساعت‌محور فازهای کات‌سین ۷۴ ثانیه‌ای و قفل بودن اکشن‌ها در طول آن
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createInitialRoomState,
  tickPhaseByClock,
  type InternalRoomState,
} from '../../src/engine/index';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  GameServiceError,
  performGameAction,
  reserveRoom,
} from '../../src/server/services/room-service';
import { resetRateLimits } from '../../src/server/auth/rate-limit';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-cutscene-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

function stateAt(start: number, phase: InternalRoomState['phase'] = 'door_cutscene'): InternalRoomState {
  const s = createInitialRoomState({
    code: 'TESTCS',
    playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'],
    seatTokenHashes: ['h0', 'h1', 'h2'],
    seed: 42,
    now: start,
  });
  s.phase = phase;
  s.cutsceneStartedAt = start;
  return s;
}

describe('موج ۲ — ماشین زمان کات‌سین (tickPhaseByClock)', () => {
  it('در مرزهای دقیق ۱۱s و ۷۴s فاز را جلو می‌برد و restartedInTheaterAt را ماندگار می‌کند', () => {
    const start = 1_000_000;
    const s = stateAt(start);
    expect(tickPhaseByClock(s, start + 10_999)).toBe(false);
    expect(s.phase).toBe('door_cutscene');
    expect(tickPhaseByClock(s, start + 11_000)).toBe(true);
    expect(s.phase).toBe('theater_cutscene');
    expect(tickPhaseByClock(s, start + 73_999)).toBe(false);
    expect(s.phase).toBe('theater_cutscene');
    expect(tickPhaseByClock(s, start + 74_000)).toBe(true);
    expect(s.phase).toBe('in_theater');
    expect(s.restartedInTheaterAt).toBe(start + 74_000);
  });
});

describe('موج ۲ — قفل اکشن در کات‌سین و شروع مجدد در سالن', () => {
  it('در طول کات‌سین اکشن با CUTSCENE_LOCKED رد و پس از ۷۴ ثانیه بررسی سالن آزاد می‌شود', async () => {
    resetRateLimits();
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'lock.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
      repo,
    );
    const token = reservation.invites[0]!.seatToken;
    // ورود مستقیم به کات‌سین (شبیه‌سازی لحظه باز شدن در)
    const stored = await repo.getRoom(reservation.roomCode);
    stored!.phase = 'door_cutscene';
    stored!.cutsceneStartedAt = Date.now();
    await repo.saveRoomIfVersion(stored!, stored!.version);

    await expect(
      performGameAction(
        reservation.roomCode,
        token,
        { type: 'COMPLETE_INVITATION_VIDEO' },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'CUTSCENE_LOCKED', status: 409 });
    await expect(
      performGameAction(
        reservation.roomCode,
        token,
        { type: 'PUNCH_MY_TICKET', emblem: 'mask', actNumber: 1, rowCode: 'I' },
        repo,
      ),
    ).rejects.toBeInstanceOf(GameServiceError);

    // پرش ساعت به پایان کات‌سین: فاز ماندگار in_theater و هات‌اسپات قابل بررسی است
    const again = await repo.getRoom(reservation.roomCode);
    again!.cutsceneStartedAt = Date.now() - 74_000;
    await repo.saveRoomIfVersion(again!, again!.version);
    const inspected = await performGameAction(
      reservation.roomCode,
      token,
      { type: 'INSPECT_AUDITORIUM_HOTSPOT', hotspotId: 'shattered-chandelier' },
      repo,
    );
    expect(inspected.accepted).toBe(true);
    expect(inspected.roomView.phase).toBe('in_theater');
    expect(inspected.roomView.auditorium?.inspectedHotspots['shattered-chandelier']).toContain('توحید ۱');
    expect(inspected.roomView.restartedInTheaterAt).not.toBeNull();
    repo.close();
  });
});
