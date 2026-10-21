// تست موج ۲: اثبات عدم بیکاری هیچ بازیکنی و یکتایی جواب به ازای N = 3..8
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { PlayActNumber, RowRomanCode, TheaterEmblemId } from '../../src/contracts/types';
import { toFaDigits } from '../../src/engine/index';
import {
  generateTicketTargets,
  isCorrectPunch,
  LEFT_WALL_PLAYBILL,
  normalizeDoorCode,
  RIGHT_WALL_ROW_CHART,
} from '../../src/engine/ticket-puzzle';
import { projectRoomView } from '../../src/engine/view-projector';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  performGameAction,
  reserveRoom,
} from '../../src/server/services/room-service';
import { resetRateLimits } from '../../src/server/auth/rate-limit';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-wave2-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const NAMES = ['توحید', 'امیرعلی', 'علیرضا', 'سارا', 'مریم', 'نیما', 'لیلا', 'کیان'];

describe('موج ۲ — گراف حلقوی بلیط‌ها: هیچ‌کس بیکار نمی‌ماند (N=3..8)', () => {
  it.each([3, 4, 5, 6, 7, 8])(
    'برای N=%i کلید بلیط هر نفر دست نفر قبلی حلقه است و کل تیم با همکاری هم معما را حل و در را باز می‌کند',
    async (n) => {
      resetRateLimits();
      const repo = new SqliteRoomRepository(path.join(tmpDir, `cycle-${n}.db`));
      const names = NAMES.slice(0, n).map((x, i) => `${x} ${i + 1}`);
      const reservation = await reserveRoom({ playerCount: n, playerNames: names }, repo);
      const state = await repo.getRoom(reservation.roomCode);
      expect(state).not.toBeNull();

      // هر بازیکن فقط نمای خودش را می‌بیند؛ کوپن دست او کلید نفر بعدی حلقه است
      const views = state!.seats.map((_, i) => projectRoomView(state!, i, Date.now()));
      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        expect(views[i]!.myHeldTickets.companionStub.targetTeammateName).toBe(names[next]);
        expect(views[i]!.myHeldTickets.mainTicket.revealedGoldenDigit).toBeNull();
        // اطلاعات بلیط خودم (نماد/پرده) در نمای خودم نیست؛ فقط در کوپن نفر قبلی است
        const holder = views[(i - 1 + n) % n]!;
        expect(holder.myHeldTickets.companionStub.targetTeammateName).toBe(names[i]);
      }

      // شبیه‌سازی بازی واقعی: هر نفر از کوپن نفر قبلی + پوستر چپ + جدول راست، پانچ درست را استخراج می‌کند
      for (let i = 0; i < n; i++) {
        const holderView = views[(i - 1 + n) % n]!;
        const stub = holderView.myHeldTickets.companionStub;
        const emblem = stub.targetEmblem as TheaterEmblemId;
        const actNumber = LEFT_WALL_PLAYBILL.find(
          (p) => p.sceneTitle === stub.targetActSceneTitle,
        )?.actNumber as PlayActNumber;
        const rowCode = RIGHT_WALL_ROW_CHART.find(
          (r) => r.rowTitle === views[i]!.myHeldTickets.mainTicket.alleyRowHintName,
        )?.romanCode as RowRomanCode;
        expect(actNumber).toBeDefined();
        expect(rowCode).toBeDefined();
        const token = reservation.invites[i]!.seatToken;
        const outcome = await performGameAction(
          reservation.roomCode,
          token,
          { type: 'PUNCH_MY_TICKET', emblem, actNumber, rowCode },
          repo,
        );
        expect(outcome.accepted).toBe(true);
      }

      // حالا رقم طلایی همه آشکار است؛ کد فارسیِ N رقمی به ترتیب صندلی در را باز می‌کند
      const after = await repo.getRoom(reservation.roomCode);
      const hostView = projectRoomView(after!, 0, Date.now());
      const digits = hostView.players.map((p) => p.revealedDoorDigit);
      expect(digits.every((d) => d !== null)).toBe(true);
      const faCode = digits.map((d) => toFaDigits(d as number)).join('');
      const unlocked = await performGameAction(
        reservation.roomCode,
        reservation.invites[0]!.seatToken,
        { type: 'UNLOCK_THEATER_DOOR', code: faCode },
        repo,
      );
      expect(unlocked.accepted).toBe(true);
      expect(unlocked.roomView.phase).toBe('door_cutscene');
      expect(unlocked.roomView.cutsceneStartedAt).not.toBeNull();
      repo.close();
    },
  );

  it('به ازای هر صندلی دقیقاً یک ترکیب پانچ درست وجود دارد (بررسی همه ۱۲۸ ترکیب)', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      for (const seed of [1, 42, 14050729, 987654321]) {
        const targets = generateTicketTargets(seed, n);
        expect(targets).toHaveLength(n);
        for (const target of targets) {
          let correct = 0;
          for (const emblem of ['mask', 'violin', 'dancer', 'candelabra', 'rose', 'swan', 'hourglass', 'bell'] as const) {
            for (const actNumber of [1, 2, 3, 4] as const) {
              for (const rowCode of ['I', 'II', 'III', 'IV'] as const) {
                if (isCorrectPunch(target, { emblem, actNumber, rowCode })) correct++;
              }
            }
          }
          expect(correct).toBe(1);
          expect(target.goldenDigit).toBeGreaterThanOrEqual(1);
          expect(target.goldenDigit).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it('پانچ اشتباه و باز کردن در پیش از پانچ همه رد می‌شود؛ کد در فقط با ارقام همه کامل می‌شود', async () => {
    resetRateLimits();
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'wrong.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
      repo,
    );
    const token0 = reservation.invites[0]!.seatToken;
    const early = await performGameAction(
      reservation.roomCode,
      token0,
      { type: 'UNLOCK_THEATER_DOOR', code: '111' },
      repo,
    );
    expect(early.accepted).toBe(false);
    expect(early.code).toBe('TICKETS_NOT_ALL_PUNCHED');

    const state = await repo.getRoom(reservation.roomCode);
    const target0 = state!.targets[0]!;
    const wrong = await performGameAction(
      reservation.roomCode,
      token0,
      {
        type: 'PUNCH_MY_TICKET',
        emblem: target0.targetEmblem === 'mask' ? 'bell' : 'mask',
        actNumber: target0.targetAct,
        rowCode: target0.targetRowCode,
      },
      repo,
    );
    expect(wrong.accepted).toBe(false);
    expect(wrong.code).toBe('TICKET_WRONG_PUNCH');
    expect(normalizeDoorCode(toFaDigits('123'))).toBe('123');
    repo.close();
  });
});
