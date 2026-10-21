# 📜 قرارداد رابط برنامه‌نویسی و مرزهای ماژولار (API & Component Contract)

> **منبع حقیقت واحد (Single Source of Truth) برای توحید، امیرعلی و علیرضا:**
> این سند قرارداد دقیق بین هر سه بخش پروژه **«پرده سرخ: تماشاخانه اُرفه‌ئو» (بخش آغازین)** است. به لطف این قرارداد و داده‌های شبیه‌ساز (`Mock Fixtures`)، **توحید، امیرعلی و علیرضا می‌توانند از دقیقه اول به صورت ۱۰۰٪ موازی کد بزنند بدون اینکه منتظر آماده شدن کدهای نفر دیگر بمانند.**

---

## بخش ۱: تایپ‌های مشترک منجمد (`src/contracts/types.ts`)

```ts
// src/contracts/types.ts

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
```

---

## بخش ۲: قرارداد اکشن‌های بازیکن (`GameActionPayload`)

```ts
// src/contracts/actions.ts

import type {
  AuditoriumHotspotId,
  PlayActNumber,
  RowRomanCode,
  TheaterEmblemId,
} from './types';

export type GameActionPayload =
  | {
      type: 'COMPLETE_INVITATION_VIDEO';
    }
  | {
      type: 'PUNCH_MY_TICKET';
      emblem: TheaterEmblemId;
      actNumber: PlayActNumber;
      rowCode: RowRomanCode;
    }
  | {
      type: 'UNLOCK_THEATER_DOOR';
      code: string; // رشته N رقمی متناظر با بلیط‌های پانچ‌شده صندلی ۱ تا N (پشتیبانی از ارقام فارسی و انگلیسی)
    }
  | {
      type: 'INSPECT_AUDITORIUM_HOTSPOT';
      hotspotId: AuditoriumHotspotId;
    };
```

---

## بخش ۳: قرارداد شبکه — REST API + Realtime Stream (توسط توحید)

1. **`GET /api/health`**
   - پاسخ `200`: `{ ok: true, data: { status: "healthy", storageDriver: "sqlite" | "supabase", serverNow: number } }`

2. **`POST /api/rooms` — رزرو اتاق ۳ تا ۸ نفره و تولید لینک‌های اختصاصی نام‌دار**
   - ورودی: `{ playerCount: number /* 3..8 */, playerNames: string[] /* طول دقیقاً برابر playerCount */ }`
   - خروجی `201`: `{ ok: true, data: HostReservationResult }`

3. **`GET /api/rooms/[code]?sinceVersion=0` — دریافت وضعیت فعلی با توکن صندلی**
   - هدر الزامی: `X-Seat-Token: <seatToken>`
   - وظیفه خودکار سمت سرور در هر فراخوانی:
     - علامت‌گذاری `joined = true` و به‌روزرسانی `lastSeenAt` برای آن بازیکن؛
     - پیشبرد خودکار فاز بر اساس ساعت سرور (`alley_puzzle -> door_cutscene (0..11s) -> theater_cutscene (11..74s) -> in_theater (>=74s)`) و ذخیره پایدار در دیتابیس!
   - خروجی `200`: `{ ok: true, data: { unchanged: false, roomView: ClientRoomView } }` (یا `{ unchanged: true, version, serverNow }`).

4. **`POST /api/rooms/[code]/action` — ثبت تعامل بازیکن**
   - هدر الزامی: `X-Seat-Token: <seatToken>`
   - ورودی: `GameActionPayload`
   - قانون امنیتی: اگر اتاق در فاز `door_cutscene` یا `theater_cutscene` باشد، سرور خطای `409 CUTSCENE_LOCKED` برمی‌گرداند.
   - خروجی `200`: `{ ok: true, data: { accepted: boolean, message: string, roomView: ClientRoomView } }`

5. **`POST /api/rooms/[code]/chat` — نجوای تیمی و اشتراک مشخصات بلیط**
   - هدر الزامی: `X-Seat-Token: <seatToken>`
   - ورودی: `{ text: string, shareStub?: boolean }`
   - خروجی `200`: `{ ok: true, data: { roomView: ClientRoomView } }`

6. **`GET /api/rooms/[code]/stream?token=<seatToken>&sinceVersion=0` — استریم بلادرنگ SSE**
   - ارسال فوری `event: room_update` به محض تغییر نسخه اتاق + `event: heartbeat` حاوی `serverNow` برای حفظ همگام‌سازی دقیق کات‌سین.

---

## بخش ۴: قرارداد کامپوننت‌های دیداری و صوتی (مرز مستقیم امیرعلی ⟷ علیرضا ⟷ توحید)

برای اینکه پس از ادغام شاخه‌ها همه‌چیز در ثانیه اول به هم متصل شود، هر عضو دقیقاً کامپوننت‌ها/هوک‌های زیر را با امضای ثابت اکسپورت می‌کند:

### ۴.۱. اکسپورت توحید (`src/client-sdk/index.ts`)
```ts
export function reserveRoomApi(input: {
  playerCount: number;
  playerNames: string[];
}): Promise<HostReservationResult>;

export function useTheaterSession(
  roomCode: string,
  seatToken: string
): {
  loading: boolean;
  room: ClientRoomView | null;
  cutsceneElapsedMs: number; // محاسبه زنده بر پایه ساعت سرور
  error: string | null;
  performAction: (action: GameActionPayload) => Promise<{ accepted: boolean; message: string }>;
  sendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
};

// سازنده داده تستی آماده برای توسعه مستقل امیرعلی و علیرضا در صفحات /preview/*
export function createPreviewRoomState(
  phase: GamePhase,
  playerCount?: number
): ClientRoomView;
```

### ۴.۲. اکسپورت‌های امیرعلی (`src/components/invitation/InvitationCardVideo.tsx` و `src/components/alley/AlleyFirstPersonScene.tsx`)
```ts
export interface InvitationCardVideoProps {
  playerName: string;
  seatLabel: string;
  onComplete: () => void;
}

export interface AlleyFirstPersonSceneProps {
  room: ClientRoomView;
  onPunchTicket: (emblem: TheaterEmblemId, actNumber: PlayActNumber, rowCode: RowRomanCode) => Promise<{ accepted: boolean; message: string }>;
  onUnlockDoor: (code: string) => Promise<{ accepted: boolean; message: string }>;
  onSendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
  onReplayInvitation: () => void;
}
```

### ۴.۳. اکسپورت‌های علیرضا (`src/components/cinema/FirstPersonCutsceneStage.tsx` و `src/components/auditorium/DarkAuditoriumScene.tsx`)
```ts
export interface FirstPersonCutsceneStageProps {
  room: ClientRoomView;
  elapsedMs: number; // 0 .. 74_000ms (0..11_000 درب ورودی | 11_000..74_000 سالن تئاتر)
  muted: boolean;
  onToggleMute: () => void;
}

export interface DarkAuditoriumSceneProps {
  room: ClientRoomView;
  muted: boolean;
  onToggleMute: () => void;
  onInspectHotspot: (hotspotId: AuditoriumHotspotId) => Promise<void>;
  onSendWhisper: (text: string) => Promise<void>;
}
```
