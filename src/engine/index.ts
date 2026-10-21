// src/engine/index.ts — ماشین وضعیت اتاق و پیشبرد خودکار فازهای ۴گانه
// نکته: InternalRoomState فقط سمت سرور است و هرگز مستقیم به کلاینت ارسال نمی‌شود؛
// خروجی کلاینت فقط از view-projector عبور می‌کند.
import {
  DOOR_CUTSCENE_DURATION_MS,
  TOTAL_CUTSCENE_DURATION_MS,
  type AuditoriumHotspotId,
  type ChatMessageView,
  type DarkAuditoriumRestartState,
  type GamePhase,
} from '../contracts/types';
import { generateTicketTargets, type TicketTarget } from './ticket-puzzle';

export interface InternalSeat {
  seatIndex: number;
  playerId: string;
  playerName: string;
  auditoriumRow: 1 | 2 | 3 | 4;
  auditoriumCol: 1 | 2 | 3 | 4 | 5;
  seatLabel: string;
  /** فقط هش SHA-256 توکن صندلی نگهداری می‌شود؛ متن خام هرگز ذخیره نمی‌شود */
  seatTokenHash: string;
  joined: boolean;
  hasWatchedInvitation: boolean;
  ticketPunched: boolean;
  selectedPunch: { emblem: string; actNumber: number; rowCode: string } | null;
  isOnline: boolean;
  lastSeenAt: number | null;
}

export interface InternalRoomState {
  code: string;
  version: number;
  phase: GamePhase;
  playerCount: number;
  seed: number;
  createdAt: number;
  updatedAt: number;
  cutsceneStartedAt: number | null;
  restartedInTheaterAt: number | null;
  seats: InternalSeat[];
  targets: TicketTarget[];
  doorAttempts: number;
  doorLastFeedback: string | null;
  messages: ChatMessageView[];
  inspectedHotspots: Record<AuditoriumHotspotId, string[]>;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export function toFaDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)] as string);
}

/** صندلی‌های سالن ۲۰ نفره: پر کردن پشت‌سرهم از ردیف ۱ تا بازیکنان در کات‌سین کنار هم دیده شوند */
export function auditoriumSeatForIndex(seatIndex: number): {
  auditoriumRow: 1 | 2 | 3 | 4;
  auditoriumCol: 1 | 2 | 3 | 4 | 5;
  seatLabel: string;
} {
  const row = (Math.floor(seatIndex / 5) + 1) as 1 | 2 | 3 | 4;
  const col = ((seatIndex % 5) + 1) as 1 | 2 | 3 | 4 | 5;
  return {
    auditoriumRow: row,
    auditoriumCol: col,
    seatLabel: `ردیف ${toFaDigits(row)} — صندلی ${toFaDigits(col)}`,
  };
}

export function createInitialRoomState(input: {
  code: string;
  playerNames: string[];
  seatTokenHashes: string[];
  seed: number;
  now: number;
}): InternalRoomState {
  const playerCount = input.playerNames.length;
  return {
    code: input.code,
    version: 1,
    phase: 'alley_puzzle',
    playerCount,
    seed: input.seed,
    createdAt: input.now,
    updatedAt: input.now,
    cutsceneStartedAt: null,
    restartedInTheaterAt: null,
    seats: input.playerNames.map((playerName, i) => ({
      seatIndex: i,
      playerId: `seat-${i + 1}`,
      playerName,
      ...auditoriumSeatForIndex(i),
      seatTokenHash: input.seatTokenHashes[i] as string,
      joined: false,
      hasWatchedInvitation: false,
      ticketPunched: false,
      selectedPunch: null,
      isOnline: false,
      lastSeenAt: null,
    })),
    targets: generateTicketTargets(input.seed, playerCount),
    doorAttempts: 0,
    doorLastFeedback: null,
    messages: [],
    inspectedHotspots: {
      'shattered-chandelier': [],
      'crooked-paintings': [],
      'three-dark-stages': [],
      'locked-exit-doors': [],
    },
  };
}

export function createDarkAuditoriumState(state: InternalRoomState): DarkAuditoriumRestartState {
  return {
    horrorMusicActive: true,
    chandelierShatteredOnFloor: true,
    wallPaintingsCrooked: true,
    performersVanished: true,
    inspectedHotspots: {
      'shattered-chandelier': [...state.inspectedHotspots['shattered-chandelier']],
      'crooked-paintings': [...state.inspectedHotspots['crooked-paintings']],
      'three-dark-stages': [...state.inspectedHotspots['three-dark-stages']],
      'locked-exit-doors': [...state.inspectedHotspots['locked-exit-doors']],
    },
    chapterStatusBanner:
      'کات‌سین به پایان رسید؛ بازی از همین سالن تاریک و به‌هم‌ریخته ادامه می‌یابد. (پایان فصل اول)',
  };
}

/**
 * پیشبرد خودکار فاز بر اساس ساعت سرور — در هر خواندن/نوشتن اتاق فراخوانی می‌شود.
 * true برمی‌گرداند اگر فاز تغییر کرده باشد (نیازمند ذخیره).
 */
export function tickPhaseByClock(state: InternalRoomState, now: number): boolean {
  if (state.cutsceneStartedAt === null) return false;
  const elapsed = now - state.cutsceneStartedAt;
  if (elapsed >= TOTAL_CUTSCENE_DURATION_MS && state.phase !== 'in_theater') {
    state.phase = 'in_theater';
    state.restartedInTheaterAt = state.cutsceneStartedAt + TOTAL_CUTSCENE_DURATION_MS;
    state.updatedAt = now;
    return true;
  }
  if (
    elapsed >= DOOR_CUTSCENE_DURATION_MS &&
    elapsed < TOTAL_CUTSCENE_DURATION_MS &&
    state.phase === 'door_cutscene'
  ) {
    state.phase = 'theater_cutscene';
    state.updatedAt = now;
    return true;
  }
  return false;
}
