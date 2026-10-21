import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { TOTAL_CUTSCENE_DURATION_MS } from '../../src/contracts/types';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  getRoomViewForSeat,
  performGameAction,
  reserveRoom,
} from '../../src/server/services/room-service';

const tempDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-qa-journey-'));

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('QA تجربه — مسیر قابل‌اجرای فعلی', () => {
  it.each([3, 8])(
    'گروه %i نفره از رزرو و دعوت، با همکاری معما را حل می‌کند و به کاوش سالن می‌رسد',
    async (playerCount) => {
      const repo = new SqliteRoomRepository(
        path.join(tempDir, `journey-${playerCount}.db`),
      );

      try {
        const playerNames = Array.from(
          { length: playerCount },
          (_, index) => `مهمان ${index + 1}`,
        );
        const reservation = await reserveRoom(
          { playerCount, playerNames },
          repo,
        );
        expect(reservation.invites).toHaveLength(playerCount);

        // هر مهمان دعوت‌نامه را می‌بیند و به کوچه وارد می‌شود.
        for (const invite of reservation.invites) {
          const invitation = await performGameAction(
            reservation.roomCode,
            invite.seatToken,
            { type: 'COMPLETE_INVITATION_VIDEO' },
            repo,
          );
          expect(invitation.accepted).toBe(true);
        }

        const initialViews = await Promise.all(
          reservation.invites.map((invite) =>
            getRoomViewForSeat(reservation.roomCode, invite.seatToken, repo),
          ),
        );
        expect(initialViews.every((view) => view.phase === 'alley_puzzle')).toBe(true);

        // کوپن نفر قبلی، عنوان پرده و نماد لازم برای بلیط بازیکن جاری را می‌دهد.
        for (let seatIndex = 0; seatIndex < playerCount; seatIndex += 1) {
          const ownView = initialViews[seatIndex];
          const holderIndex = (seatIndex + playerCount - 1) % playerCount;
          const holderView = initialViews[holderIndex];
          if (!ownView || !holderView) throw new Error('نمای یکی از مهمانان پیدا نشد.');

          const stub = holderView.myHeldTickets.companionStub;
          expect(stub.targetTeammateName).toBe(ownView.me.playerName);
          const act = ownView.alley.leftWallPlaybill.find(
            (item) => item.sceneTitle === stub.targetActSceneTitle,
          );
          const row = ownView.alley.rightWallRowChart.find(
            (item) => item.rowTitle === ownView.myHeldTickets.mainTicket.alleyRowHintName,
          );
          if (!act || !row) throw new Error('سرنخ‌های بلیط در نمای مهمان پیدا نشد.');

          const punch = await performGameAction(
            reservation.roomCode,
            reservation.invites[seatIndex]!.seatToken,
            {
              type: 'PUNCH_MY_TICKET',
              emblem: stub.targetEmblem,
              actNumber: act.actNumber,
              rowCode: row.romanCode,
            },
            repo,
          );
          expect(punch.accepted).toBe(true);
        }

        // پس از پانچ همه، رقم‌های نمایان‌شده به ترتیب صندلی قفل را باز می‌کنند.
        const teamView = await getRoomViewForSeat(
          reservation.roomCode,
          reservation.invites[0]!.seatToken,
          repo,
        );
        const doorCode = teamView.players
          .map((player) => {
            expect(player.revealedDoorDigit).not.toBeNull();
            return String(player.revealedDoorDigit);
          })
          .join('');
        expect(doorCode).toMatch(new RegExp(`^\\d{${playerCount}}$`));

        const unlock = await performGameAction(
          reservation.roomCode,
          reservation.invites[0]!.seatToken,
          { type: 'UNLOCK_THEATER_DOOR', code: doorCode },
          repo,
        );
        expect(unlock.accepted).toBe(true);
        expect(unlock.roomView.phase).toBe('door_cutscene');

        // ساعت را جلو می‌بریم تا بدون انتظار ۷۴ ثانیه، مسیر سالن را هم بررسی کنیم.
        const cutsceneState = await repo.getRoom(reservation.roomCode);
        if (!cutsceneState) throw new Error('اتاق پس از بازشدن در پیدا نشد.');
        cutsceneState.cutsceneStartedAt =
          Date.now() - TOTAL_CUTSCENE_DURATION_MS - 1;
        expect(
          await repo.saveRoomIfVersion(cutsceneState, cutsceneState.version),
        ).toBe(true);

        const auditoriumView = await getRoomViewForSeat(
          reservation.roomCode,
          reservation.invites[0]!.seatToken,
          repo,
        );
        expect(auditoriumView.phase).toBe('in_theater');
        expect(auditoriumView.auditorium).toMatchObject({
          horrorMusicActive: true,
          chandelierShatteredOnFloor: true,
          wallPaintingsCrooked: true,
          performersVanished: true,
        });

        const inspection = await performGameAction(
          reservation.roomCode,
          reservation.invites[0]!.seatToken,
          {
            type: 'INSPECT_AUDITORIUM_HOTSPOT',
            hotspotId: 'shattered-chandelier',
          },
          repo,
        );
        expect(inspection.accepted).toBe(true);
        expect(
          inspection.roomView.auditorium?.inspectedHotspots['shattered-chandelier'],
        ).toContain(playerNames[0]);
      } finally {
        repo.close();
      }
    },
  );

  it('پانچ اشتباه و بازکردن زودهنگام در را رد می‌کند و گروه را در کوچه نگه می‌دارد', async () => {
    const repo = new SqliteRoomRepository(path.join(tempDir, 'journey-error.db'));

    try {
      const playerNames = ['مهمان یک', 'مهمان دو', 'مهمان سه'];
      const reservation = await reserveRoom(
        { playerCount: playerNames.length, playerNames },
        repo,
      );
      const views = await Promise.all(
        reservation.invites.map((invite) =>
          getRoomViewForSeat(reservation.roomCode, invite.seatToken, repo),
        ),
      );
      const ownView = views[0];
      const holderView = views[views.length - 1];
      if (!ownView || !holderView) throw new Error('نمای مهمان پیدا نشد.');

      const stub = holderView.myHeldTickets.companionStub;
      const act = ownView.alley.leftWallPlaybill.find(
        (item) => item.sceneTitle === stub.targetActSceneTitle,
      );
      const row = ownView.alley.rightWallRowChart.find(
        (item) => item.rowTitle === ownView.myHeldTickets.mainTicket.alleyRowHintName,
      );
      if (!act || !row) throw new Error('سرنخ‌های بلیط در نمای مهمان پیدا نشد.');

      const wrongEmblem = stub.targetEmblem === 'mask' ? 'bell' : 'mask';
      const wrongPunch = await performGameAction(
        reservation.roomCode,
        reservation.invites[0]!.seatToken,
        {
          type: 'PUNCH_MY_TICKET',
          emblem: wrongEmblem,
          actNumber: act.actNumber,
          rowCode: row.romanCode,
        },
        repo,
      );
      expect(wrongPunch.accepted).toBe(false);
      expect(wrongPunch.code).toBe('TICKET_WRONG_PUNCH');

      const earlyUnlock = await performGameAction(
        reservation.roomCode,
        reservation.invites[0]!.seatToken,
        { type: 'UNLOCK_THEATER_DOOR', code: '000' },
        repo,
      );
      expect(earlyUnlock.accepted).toBe(false);
      expect(earlyUnlock.code).toBe('TICKETS_NOT_ALL_PUNCHED');
      expect(earlyUnlock.roomView.phase).toBe('alley_puzzle');
    } finally {
      repo.close();
    }
  });
});
