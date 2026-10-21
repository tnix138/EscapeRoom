// src/client-sdk/preview-fixtures.ts
// داده شبیه‌ساز آماده برای توسعه موازی امیرعلی و علیرضا در صفحات /preview/*
// تحویل موج ۱ توحید: از دقیقه اول، بدون نیاز به سرور/دیتابیس، ClientRoomView واقعی می‌سازد.
import type { ClientRoomView, GamePhase } from '../contracts/types';
import { createInitialRoomState, tickPhaseByClock } from '../engine/index';
import { projectRoomView } from '../engine/view-projector';

export const PREVIEW_PLAYER_NAMES = [
  'توحید',
  'امیرعلی',
  'علیرضا',
  'سارا',
  'مریم',
  'نیما',
  'لیلا',
  'کیان',
] as const;

const PREVIEW_SEED = 14050729;

/**
 * ساخت ClientRoomView نمونه برای هر فاز و هر تعداد بازیکن (۳ تا ۸).
 * بازیکن «من» همیشه صندلی ۰ است؛ در فازهای کات‌سین/سالن، همه بلیط‌ها پانچ‌شده فرض می‌شوند.
 */
export function createPreviewRoomState(
  phase: GamePhase,
  playerCount = 3,
  playerNames?: string[],
): ClientRoomView {
  const count = Math.min(8, Math.max(3, playerCount));
  const names = (playerNames ?? [...PREVIEW_PLAYER_NAMES]).slice(0, count);
  while (names.length < count) names.push(`بازیکن ${names.length + 1}`);

  const now = Date.now();
  const state = createInitialRoomState({
    code: 'PREVIEW',
    playerNames: names,
    // در فیكسچر پیش‌نمایش نیازی به هش واقعی نیست؛ projector هرگز هش را به کلاینت نمی‌دهد
    seatTokenHashes: names.map((_, i) => `preview-hash-${i}`),
    seed: PREVIEW_SEED,
    now,
  });
  state.seats.forEach((seat) => {
    seat.joined = true;
    seat.hasWatchedInvitation = phase !== 'alley_puzzle';
    seat.lastSeenAt = now;
  });
  state.messages = [
    {
      id: 'preview-msg-1',
      senderName: 'سامانهٔ تالار',
      type: 'system',
      text: 'به تماشاخانهٔ اُرفه‌ئو خوش آمدید؛ کوپن دستتان را برای هم‌تیمی‌تان بخوانید.',
      createdAt: now,
    },
  ];

  if (phase !== 'alley_puzzle') {
    state.seats.forEach((seat, i) => {
      seat.ticketPunched = true;
      const t = state.targets[i] as (typeof state.targets)[number];
      seat.selectedPunch = {
        emblem: t.targetEmblem,
        actNumber: t.targetAct,
        rowCode: t.targetRowCode,
      };
    });
    // شروع کات‌سین طوری تنظیم می‌شود که tick ساعت، فاز درخواستی را بدهد
    state.phase = 'door_cutscene';
    state.cutsceneStartedAt =
      phase === 'door_cutscene' ? now : phase === 'theater_cutscene' ? now - 11_000 : now - 74_000;
    tickPhaseByClock(state, now);
  }

  return projectRoomView(state, 0, now);
}
