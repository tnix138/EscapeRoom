// src/contracts/types.ts — تایپ‌های مشترک منجمد (Single Source of Truth)
// منبع: API-CONTRACT.md بخش ۱ — تغییر این فایل فقط با توافق هر سه عضو تیم.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const MAX_AUDITORIUM_SEATS = 20; // ۴ ردیف ۵تایی پلکانی در سالن کوچک

// طول زمان‌بندی دقیق سکانس‌های سینمایی (بر حسب میلی‌ثانیه)
export const INVITATION_VIDEO_DURATION_MS = 16_000;
export const DOOR_CUTSCENE_DURATION_MS = 11_000;
export const THEATER_CUTSCENE_DURATION_MS = 63_000;
export const TOTAL_CUTSCENE_DURATION_MS =
  DOOR_CUTSCENE_DURATION_MS + THEATER_CUTSCENE_DURATION_MS; // 74_000ms

export type GamePhase =
  | 'alley_puzzle'
  | 'door_cutscene'
  | 'theater_cutscene'
  | 'in_theater';

export type TheaterEmblemId =
  | 'mask' // 🎭 نقاب نمایش
  | 'violin' // 🎻 ویولن کلاسیک
  | 'dancer' // 🩰 رقصنده ایتالیایی
  | 'candelabra' // 🕯️ شمعدان نقره
  | 'rose' // 🌹 رز مخملی
  | 'swan' // 🦢 قو سفید
  | 'hourglass' // ⏳ ساعت شنی
  | 'bell'; // 🔔 زنگ پرده

export type PlayActNumber = 1 | 2 | 3 | 4;
export type RowRomanCode = 'I' | 'II' | 'III' | 'IV';

export type CutsceneBeatId =
  | 'door_usher_collects_tickets' // 00s - 11s
  | 'enter_20_seat_tiered_salon' // 11s - 21s
  | 'classical_music_curtain_dance' // 21s - 31s
  | 'tall_dark_man_left_shadow' // 31s - 40s
  | 'man_walks_claps_extends_hand' // 40s - 46s
  | 'woman_sings_rejects_hand' // 46s - 50s
  | 'red_filthy_inversion_terror' // 50s - 53s
  | 'man_glares_pushes_players' // 53s - 56s
  | 'choke_slams_shake_chandelier' // 56s - 67s
  | 'vanish_dark_music_remains'; // 67s - 74s

export type AuditoriumHotspotId =
  | 'shattered-chandelier'
  | 'crooked-paintings'
  | 'three-dark-stages'
  | 'locked-exit-doors';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'ROOM_NOT_FOUND'
  | 'INVALID_SEAT_TOKEN'
  | 'TICKET_WRONG_PUNCH'
  | 'TICKETS_NOT_ALL_PUNCHED'
  | 'WRONG_DOOR_COMBINATION'
  | 'CUTSCENE_LOCKED'
  | 'INVALID_PHASE'
  | 'RATE_LIMITED'
  | 'CONFLICT_RETRY_EXHAUSTED'
  | 'INTERNAL_ERROR';

export interface PlayerSeatPublicView {
  seatIndex: number;
  playerId: string;
  playerName: string;
  auditoriumRow: 1 | 2 | 3 | 4;
  auditoriumCol: 1 | 2 | 3 | 4 | 5;
  seatLabel: string;
  joined: boolean;
  hasWatchedInvitation: boolean;
  ticketPunched: boolean;
  revealedDoorDigit: number | null;
  isOnline: boolean;
  lastSeenAt: number | null;
}

export interface HeldTicketsInHandView {
  mainTicket: {
    ownerName: string;
    seatLabel: string;
    playTitle: string;
    alleyRowHintName: string;
    selectedPunch: {
      emblem: TheaterEmblemId;
      actNumber: PlayActNumber;
      rowCode: RowRomanCode;
    } | null;
    isValidated: boolean;
    revealedGoldenDigit: number | null;
  };
  companionStub: {
    targetTeammateName: string;
    targetEmblem: TheaterEmblemId;
    targetActSceneTitle: string;
    whisperNote: string;
  };
}

export interface AlleyEnvironmentView {
  leftWallPlaybill: Array<{
    actNumber: PlayActNumber;
    sceneTitle: string;
    description: string;
  }>;
  rightWallRowChart: Array<{
    rowTitle: string;
    romanCode: RowRomanCode;
  }>;
  doorLockState: {
    punchedCount: number;
    requiredCount: number;
    attempts: number;
    lastAttemptFeedback: string | null;
  };
}

export interface DarkAuditoriumRestartState {
  horrorMusicActive: true;
  chandelierShatteredOnFloor: true;
  wallPaintingsCrooked: true;
  performersVanished: true;
  inspectedHotspots: Record<AuditoriumHotspotId, string[]>;
  chapterStatusBanner: string;
}

export interface ChatMessageView {
  id: string;
  senderName: string;
  type: 'whisper' | 'ticket_share' | 'system';
  text: string;
  createdAt: number;
}

export interface ClientRoomView {
  roomCode: string;
  version: number;
  phase: GamePhase;
  playerCount: number;
  maxAuditoriumSeats: 20;
  serverNow: number;
  cutsceneStartedAt: number | null;
  restartedInTheaterAt: number | null;
  me: PlayerSeatPublicView;
  players: PlayerSeatPublicView[];
  myHeldTickets: HeldTicketsInHandView;
  alley: AlleyEnvironmentView;
  auditorium: DarkAuditoriumRestartState | null;
  messages: ChatMessageView[];
}

export interface HostReservationResult {
  roomCode: string;
  playerCount: number;
  invites: Array<{
    seatIndex: number;
    playerName: string;
    seatLabel: string;
    seatToken: string;
    invitePath: string;
  }>;
}
