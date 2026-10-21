// تست بستن تحویل توحید: انطباق زمان‌اجرای خروجی‌ها با API-CONTRACT.md و نبود هرگونه نشت داخلی
// تایپ‌های TypeScript به‌تنهایی کافی نیستند؛ این تست شکل واقعی JSON مرزی سرور/کلاینت را قفل می‌کند
// تا امیرعلی و علیرضا دقیقاً همان چیزی را بگیرند که در قرارداد قول داده شده است.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createPreviewRoomState } from '../../src/client-sdk/preview-fixtures';
import type { ClientRoomView, GamePhase } from '../../src/contracts/types';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  getRoomViewForSeat,
  reserveRoom,
} from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-contract-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const VIEW_KEYS = [
  'alley',
  'auditorium',
  'cutsceneStartedAt',
  'maxAuditoriumSeats',
  'me',
  'messages',
  'myHeldTickets',
  'phase',
  'playerCount',
  'players',
  'restartedInTheaterAt',
  'roomCode',
  'serverNow',
  'version',
];

const SEAT_KEYS = [
  'auditoriumCol',
  'auditoriumRow',
  'hasWatchedInvitation',
  'isOnline',
  'joined',
  'lastSeenAt',
  'playerId',
  'playerName',
  'revealedDoorDigit',
  'seatIndex',
  'seatLabel',
  'ticketPunched',
];

// کلیدها و داده‌های داخلی سرور که هرگز نباید در JSON نمای کلاینت دیده شوند
const FORBIDDEN_IN_VIEW = ['seatTokenHash', '"seed":', '"targets":', 'state_json', 'seatToken'];

function expectContractShape(view: ClientRoomView, phase: GamePhase, n: number) {
  expect(Object.keys(view).sort()).toEqual(VIEW_KEYS);
  expect(view.phase).toBe(phase);
  expect(view.playerCount).toBe(n);
  expect(view.maxAuditoriumSeats).toBe(20);
  expect(view.players).toHaveLength(n);
  for (const seat of view.players) {
    expect(Object.keys(seat).sort()).toEqual(SEAT_KEYS);
  }
  expect(Object.keys(view.me).sort()).toEqual(SEAT_KEYS);
  expect(view.me).toEqual(view.players[view.me.seatIndex]);
  expect(view.alley.leftWallPlaybill).toHaveLength(4);
  expect(view.alley.rightWallRowChart).toHaveLength(4);
  expect(view.alley.doorLockState.requiredCount).toBe(n);
  if (phase === 'in_theater') {
    expect(view.auditorium).not.toBeNull();
    expect(view.auditorium?.horrorMusicActive).toBe(true);
    expect(view.auditorium?.chandelierShatteredOnFloor).toBe(true);
    expect(view.restartedInTheaterAt).not.toBeNull();
  } else {
    expect(view.auditorium).toBeNull();
  }
  const json = JSON.stringify(view);
  for (const forbidden of FORBIDDEN_IN_VIEW) {
    expect(json).not.toContain(forbidden);
  }
}

describe('تحویل نهایی توحید — انطباق قرارداد برای امیرعلی و علیرضا', () => {
  it.each([3, 4, 5, 6, 7, 8])(
    'فیكسچر پیش‌نمایش در هر ۴ فاز برای N=%i دقیقاً شکل قرارداد را دارد',
    (n) => {
      for (const phase of ['alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater'] as const) {
        expectContractShape(createPreviewRoomState(phase, n), phase, n);
      }
    },
  );

  it('نمای واقعی هر صندلی از سرویس، فقط بلیط خودش را دارد و توکن خام هیچ‌کس در آن نیست', async () => {
    for (const n of [3, 8]) {
      const repo = new SqliteRoomRepository(path.join(tmpDir, `live-${n}.db`));
      const names = Array.from({ length: n }, (_, i) => `بازیکن ${i + 1} تیم`);
      const reservation = await reserveRoom({ playerCount: n, playerNames: names }, repo);
      expect(Object.keys(reservation).sort()).toEqual(['invites', 'playerCount', 'roomCode']);
      for (const invite of reservation.invites) {
        expect(Object.keys(invite).sort()).toEqual([
          'invitePath',
          'playerName',
          'seatIndex',
          'seatLabel',
          'seatToken',
        ]);
        expect(invite.seatToken).toHaveLength(48);
      }
      const rawTokens = reservation.invites.map((i) => i.seatToken);
      for (let seat = 0; seat < n; seat++) {
        const view = await getRoomViewForSeat(
          reservation.roomCode,
          rawTokens[seat] as string,
          repo,
        );
        expectContractShape(view, 'alley_puzzle', n);
        expect(view.me.playerName).toBe(names[seat]);
        expect(view.myHeldTickets.mainTicket.ownerName).toBe(names[seat]);
        const json = JSON.stringify(view);
        for (const token of rawTokens) {
          expect(json).not.toContain(token);
        }
      }
      repo.close();
    }
  });
});
