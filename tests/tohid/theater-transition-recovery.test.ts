// موج ۷ توحید: همهٔ صندلی‌ها باید فاز انتقال سالن واحدی از API بگیرند.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { doorCodeFromTargets } from '../../src/engine/ticket-puzzle';
import { getRoomRepository } from '../../src/server/db/repository';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-theater-transition-'));
const previousStorageDriver = process.env.STORAGE_DRIVER;
const previousDbPath = process.env.ESCAPEROOM_DB_PATH;
process.env.STORAGE_DRIVER = 'sqlite';
process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'transition.db');

afterAll(() => {
  const repo = getRoomRepository();
  if (repo instanceof SqliteRoomRepository) repo.close();
  if (previousStorageDriver === undefined) delete process.env.STORAGE_DRIVER;
  else process.env.STORAGE_DRIVER = previousStorageDriver;
  if (previousDbPath === undefined) delete process.env.ESCAPEROOM_DB_PATH;
  else process.env.ESCAPEROOM_DB_PATH = previousDbPath;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('موج ۷ — انتقال هماهنگ همهٔ اعضا از کوچه به کات‌سین در API', () => {
  it('پس از بازشدن در، همهٔ seat tokenها فاز و ترکیب گروه یکسانی را می‌بینند', async () => {
    const { POST: reserve } = await import('../../src/app/api/rooms/route');
    const { POST: action } = await import('../../src/app/api/rooms/[code]/action/route');
    const { GET: getRoom } = await import('../../src/app/api/rooms/[code]/route');
    const playerNames = ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'];

    const reservationResponse = await reserve(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: playerNames.length, playerNames }),
      }),
    );
    expect(reservationResponse.status).toBe(201);
    const reservation = (await reservationResponse.json()) as {
      data: {
        roomCode: string;
        invites: Array<{ playerName: string; seatIndex: number; seatToken: string }>;
      };
    };

    const repository = getRoomRepository();
    const state = await repository.getRoom(reservation.data.roomCode);
    expect(state).not.toBeNull();

    for (const invite of reservation.data.invites) {
      const target = state!.targets[invite.seatIndex]!;
      const punchResponse = await action(
        new Request(`http://localhost/api/rooms/${reservation.data.roomCode}/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Seat-Token': invite.seatToken,
          },
          body: JSON.stringify({
            type: 'PUNCH_MY_TICKET',
            emblem: target.targetEmblem,
            actNumber: target.targetAct,
            rowCode: target.targetRowCode,
          }),
        }),
        { params: Promise.resolve({ code: reservation.data.roomCode }) },
      );
      expect(punchResponse.status).toBe(200);
      expect((await punchResponse.json()).data.accepted).toBe(true);
    }

    const current = await repository.getRoom(reservation.data.roomCode);
    const unlockResponse = await action(
      new Request(`http://localhost/api/rooms/${reservation.data.roomCode}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Seat-Token': reservation.data.invites[0]!.seatToken,
        },
        body: JSON.stringify({
          type: 'UNLOCK_THEATER_DOOR',
          code: doorCodeFromTargets(current!.targets),
        }),
      }),
      { params: Promise.resolve({ code: reservation.data.roomCode }) },
    );
    expect(unlockResponse.status).toBe(200);
    const unlocked = await unlockResponse.json();
    expect(unlocked.data.roomView.phase).toBe('door_cutscene');

    const expectedSeats = playerNames.map((playerName, seatIndex) => ({
      playerName,
      seatIndex,
      playerId: `seat-${seatIndex + 1}`,
    }));
    for (const invite of reservation.data.invites) {
      const viewResponse = await getRoom(
        new Request(`http://localhost/api/rooms/${reservation.data.roomCode}`, {
          headers: { 'X-Seat-Token': invite.seatToken },
        }),
        { params: Promise.resolve({ code: reservation.data.roomCode }) },
      );
      expect(viewResponse.status).toBe(200);
      const view = (await viewResponse.json()).data.roomView;
      expect(view.phase).toBe('door_cutscene');
      expect(view.players.map(({ playerName, seatIndex, playerId }: {
        playerName: string;
        seatIndex: number;
        playerId: string;
      }) => ({ playerName, seatIndex, playerId }))).toEqual(expectedSeats);
      expect(view.me.seatIndex).toBe(invite.seatIndex);
      expect(view.cutsceneStartedAt).toBe(unlocked.data.roomView.cutsceneStartedAt);
      expect(JSON.stringify(view)).not.toContain(invite.seatToken);
    }
  });
});
