// src/contracts/types.ts
//
// ⚠️ قرارداد منجمد مشترک تیم (Frozen Shared Contract) — منبع: API-CONTRACT.md بخش ۱
// این فایل در «گام ۰ مشترک» ساخته شده و بدون توافق هر سه عضو (توحید، امیرعلی، علیرضا)
// نباید تغییر کند.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;
export const MAX_AUDITORIUM_SEATS = 20; // ۴ ردیف ۵تایی پلکانی در سالن کوچک

// طول زمان‌بندی دقیق سکانس‌های سینمایی (بر حسب میلی‌ثانیه)
export const INVITATION_VIDEO_DURATION_MS = 16_000;
export const DOOR_CUTSCENE_DURATION_MS = 11_000;
export const THEATER_CUTSCENE_DURATION_MS = 63_000;
export const TOTAL_CUTSCENE_DURATION_MS =
  DOOR_CUTSCENE_DURATION_MS + THEATER_CUTSCENE_DURATION_MS; // 74_000ms

/**
 * چرخه فازهای فصل اول بازی:
 * 1. alley_puzzle     -> بیرون سالن تئاتر (ویدیوی کارت دعوت + معمای بلیط‌های دست پلیرها)
 * 2. door_cutscene    -> کات‌سین POV دم درب: تحویل بلیط به دربان و باز شدن در
 * 3. theater_cutscene -> کات‌سین POV سالن ۲۰ نفره: اجرای اپرا تا وحشت، سقوط لوستر و غیب شدن
 * 4. in_theater       -> شروع مجدد بازی دقیقاً داخل همان سالن تاریک با موسیقی ترسناک (پایان فصل ۱)
 */
export type GamePhase =
  | 'alley_puzzle'
  | 'door_cutscene'
  | 'theater_cutscene'
  | 'in_theater';

export type TheaterEmblemId =
  | 'mask'       // 🎭 نقاب نمایش
  | 'violin'     // 🎻 ویولن کلاسیک
  | 'dancer'     // 🩰 رقصنده ایتالیایی
  | 'candelabra' // 🕯️ شمعدان نقره
  | 'rose'       // 🌹 رز مخملی
  | 'swan'       // 🦢 قو سفید
  | 'hourglass'  // ⏳ ساعت شنی
  | 'bell';      // 🔔 زنگ پرده

export type PlayActNumber = 1 | 2 | 3 | 4;
export type RowRomanCode = 'I' | 'II' | 'III' | 'IV';

/**
 * مراحل زمانی دقیق کات‌سین برای هماهنگی ۱۰۰٪ تصویر (علیرضا) و صدا (علیرضا) و سرور (توحید)
 */
export type CutsceneBeatId =
  | 'door_usher_collects_tickets'   // 00s - 11s: تحویل بلیط‌های رمزگشایی‌شده دم درب و باز شدن در
  | 'enter_20_seat_tiered_salon'    // 11s - 21s: ورود به سالن حداکثر ۲۰ نفره و نشستن فقط پلیرها
  | 'classical_music_curtain_dance' // 21s - 31s: آهنگ کلاسیک، نور ضعیف، باز شدن پرده ۳ سِن و رقص خانم ایتالیایی
  | 'tall_dark_man_left_shadow'     // 31s - 40s: ایستادن مرد بلندقد سیاه‌پوش در تاریکی چپ صحنه و نگاه با لذت
  | 'man_walks_claps_extends_hand'  // 40s - 46s: نزدیک شدن آرام مرد، ایستادن پایین سِن، دست زدن و دراز کردن دست
  | 'woman_sings_rejects_hand'      // 46s - 50s: بی‌توجهی زن، حرکت چپ‌وراست، آواز خواندن و پس زدن دست مرد
  | 'red_filthy_inversion_terror'   // 50s - 53s: قرمز شدن نور، کثیف شدن صحنه، دارک شدن فضا و ترسیدن زن
  | 'man_glares_pushes_players'     // 53s - 56s: نگاه مستقیم مرد به پلیرها و عقب زدن همه‌ی پلیرها روی صندلی
  | 'choke_slams_shake_chandelier'  // 56s - 67s: گرفتن گلو از دور، کوبیدن به در/دیوار/زمین/سقف، لرزش، کج شدن تابلوها و سقوط لوستر
  | 'vanish_dark_music_remains';    // 67s - 74s: غیب شدن زن و مرد، ادامه آهنگ ترسناک و تاریک ماندن فضا

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

// --- اطلاعات عمومی هر یک از ۳ تا ۸ بازیکن ---
export interface PlayerSeatPublicView {
  seatIndex: number;           // 0 .. (playerCount - 1)
  playerId: string;
  playerName: string;          // نام واقعی واردشده هنگام رزرو
  auditoriumRow: 1 | 2 | 3 | 4; // جایگاه در سالن پلکانی ۲۰ نفره
  auditoriumCol: 1 | 2 | 3 | 4 | 5;
  seatLabel: string;           // مثلاً «ردیف ۱ — صندلی ۲»
  joined: boolean;             // آیا لینک دعوت خود را باز کرده است؟
  hasWatchedInvitation: boolean;
  ticketPunched: boolean;      // آیا بلیط دست خودش را درست رمزگشایی و پانچ کرده است؟
  revealedDoorDigit: number | null; // فقط پس از پانچ صحیح بلیط همان بازیکن آشکار می‌شود!
  isOnline: boolean;
  lastSeenAt: number | null;
}

// --- بلیط‌هایی که فقط بازیکن فعلی (`me`) در دستان اول‌شخص خود دارد ---
export interface HeldTicketsInHandView {
  mainTicket: {
    ownerName: string;
    seatLabel: string;
    playTitle: string;
    alleyRowHintName: string; // ارجاع به جدول سمت راست کوچه
    selectedPunch: {
      emblem: TheaterEmblemId;
      actNumber: PlayActNumber;
      rowCode: RowRomanCode;
    } | null;
    isValidated: boolean;
    revealedGoldenDigit: number | null; // رقم طلایی خط برش پس از پانچ موفق
  };
  companionStub: {
    targetTeammateName: string; // نام هم‌تیمی بعدی در حلقه که این کوپن متعلق به بلیط اوست!
    targetEmblem: TheaterEmblemId;
    targetActSceneTitle: string; // عنوان پرده‌ای که شماره‌اش روی پوستر سمت چپ کوچه است
    whisperNote: string;         // متن داستانی کوتاه پشت کوپن
  };
}

// --- سرنخ‌های محیطی دیوار چپ و راست کوچه در نمای اول‌شخص ---
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
    requiredCount: number; // برابر با playerCount (3..8)
    attempts: number;
    lastAttemptFeedback: string | null;
  };
}

// --- وضعیت سالن تاریک پس از پایان کات‌سین و شروع مجدد بازی ---
export interface DarkAuditoriumRestartState {
  horrorMusicActive: true;
  chandelierShatteredOnFloor: true;
  wallPaintingsCrooked: true;
  performersVanished: true;
  inspectedHotspots: Record<AuditoriumHotspotId, string[]>; // نام بازیکنانی که هر بخش را بررسی کرده‌اند
  chapterStatusBanner: string; // پیام وضعیت آغاز مجدد بازی در سالن و آمادگی ادامه سناریو
}

export interface ChatMessageView {
  id: string;
  senderName: string;
  type: 'whisper' | 'ticket_share' | 'system';
  text: string;
  createdAt: number;
}

// --- نمای کامل و امن ارسالی سرور برای هر بازیکن ---
export interface ClientRoomView {
  roomCode: string;
  version: number;
  phase: GamePhase;
  playerCount: number; // 3 .. 8
  maxAuditoriumSeats: 20;
  serverNow: number;
  cutsceneStartedAt: number | null; // مبنای همگام‌سازی میلی‌ثانیه‌ای کات‌سین
  restartedInTheaterAt: number | null;
  me: PlayerSeatPublicView;
  players: PlayerSeatPublicView[];
  myHeldTickets: HeldTicketsInHandView; // فقط بلیط‌های دست شخص خود بازیکن!
  alley: AlleyEnvironmentView;
  auditorium: DarkAuditoriumRestartState | null;
  messages: ChatMessageView[];
}

// خروجی هنگام رزرو اولیه اتاق توسط میزبان (شامل لینک اختصاصی هر نفر با نامش)
export interface HostReservationResult {
  roomCode: string;
  playerCount: number;
  invites: Array<{
    seatIndex: number;
    playerName: string;
    seatLabel: string;
    seatToken: string;
    invitePath: string; // "/invite/K8P4M2/<seatToken>"
  }>;
}
