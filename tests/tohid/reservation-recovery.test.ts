// موج ۵ توحید: مسیر رزرو → لینک دعوت → بازیابی نشست از API امن
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { getRoomRepository } from '../../src/server/db/repository';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-reservation-api-'));
const previousStorageDriver = process.env.STORAGE_DRIVER;
const previousDbPath = process.env.ESCAPEROOM_DB_PATH;
process.env.STORAGE_DRIVER = 'sqlite';
process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'route.db');

afterAll(() => {
  const repo = getRoomRepository();
  if (repo instanceof SqliteRoomRepository) repo.close();
  if (previousStorageDriver === undefined) delete process.env.STORAGE_DRIVER;
  else process.env.STORAGE_DRIVER = previousStorageDriver;
  if (previousDbPath === undefined) delete process.env.ESCAPEROOM_DB_PATH;
  else process.env.ESCAPEROOM_DB_PATH = previousDbPath;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('موج ۵ — رزرو، لینک دعوت و recovery از API', () => {
  it('اتاق ۳ نفره را رزرو می‌کند و هر توکن بعد از refresh همان seat و phase را بازیابی می‌کند', async () => {
    const { POST } = await import('../../src/app/api/rooms/route');
    const { GET } = await import('../../src/app/api/rooms/[code]/route');
    const playerNames = ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'];
    const reservationResponse = await POST(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: playerNames.length, playerNames }),
      }),
    );
    expect(reservationResponse.status).toBe(201);
    const envelope = (await reservationResponse.json()) as {
      ok: boolean;
      data: {
        roomCode: string;
        playerCount: number;
        invites: Array<{
          invitePath: string;
          playerName: string;
          seatIndex: number;
          seatLabel: string;
          seatToken: string;
        }>;
      };
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.data.playerCount).toBe(3);
    expect(envelope.data.invites.map((invite) => invite.playerName)).toEqual(playerNames);
    expect(new Set(envelope.data.invites.map((invite) => invite.seatToken)).size).toBe(3);

    for (const invite of envelope.data.invites) {
      expect(invite.seatToken).toHaveLength(48);
      expect(invite.invitePath).toBe(`/invite/${envelope.data.roomCode}/${invite.seatToken}`);
      const makeRequest = () =>
        new Request(`http://localhost/api/rooms/${envelope.data.roomCode}`, {
          headers: { 'X-Seat-Token': invite.seatToken },
        });
      const firstResponse = await GET(makeRequest(), {
        params: Promise.resolve({ code: envelope.data.roomCode }),
      });
      expect(firstResponse.status).toBe(200);
      const first = (await firstResponse.json()) as {
        ok: boolean;
        data: { roomView: { phase: string; roomCode: string; me: { playerId: string; playerName: string; seatIndex: number } } };
      };
      expect(first.ok).toBe(true);
      expect(first.data.roomView.phase).toBe('alley_puzzle');
      expect(first.data.roomView.roomCode).toBe(envelope.data.roomCode);
      expect(first.data.roomView.me.playerName).toBe(invite.playerName);
      expect(first.data.roomView.me.seatIndex).toBe(invite.seatIndex);
      expect(JSON.stringify(first)).not.toContain(invite.seatToken);

      // Simulated page reload: authenticate again with the same persisted invite session.
      const refreshResponse = await GET(makeRequest(), {
        params: Promise.resolve({ code: envelope.data.roomCode }),
      });
      expect(refreshResponse.status).toBe(200);
      const refreshed = (await refreshResponse.json()) as typeof first;
      expect(refreshed.data.roomView.phase).toBe(first.data.roomView.phase);
      expect(refreshed.data.roomView.me).toMatchObject({
        playerId: first.data.roomView.me.playerId,
        playerName: first.data.roomView.me.playerName,
        seatIndex: first.data.roomView.me.seatIndex,
        joined: true,
      });
      expect(JSON.stringify(refreshed)).not.toContain(invite.seatToken);
    }
  });

  it('ورودی رزرو نامعتبر و نشست بدون توکن یا با توکن جعلی را رد می‌کند', async () => {
    const { POST } = await import('../../src/app/api/rooms/route');
    const { GET } = await import('../../src/app/api/rooms/[code]/route');

    const invalidReservation = await POST(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: 2, playerNames: ['الف الف', 'ب ب'] }),
      }),
    );
    expect(invalidReservation.status).toBe(400);
    expect((await invalidReservation.json()).error.code).toBe('VALIDATION_ERROR');

    const malformedReservation = await POST(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
    );
    expect(malformedReservation.status).toBe(400);

    const missingToken = await GET(
      new Request('http://localhost/api/rooms/NOPE'),
      { params: Promise.resolve({ code: 'NOPE' }) },
    );
    expect(missingToken.status).toBe(401);

    const validReservation = await POST(
      new Request('http://localhost/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: 3, playerNames: ['مینا ۱', 'کیان ۲', 'هستی ۳'] }),
      }),
    );
    const { data } = (await validReservation.json()) as { data: { roomCode: string } };
    const invalidToken = await GET(
      new Request(`http://localhost/api/rooms/${data.roomCode}`, {
        headers: { 'X-Seat-Token': 'not-a-real-token-1234' },
      }),
      { params: Promise.resolve({ code: data.roomCode }) },
    );
    expect(invalidToken.status).toBe(401);
  });
});
