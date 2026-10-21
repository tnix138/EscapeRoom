// تست مسیر کامل بازی (Issue #87 — QA تجربه)
// معیار: رزرو → کوچه → کات‌سین در → کات‌سین سالن → سالن تاریک → فرار، بدون هیچ
// پرش یا عقب‌گرد در ترتیب فازها؛ ساعت سرور و هم‌گام‌سازی کلاینت هر دو یک نتیجه بدهند.
import { describe, expect, it } from 'vitest';
import {
  DOOR_CUTSCENE_DURATION_MS,
  TOTAL_CUTSCENE_DURATION_MS,
  type GamePhase,
} from '../../src/contracts/types';
import {
  createDarkAuditoriumState,
  createInitialRoomState,
  tickPhaseByClock,
  type InternalRoomState,
} from '../../src/engine/index';
import { projectRoomView } from '../../src/engine/view-projector';
import { resolveRoomPhase } from '../../src/components/room/resolve-room-phase';
import { createPreviewRoomState } from '../../src/client-sdk/preview-fixtures';

const T0 = 1_700_000_000_000;
const PHASE_ORDER: GamePhase[] = ['alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater'];

function newRoom(playerCount = 3): InternalRoomState {
  return createInitialRoomState({
    code: 'QA-87',
    playerNames: ['سارا', 'مریم', 'نیما', 'کیان', 'لیلا', 'توحید', 'امیرعلی', 'علیرضا'].slice(0, playerCount),
    seatTokenHashes: Array.from({ length: playerCount }, (_, i) => `hash-${i}`),
    seed: 20261022,
    now: T0,
  });
}

describe('#87 — ترتیب فازهای مسیر بازی نقض نمی‌شود', () => {
  it('اتاق تازه همیشه از کوچه شروع می‌شود', () => {
    expect(newRoom().phase).toBe('alley_puzzle');
  });

  it('گذر ساعت هرگز از یک فاز به فاز قبلی برنمی‌گردد', () => {
    const room = newRoom();
    room.seats.forEach((seat) => {
      seat.joined = true;
      seat.hasWatchedInvitation = true;
      seat.ticketPunched = true;
    });
    room.cutsceneStartedAt = T0;
    room.phase = 'door_cutscene';

    let index = PHASE_ORDER.indexOf(room.phase);
    // هر ۵۰۰ میلی‌ثانیه یک تیک، تا ۱۰ ثانیه بعد از پایان کات‌سین
    for (let elapsed = 0; elapsed <= TOTAL_CUTSCENE_DURATION_MS + 10_000; elapsed += 500) {
      tickPhaseByClock(room, T0 + elapsed);
      const nextIndex = PHASE_ORDER.indexOf(room.phase);
      expect(nextIndex).toBeGreaterThanOrEqual(index);
      index = nextIndex;
    }
    expect(room.phase).toBe('in_theater');
  });

  it('مرزهای دقیق: ۰ تا ۱۱ ثانیه در، ۱۱ تا ۷۴ ثانیه سالن، بعد از آن سالن تاریک', () => {
    const room = newRoom();
    room.cutsceneStartedAt = T0;
    room.phase = 'door_cutscene';

    tickPhaseByClock(room, T0 + DOOR_CUTSCENE_DURATION_MS - 1);
    expect(room.phase).toBe('door_cutscene');

    tickPhaseByClock(room, T0 + DOOR_CUTSCENE_DURATION_MS);
    expect(room.phase).toBe('theater_cutscene');

    tickPhaseByClock(room, T0 + TOTAL_CUTSCENE_DURATION_MS - 1);
    expect(room.phase).toBe('theater_cutscene');

    expect(tickPhaseByClock(room, T0 + TOTAL_CUTSCENE_DURATION_MS)).toBe(true);
    expect(room.phase).toBe('in_theater');
    expect(room.restartedInTheaterAt).toBe(T0 + TOTAL_CUTSCENE_DURATION_MS);
  });

  it('هم‌گام‌سازی کلاینت با ساعت کات‌سین همان فاز سرور را می‌دهد (بدون پرش فصل)', () => {
    const cases: Array<[GamePhase, number]> = [
      ['alley_puzzle', 0],
      ['door_cutscene', 0],
      ['door_cutscene', DOOR_CUTSCENE_DURATION_MS + 5_000],
      ['theater_cutscene', 0],
      ['theater_cutscene', TOTAL_CUTSCENE_DURATION_MS - 1],
      ['theater_cutscene', TOTAL_CUTSCENE_DURATION_MS],
      ['in_theater', 0],
    ];
    for (const [phase, elapsed] of cases) {
      const room = newRoom();
      room.cutsceneStartedAt = T0 - elapsed;
      room.phase = phase;
      tickPhaseByClock(room, T0);
      expect(resolveRoomPhase(phase, elapsed)).toBe(room.phase);
    }
    // عقب بودن اسنپ‌شات SSE نباید کلاینت را به فصل قبل برگرداند
    expect(resolveRoomPhase('in_theater', 0)).toBe('in_theater');
    expect(resolveRoomPhase('alley_puzzle', TOTAL_CUTSCENE_DURATION_MS)).toBe('alley_puzzle');
  });
});

describe('#87 — خروجی کلاینت در هر فاز مسیر سالم است', () => {
  const phases: GamePhase[] = ['alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater'];

  it('در هر چهار فاز، نمای کلاینت ساخته می‌شود و توکن خام لو نمی‌رود', () => {
    for (const phase of phases) {
      for (const count of [3, 8]) {
        const view = createPreviewRoomState(phase, count);
        expect(view.phase).toBe(phase);
        expect(view.playerCount).toBe(count);
        expect(JSON.stringify(view)).not.toMatch(/hash-|preview-hash/);
        expect(JSON.stringify(view)).not.toMatch(/"seatTokenHash"|"seed"/);
      }
    }
  });

  it('پس از پایان کات‌سین، سالن تاریک با وضعیت کامل ترس شروع می‌شود', () => {
    const room = newRoom();
    room.cutsceneStartedAt = T0;
    room.phase = 'door_cutscene';
    tickPhaseByClock(room, T0 + TOTAL_CUTSCENE_DURATION_MS);

    const view = projectRoomView(room, 0, T0 + TOTAL_CUTSCENE_DURATION_MS);
    expect(view.phase).toBe('in_theater');

    const dark = createDarkAuditoriumState(room);
    expect(dark.horrorMusicActive).toBe(true);
    expect(dark.chandelierShatteredOnFloor).toBe(true);
    expect(dark.performersVanished).toBe(true);
    expect(dark.chapterStatusBanner).toContain('فصل اول');
  });

  it('شروع مجدد در سالن تاریک، بازیکن را به کوچه برنمی‌گرداند', () => {
    const room = newRoom(4);
    room.cutsceneStartedAt = T0;
    room.phase = 'in_theater';
    room.restartedInTheaterAt = T0 + TOTAL_CUTSCENE_DURATION_MS;
    // تیک‌های بعدی نباید فاز را تغییر دهند
    for (let i = 1; i <= 10; i += 1) {
      expect(tickPhaseByClock(room, T0 + TOTAL_CUTSCENE_DURATION_MS + i * 60_000)).toBe(false);
    }
    expect(room.phase).toBe('in_theater');
  });

  it('اتاق بدون شروع کات‌سین هرگز خودبه‌خود جلو نمی‌رود', () => {
    const room = newRoom();
    expect(tickPhaseByClock(room, T0 + 10 * 60_000)).toBe(false);
    expect(room.phase).toBe('alley_puzzle');
    expect(room.cutsceneStartedAt).toBeNull();
  });
});
