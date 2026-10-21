/**
 * preview-room.ts — داده نمایشی محلی صفحه /preview/cinema (موج ۲ علیرضا)
 * ------------------------------------------------------------------------------
 * تا وقتی createPreviewRoomState توحید در src/client-sdk آماده شود، پیش‌نمایش علیرضا
 * با همین فیکسچر محلی (داخل پوشه خودش) کار می‌کند تا توسعه موازی متوقف نشود؛
 * بعداً فقط منبع ساخت ClientRoomView عوض می‌شود و کامپوننت‌های موج ۲ دست نمی‌خورند.
 * چیدمان صندلی‌ها در این فیکسچر: همه پلیرها در ردیف ۲ (و نفرات ۶ تا ۸ در ردیف ۳)
 * می‌نشینند تا علیرضا (صندلی ۳ ردیف ۲ — وسط سالن) هم‌تیمی چپ و راست داشته باشد.
 */

import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type ClientRoomView,
  type PlayerSeatPublicView,
} from '@/contracts/types';

const NAME_POOL = ['توحید', 'امیرعلی', 'علیرضا', 'سارا', 'امیر', 'مریم', 'رضا', 'نگار'] as const;

const SEAT_POSITIONS: ReadonlyArray<{ row: 1 | 2 | 3 | 4; col: 1 | 2 | 3 | 4 | 5 }> = [
  { row: 2, col: 1 },
  { row: 2, col: 2 },
  { row: 2, col: 3 },
  { row: 2, col: 4 },
  { row: 2, col: 5 },
  { row: 3, col: 2 },
  { row: 3, col: 3 },
  { row: 3, col: 4 },
];

function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export function createPreviewCutsceneRoom(playerCountInput = 4): ClientRoomView {
  const playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(playerCountInput)));
  const now = Date.now();

  const players: PlayerSeatPublicView[] = Array.from({ length: playerCount }, (_, seatIndex) => {
    const seat = SEAT_POSITIONS[seatIndex];
    return {
      seatIndex,
      playerId: `preview-player-${seatIndex + 1}`,
      playerName: NAME_POOL[seatIndex],
      auditoriumRow: seat.row,
      auditoriumCol: seat.col,
      seatLabel: `ردیف ${toFaDigits(seat.row)} — صندلی ${toFaDigits(seat.col)}`,
      joined: true,
      hasWatchedInvitation: true,
      ticketPunched: true,
      revealedDoorDigit: (seatIndex * 3 + 2) % 10,
      isOnline: true,
      lastSeenAt: now,
    };
  });

  const me = players[2]; // علیرضا — وسط ردیف دوم سالن
  const nextTeammate = players[(me.seatIndex + 1) % playerCount];

  return {
    roomCode: 'ORFEO2',
    version: 1,
    phase: 'theater_cutscene',
    playerCount,
    maxAuditoriumSeats: 20,
    serverNow: now,
    cutsceneStartedAt: now,
    restartedInTheaterAt: null,
    me,
    players,
    myHeldTickets: {
      mainTicket: {
        ownerName: me.playerName,
        seatLabel: me.seatLabel,
        playTitle: 'پرده سرخ — اجرای امشب تماشاخانه اُرفه‌ئو',
        alleyRowHintName: 'ردیف مخمل سرخ',
        selectedPunch: { emblem: 'mask', actNumber: 1, rowCode: 'II' },
        isValidated: true,
        revealedGoldenDigit: me.revealedDoorDigit,
      },
      companionStub: {
        targetTeammateName: nextTeammate.playerName,
        targetEmblem: 'violin',
        targetActSceneTitle: 'پرده دوم — آواز قو',
        whisperNote: 'این کوپن، کلید بلیط هم‌تیمی توست؛ در بازی واقعی باید آن را برایش بخوانی.',
      },
    },
    alley: {
      leftWallPlaybill: [1, 2, 3, 4].map((act) => ({
        actNumber: act as 1 | 2 | 3 | 4,
        sceneTitle: `پرده ${toFaDigits(act)}`,
        description: 'داده نمایشی Preview — در بازی واقعی از سرور توحید می‌آید.',
      })),
      rightWallRowChart: [
        { rowTitle: 'ردیف سنگی', romanCode: 'I' },
        { rowTitle: 'ردیف مخمل سرخ', romanCode: 'II' },
        { rowTitle: 'ردیف نقره‌ای', romanCode: 'III' },
        { rowTitle: 'ردیف طلایی', romanCode: 'IV' },
      ],
      doorLockState: {
        punchedCount: playerCount,
        requiredCount: playerCount,
        attempts: 1,
        lastAttemptFeedback: null,
      },
    },
    auditorium: null,
    messages: [],
  };
}
