# 📜 قرارداد رابط برنامه‌نویسی و مرزهای سیستم (API & Module Contract)

> **اهمیت حیاتی این سند:** این فایل **منبع حقیقت واحد (Single Source of Truth)** بین هر ۳ عضو تیم است. هیچ‌کدام از اعضای تیم برای شروع کدنویسی نیازی به خواندن کدهای نفر دیگر ندارند؛ کافی است دقیقاً امضاها، تایپ‌ها و مسیرهای تعریف‌شده در این سند را رعایت کنند.

---

## بخش ۱: قرارداد مشترک داده‌ها (`src/contracts/types.ts`)

تمام ماژول‌های بک‌اند (`نفر ۱`)، موتور بازی (`نفر ۲`) و رابط کاربری (`نفر ۳`) دقیقاً از تایپ‌های زیر استفاده می‌کنند:

```ts
// src/contracts/types.ts

export const MIN_PLAYERS_STANDARD = 3;
export const MAX_PLAYERS_PER_ROOM = 6;
export const GAME_DURATION_SECONDS = 45 * 60; // 2700s (45 minutes)
export const AIRLOCK_SYNC_WINDOW_MS = 12_000; // 12 seconds simultaneous window

export type RoleId = 'spectral' | 'cipher' | 'engineer';

export type ZoneId = 'cryo-bay' | 'command-deck' | 'quantum-lab' | 'airlock';

export type PuzzleId =
  | 'reactor-boot'
  | 'captain-safe'
  | 'laser-synthesis'
  | 'aegis-override'
  | 'airlock-sync';

export type ItemId =
  | 'plasma-fuse'
  | 'omega-keycard'
  | 'quantum-prism'
  | 'stabilized-core';

export type RoomStatus = 'lobby' | 'active' | 'escaped' | 'failed';

export type MirrorAngle = 0 | 90 | 180 | 270;
export type BreakerLineId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type AirlockStationId = 'alpha' | 'beta' | 'gamma';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_ALREADY_STARTED'
  | 'UNAUTHORIZED_PLAYER'
  | 'FORBIDDEN_HOST_ONLY'
  | 'NOT_ENOUGH_PLAYERS'
  | 'ROLES_INCOMPLETE'
  | 'PLAYERS_NOT_READY'
  | 'ZONE_LOCKED'
  | 'PUZZLE_LOCKED'
  | 'PUZZLE_ALREADY_SOLVED'
  | 'MISSING_ITEM'
  | 'WRONG_ANSWER'
  | 'COOLDOWN_ACTIVE'
  | 'RATE_LIMITED'
  | 'GAME_NOT_ACTIVE'
  | 'CONFLICT_RETRY_EXHAUSTED'
  | 'INTERNAL_ERROR';

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: ErrorCode;
    message: string; // پیام فارسی قابل نمایش به کاربر
    retryAfterMs?: number;
  };
}

export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// --- وضعیت عمومی بازیکن (بدون توکن امنیتی) ---
export interface PlayerPublicView {
  id: string;
  name: string;
  avatarColor: string;
  role: RoleId | null;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
  currentZone: ZoneId;
  lastSeenAt: number; // Unix timestamp (ms)
  isOnline: boolean;
  solvedCount: number;
}

// --- آیتم داخل کوله‌پشتی اشتراکی تیم ---
export interface InventoryItemView {
  id: ItemId;
  title: string;
  description: string;
  foundInZone: ZoneId;
  consumed: boolean;
  consumedByPuzzle?: PuzzleId;
}

// --- سرنخ‌های قابل مشاهده برای بازیکن فعلی در هر بخش ---
export interface ClueEntry {
  id: string;
  zoneId: ZoneId;
  roleRestriction: RoleId | 'public'; // فقط 'public' یا نقش خود بازیکن ارسال می‌شود!
  title: string;
  content: string;
  shareSummary: string; // متن کوتاه آماده ارسال با یک کلیک در چت تیم
}

// --- وضعیت عمومی هر یک از ۵ معما (بدون جواب!) ---
export interface AirlockStationPublicState {
  stationId: AirlockStationId;
  armedByPlayerId: string | null;
  armedByPlayerName: string | null;
  expiresAt: number | null; // Unix timestamp (ms)
  isActive: boolean;
}

export interface PuzzlePublicState {
  id: PuzzleId;
  zoneId: ZoneId;
  title: string;
  subtitle: string;
  status: 'locked' | 'available' | 'solved';
  solvedAt: number | null;
  solvedByPlayerName: string | null;
  attempts: number;
  cooldownUntil: number | null;
  requiredItems: ItemId[];
  installedItems: ItemId[];
  unlockedHints: string[]; // متن راهنمایی‌هایی که تاکنون باز شده‌اند
  totalHintsAvailable: number; // همیشه 2
  // داده‌های عمومی وضعیت فعلی پنل معما (صرفاً جهت نمایش وضعیت کلیدها، بدون افشای پاسخ صحیح)
  publicData: {
    // reactor-boot: توان اسمی نمایش داده‌شده یا برچسب کلیدها
    breakerLabels?: Record<BreakerLineId, string>;
    lastSubmittedSequence?: BreakerLineId[];
    // captain-safe: آخرین مقادیر تنظیم‌شده روی پیچ‌ها توسط تیم
    currentDialValues?: { alpha: number; beta: number; gamma: number };
    // laser-synthesis: زاویه فعلی ۴ آینه در اتاق (همگام بین همه اعضا!)
    mirrorAngles?: Record<'M1' | 'M2' | 'M3' | 'M4', MirrorAngle>;
    // airlock-sync: وضعیت زنده ۳ ایستگاه همزمان‌ساز مغناطیسی
    stations?: Record<AirlockStationId, AirlockStationPublicState>;
  };
}

export interface ZonePublicView {
  id: ZoneId;
  title: string;
  subtitle: string;
  ambientDescription: string;
  unlocked: boolean;
  puzzleIds: PuzzleId[];
}

export interface ChatMessageView {
  id: string;
  type: 'chat' | 'clue_share' | 'system';
  senderId: string | null;
  senderName: string;
  senderRole: RoleId | null;
  text: string;
  createdAt: number;
}

export interface TeamScoreSummary {
  escaped: boolean;
  elapsedSeconds: number;
  remainingSeconds: number;
  hintsUsed: number;
  wrongAttempts: number;
  score: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'F';
}

// --- نمای کامل و امن اتاق برای یک بازیکن مشخص ---
export interface ClientRoomView {
  code: string;
  version: number;
  status: RoomStatus;
  createdAt: number;
  startedAt: number | null;
  expiresAt: number | null;
  finishedAt: number | null;
  serverNow: number; // جهت کالیبراسیون دقیق تایمر کلاینت با ساعت سرور!
  minPlayers: number;
  maxPlayers: number;
  me: PlayerPublicView;
  players: PlayerPublicView[];
  zones: ZonePublicView[];
  puzzles: Record<PuzzleId, PuzzlePublicState>;
  visibleClues: ClueEntry[]; // فقط سرنخ‌های عمومی بخش‌های باز + سرنخ‌های نقش شخص `me`
  inventory: InventoryItemView[];
  messages: ChatMessageView[];
  summary: TeamScoreSummary | null;
}
```

---

## بخش ۲: قرارداد اکشن‌های بازی (`GameActionPayload`)

تمامی تعاملات بازیکنان در حین بازی در قالب یک Union Type واحد و کاملاً تایپ‌شده به سرور ارسال می‌شوند:

```ts
// src/contracts/actions.ts

import type {
  AirlockStationId,
  BreakerLineId,
  ItemId,
  MirrorAngle,
  PuzzleId,
  ZoneId,
} from './types';

export type GameActionPayload =
  | {
      type: 'MOVE_ZONE';
      zoneId: ZoneId;
    }
  | {
      type: 'INSTALL_ITEM';
      puzzleId: PuzzleId;
      itemId: ItemId;
    }
  | {
      type: 'SUBMIT_REACTOR';
      sequence: [BreakerLineId, BreakerLineId, BreakerLineId];
    }
  | {
      type: 'SUBMIT_SAFE';
      alpha: number; // 10..90
      beta: number;  // 10..90
      gamma: number; // 10..90
    }
  | {
      type: 'ROTATE_MIRROR';
      mirrorId: 'M1' | 'M2' | 'M3' | 'M4';
      angle: MirrorAngle;
    }
  | {
      type: 'FIRE_LASER';
    }
  | {
      type: 'SUBMIT_AEGIS_CODE';
      code: string; // ۴ رقم (پشتیبانی از فارسی و انگلیسی، مثلاً "۴۸۲۹" یا "4829")
    }
  | {
      type: 'ARM_AIRLOCK_STATION';
      stationId: AirlockStationId;
      confirmationCode: string; // کد ۲ رقمی ایستگاه (مثلاً "73" یا "۷۳")
    };

export interface ActionFeedback {
  solved?: boolean;
  puzzleId?: PuzzleId;
  message: string; // بازخورد فوری به بازیکن (مثلاً «پرتو در آینه M2 منحرف شد!» یا «قفل باز شد!»)
  roomView: ClientRoomView;
}
```

---

## بخش ۳: قرارداد شبکه — HTTP REST + Realtime SSE (`نفر ۱` ⟷ `نفر ۲/۳`)

### هدر احراز هویت در تمام درخواست‌های اتاق
- نام هدر: `X-Player-Token: <playerToken>`
- در درخواست استریم `EventSource` (که در مرورگر امکان ارسال هدر سفارشی ندارد): توکن از طریق Query Parameter امن `GET /api/rooms/[code]/stream?token=<playerToken>&sinceVersion=<number>` ارسال می‌شود و هرگز در پاسخ‌های عمومی لاگ یا بازگردانده نمی‌شود.

---

### ۳.۱. سلامت سرویس — `GET /api/health`
- **پاسخ `200 OK`:**
```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "storageDriver": "sqlite",
    "timestamp": 1792584000000
  }
}
```

---

### ۳.۲. ساخت اتاق جدید — `POST /api/rooms`
- **بدنه درخواست:**
```json
{
  "hostName": "آرش",
  "preferredRole": "spectral"
}
```
- **پاسخ `201 Created`:**
```json
{
  "ok": true,
  "data": {
    "roomCode": "K7M4P9",
    "playerId": "plr_9f8a7b6c",
    "playerToken": "a1b2c3d4...48chars",
    "roomView": { "...ClientRoomView..." }
  }
}
```

---

### ۳.۳. پیوستن به اتاق موجود — `POST /api/rooms/[code]/join`
- **بدنه درخواست:**
```json
{
  "playerName": "سارا",
  "preferredRole": "cipher",
  "reconnectToken": "اختیاری: اگر کاربر قبلاً عضو بوده و می‌خواهد بازیابی کند"
}
```
- **قوانین سرور:**
  - اگر `reconnectToken` معتبر ارسال شود، حتی اگر بازی در وضعیت `active` باشد، بازیکن دقیقاً به صندلی قبلی خود برمی‌گردد!
  - اگر بازیکن جدید باشد: اتاق باید در وضعیت `lobby` باشد و ظرفیت کمتر از `6` نفر داشته باشد (`ROOM_ALREADY_STARTED` یا `ROOM_FULL`).
- **پاسخ `200 OK`:** مشابه ساختار پاسخ ساخت اتاق (`roomCode`, `playerId`, `playerToken`, `roomView`).

---

### ۳.۴. دریافت وضعیت فعلی اتاق (و بازیابی پس از Refresh) — `GET /api/rooms/[code]?sinceVersion=0`
- **هدر الزامی:** `X-Player-Token: <playerToken>`
- **رفتار هوشمند Delta:**
  - سرور ابتدا `lastSeenAt` بازیکن و وضعیت انقضای تایمر اتاق را به‌روزرسانی می‌کند.
  - اگر `sinceVersion` ارسال شده باشد و برابر با `room.version` فعلی باشد (و هیچ تایمر قفل همزمان یا تایمر کل بازی منقضی نشده باشد)، پاسخ سریع زیر برمی‌گردد:
    ```json
    { "ok": true, "data": { "unchanged": true, "version": 14, "serverNow": 1792584012000 } }
    ```
  - در غیر این صورت:
    ```json
    { "ok": true, "data": { "unchanged": false, "roomView": { "...ClientRoomView..." } } }
    ```

---

### ۳.۵. تغییر نقش / وضعیت آمادگی / افزودن هم‌تیمی تمرینی در لابی — `POST /api/rooms/[code]/lobby`
- **هدر الزامی:** `X-Player-Token`
- **بدنه درخواست (Union):**
```json
{ "type": "SELECT_ROLE", "role": "engineer" }
// یا
{ "type": "SET_READY", "ready": true }
// یا (فقط توسط Host در لابی جهت تست/تمرین):
{ "type": "ADD_BOT", "role": "cipher" }
// یا
{ "type": "REMOVE_BOT", "botId": "bot_1" }
```
- **پاسخ `200 OK`:** `{ "ok": true, "data": { "roomView": { "...ClientRoomView..." } } }`

---

### ۳.۶. شروع بازی توسط میزبان — `POST /api/rooms/[code]/start`
- **هدر الزامی:** `X-Player-Token` (فقط سازنده اتاق `isHost === true`)
- **قوانین اعتبارسنجی سرور:**
  1. حداقل **۳ بازیکن** در اتاق حاضر باشند (`NOT_ENOUGH_PLAYERS` در صورت کمتر بودن از ۳ نفر).
  2. هر **۳ نقش تخصصی (`spectral`, `cipher`, `engineer`)** حداقل توسط یک عضو تیم انتخاب شده باشند (`ROLES_INCOMPLETE`).
  3. تمام بازیکنان انسانی وضعیت `ready: true` داشته باشند (`PLAYERS_NOT_READY`).
- **پاسخ `200 OK`:** `{ "ok": true, "data": { "roomView": { "...ClientRoomView..." } } }`

---

### ۳.۷. اجرای اکشن در حین بازی — `POST /api/rooms/[code]/action`
- **هدر الزامی:** `X-Player-Token`
- **بدنه درخواست:** شیء `GameActionPayload` (بخش ۲ همین سند)
- **نکته مهم در پاسخ اشتباه به معما:** اگر پاسخ معما اشتباه باشد، شمارنده `attempts` و `cooldownUntil` در دیتابیس **ذخیره می‌شود** و پاسخ `200 OK` با `solved: false` و `roomView` جدید برمی‌گردد تا همه اعضای تیم افزایش تلاش و کول‌داون را ببینند (کد خطای HTTP فقط برای درخواست نامعتبر یا خارج از نوبت برمی‌گردد).
- **پاسخ `200 OK`:** `{ "ok": true, "data": ActionFeedback }`

---

### ۳.۸. ارسال پیام چت یا اشتراک‌گذاری سریع سرنخ — `POST /api/rooms/[code]/chat`
- **هدر الزامی:** `X-Player-Token`
- **بدنه درخواست:**
```json
{
  "text": "بچه‌ها روی دیوار با نور UV عدد 85 رو دیدم!",
  "clueId": "اختیاری: شناسه سرنخ در صورت استفاده از دکمه مخابره سریع"
}
```
- **پاسخ `200 OK`:** `{ "ok": true, "data": { "roomView": { "...ClientRoomView..." } } }`

---

### ۳.۹. باز کردن راهنمایی معما — `POST /api/rooms/[code]/hint`
- **هدر الزامی:** `X-Player-Token`
- **بدنه درخواست:** `{ "puzzleId": "reactor-boot" }`
- **پاسخ `200 OK`:** `{ "ok": true, "data": { "hint": "متن راهنمایی...", "roomView": { "...ClientRoomView..." } } }`

---

### ۳.۱۰. استریم بلادرنگ رویدادهای اتاق — `GET /api/rooms/[code]/stream?token=...&sinceVersion=...`
- **نوع پاسخ:** `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`
- **فرمت رویدادهای ارسالی:**
```text
event: room_update
data: {"version":15,"roomView":{...ClientRoomView...}}

event: heartbeat
data: {"serverNow":1792584020000,"version":15}
```

---

## بخش ۴: قرارداد داخلی سرور و موتور بازی (`src/engine/index.ts` — مرز بین `نفر ۱` و `نفر ۲`)

نفر ۲ دقیقاً توابع خالص (Pure Functions) زیر را از `src/engine/index.ts` اکسپورت می‌کند و نفر ۱ در Route Handlerهای خود آن‌ها را فراخوانی می‌کند:

```ts
// src/engine/index.ts

export interface ServerRoomState {
  code: string;
  seed: number;
  version: number;
  status: RoomStatus;
  createdAt: number;
  startedAt: number | null;
  expiresAt: number | null;
  finishedAt: number | null;
  // شامل اطلاعات کامل بازیکنان (با tokenHash)، وضعیت معماها، کوله‌پشتی، پیام‌ها و secrets خصوصی سرور
  [internalKey: string]: unknown;
}

export interface EngineMutationResult {
  nextState: ServerRoomState;
  changed: boolean;
  feedbackMessage?: string;
  solvedPuzzleId?: PuzzleId;
}

export function createInitialRoomState(params: {
  code: string;
  hostId: string;
  hostName: string;
  hostTokenHash: string;
  preferredRole?: RoleId;
  seed?: number;
  now?: number;
}): ServerRoomState;

export function joinPlayerToRoom(
  state: ServerRoomState,
  params: {
    playerId: string;
    playerName: string;
    tokenHash: string;
    preferredRole?: RoleId;
    now?: number;
  }
): EngineMutationResult;

export function applyLobbyMutation(
  state: ServerRoomState,
  playerId: string,
  mutation:
    | { type: 'SELECT_ROLE'; role: RoleId }
    | { type: 'SET_READY'; ready: boolean }
    | { type: 'ADD_BOT'; role: RoleId }
    | { type: 'REMOVE_BOT'; botId: string },
  now?: number
): EngineMutationResult;

export function startRoomGame(
  state: ServerRoomState,
  requesterPlayerId: string,
  now?: number
): EngineMutationResult;

export function applyGameAction(
  state: ServerRoomState,
  playerId: string,
  action: GameActionPayload,
  now?: number
): EngineMutationResult;

export function appendChatMessage(
  state: ServerRoomState,
  playerId: string,
  params: { text: string; clueId?: string },
  now?: number
): EngineMutationResult;

export function unlockNextHint(
  state: ServerRoomState,
  playerId: string,
  puzzleId: PuzzleId,
  now?: number
): EngineMutationResult & { unlockedHintText: string };

export function tickRoomTimers(
  state: ServerRoomState,
  playerIdToTouch?: string,
  now?: number
): EngineMutationResult;

export function authenticatePlayerByTokenHash(
  state: ServerRoomState,
  tokenHash: string
): string | null; // returns playerId or null

export function projectRoomForPlayer(
  state: ServerRoomState,
  playerId: string,
  now?: number
): ClientRoomView;
```

> **قانون خطا در موتور بازی:** هر زمان عملی غیرمجاز باشد (مثلاً بخش قفل است، آیتم نصب نشده، کول‌داون فعال است یا تعداد بازیکن کمتر از ۳ نفر است)، توابع موتور یک نمونه از کلاس استاندارد `GameRuleError(code: ErrorCode, message: string, statusHint?: number, retryAfterMs?: number)` پرتاب می‌کنند (تعریف‌شده در `src/contracts/errors.ts`) که لایه سرور نفر ۱ مستقیماً آن را به پاسخ استاندارد `ApiErrorResponse` تبدیل می‌کند!

---

## بخش ۵: قرارداد کلاینت SDK و رابط کاربری (`src/client-sdk/index.ts` — مرز بین `نفر ۲` و `نفر ۳`)

نفر ۲ هوک و توابع آماده زیر را در `src/client-sdk/index.ts` در اختیار کامپوننت‌های UI نفر ۳ قرار می‌دهد:

```ts
// src/client-sdk/index.ts

export interface UseEscapeRoomResult {
  loading: boolean;
  reconnecting: boolean;
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'error';
  room: ClientRoomView | null;
  remainingSeconds: number; // محاسبه زنده در هر ثانیه کالیبره‌شده با serverNow!
  lastFeedback: { message: string; isSuccess: boolean; ts: number } | null;
  error: { code: ErrorCode; message: string } | null;
  soundMuted: boolean;
  toggleSoundMute: () => void;

  // متدهای تعاملی آماده فراخوانی در UI
  joinRoom: (playerName: string, preferredRole?: RoleId) => Promise<boolean>;
  selectRole: (role: RoleId) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  addBot: (role: RoleId) => Promise<void>;
  removeBot: (botId: string) => Promise<void>;
  startGame: () => Promise<void>;
  performAction: (action: GameActionPayload) => Promise<ActionFeedback | null>;
  sendChat: (text: string, clueId?: string) => Promise<void>;
  requestHint: (puzzleId: PuzzleId) => Promise<void>;
  clearError: () => void;
}

export function createRoomRequest(params: {
  hostName: string;
  preferredRole?: RoleId;
}): Promise<{ roomCode: string; roomView: ClientRoomView }>;

export function useEscapeRoom(roomCode: string): UseEscapeRoomResult;
```

> **پشتیبانی از حالت توسعه مستقل برای نفر ۳ (`Mock Mode`):** اگر URL صفحه دارای پارامتر `?mock=lobby`، `?mock=active` یا `?mock=escaped` باشد، هوک `useEscapeRoom` بدون هیچ درخواستی به بک‌اند، وضعیت تعاملی کاملی را در حافظه مرورگر شبیه‌سازی می‌کند تا نفر ۳ بتواند تمام صفحات و پنل‌های معما را به صورت ۱۰۰٪ مستقل طراحی و دیباگ کند!
