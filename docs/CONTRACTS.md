# 📋 قراردادهای مشترک

> این فایل **تنها جایی** است که قراردادهای بین ایجنت‌ها نوشته شده. تغییر فقط با توافق همهٔ ۵ نفر.

## قرارداد ۱ — شکل `ClientRoomView`

هر ایجنت که با view سرور کار می‌کند، باید این شکل را رعایت کند:

```typescript
interface ClientRoomView {
  roomCode: string;
  version: number;
  serverNow: number;
  phase: 'alley_puzzle' | 'door_cutscene' | 'theater_cutscene' | 'in_theater';
  playerCount: number;
  maxAuditoriumSeats: 20;
  players: PlayerSeatPublicView[];
  me: PlayerSeatPublicView;
  myHeldTickets: HeldTicketsView;
  alley: AlleyView;
  auditorium: AuditoriumView | null;
  messages: ChatMessageView[];
  cutsceneStartedAt: number | null;
  restartedInTheaterAt: number | null;
}
تغییر این قرارداد: فقط با توافق توحید + علیرضا + امیرعلی + امیر + نازنین.

قرارداد ۲ — قرارداد حضور (Presence)
این قرارداد جدید است (فاز ۰۳).

typescript
interface PresenceSnapshot {
  playerId: string;
  seatIndex: number;
  position: { x: number; y: number; z: number };
  yaw: number;
  phase: string;
  lastUpdate: number;
}
نرخ ارسال: ۵ تا ۱۰ بار در ثانیه (بسته به فاز).
نگهداری سرور: فقط آخرین snapshot (بدون تاریخچه).
پاک‌سازی: ۳۰ ثانیه بعد از آخرین به‌روزرسانی.

تغییر این قرارداد: فقط با توافق توحید + علیرضا.

قرارداد ۳ — فاز بازی
typescript
type GamePhase = 
  | 'alley_puzzle'
  | 'door_cutscene'
  | 'theater_cutscene'
  | 'in_theater';
هیچ فاز جدیدی بدون توافق توحید اضافه نمی‌شود.

قرارداد ۴ — پیام خطا
typescript
interface ApiError {
  ok: false;
  error: {
    code: string;  // مثلاً 'RATE_LIMITED'
    message: string;  // فارسی
  };
}
کدها: INVALID_PHASE, RATE_LIMITED, INVALID_SEAT_TOKEN, CUTSCENE_LOCKED, WRONG_DOOR_COMBINATION, TICKETS_NOT_ALL_PUNCHED, ROOM_NOT_FOUND, CONFLICT_RETRY_EXHAUSTED.

تغییر این قرارداد: فقط با توافق توحید + امیرعلی.

قرارداد ۵ — احراز هویت ادمین
این قرارداد جدید است (فاز ۰۹).

typescript
interface AdminSession {
  adminId: string;
  username: string;
  role: 'superadmin' | 'moderator' | 'viewer';
  createdAt: number;
  expiresAt: number;
}
احراز هویت: ساده (username + password). ذخیره‌سازی: hash در .env یا دیتابیس.
جلسه: JWT در کوکی httpOnly.

تغییر این قرارداد: فقط با توافق امیر + توحید.

قرارداد ۶ — ثبت رویداد
این قرارداد جدید است (فاز ۱۰).

typescript
interface AdminEvent {
  id: string;
  type: string;  // 'room_created' | 'player_joined' | 'puzzle_solved' | ...
  roomCode: string | null;
  playerId: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
}
ذخیره‌سازی: در دیتابیس، جدول admin_events (مهاجرت جدید).

تغییر این قرارداد: فقط با توافق امیر + توحید.

اگر ایجنت به قرارداد جدید نیاز داشت
در این فایل یک بخش جدید با عنوان «پیشنهاد — [نام]» بنویس.

به مالک خودت پیام بده.

منتظر تأیید توحید بمان.

بعد از تأیید، بخش را از «پیشنهاد» به «قرارداد» تغییر بده.

