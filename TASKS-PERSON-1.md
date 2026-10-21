# 🛠️ شرح وظایف اختصاصی نفر ۱: مهندس بک‌اند، دیتابیس، امنیت و بلادرنگ

> **اسناد پیش‌نیاز (خودکفا):** برای انجام ۱۰۰٪ وظایف این سند، تنها مطالعه همین فایل + `PROJECT.md` + `API-CONTRACT.md` کافی است.

---

## ۱. مأموریت شما
شما مسئول ستون فقرات سرور بازی **«ایستگاه کرونوس»** هستید:
1. پیاده‌سازی لایه ذخیره‌سازی پایدار دوگانه (`SQLite` توکار Node 22 برای اجرای محلی/Sandbox + `Supabase PostgreSQL` برای استقرار ابری)؛
2. پیاده‌سازی کنترل همزمانی خوش‌بینانه (`Optimistic Concurrency Control`) تا اکشن‌های همزمان ۳ تا ۶ بازیکن هرگز با هم تداخل نکنند؛
3. مدیریت امن توکن بازیکنان (`SHA-256`)، اعتبارسنجی ورودی با `Zod` و محدودسازی نرخ درخواست (`Rate Limiting`)؛
4. ساخت تمام اندپوینت‌های REST و استریم بلادرنگ `SSE` دقیقاً مطابق `API-CONTRACT.md`.

---

## ۲. مرز مالکیت فایل‌ها (File Ownership)

### فایل‌هایی که باید بسازید (مجاز برای شما):
```text
supabase/
└── migrations/
    └── 001_initial_schema.sql          # اسکیما جدول rooms در PostgreSQL
src/server/
├── auth/
│   ├── token.ts                        # تولید توکن ۴۸ کاراکتری + هش SHA-256 + استخراج از هدر
│   └── rate-limit.ts                   # محدودکننده نرخ درخواست در حافظه بر اساس IP/Token
├── db/
│   ├── repository.ts                   # اینترفیس RoomRepository + کارخانه انتخاب خودکار درایور
│   ├── sqlite-repository.ts            # پیاده‌سازی پایدار با node:sqlite در .data/escaperoom.db
│   └── supabase-repository.ts          # پیاده‌سازی پایدار با @supabase/supabase-js و OCC
├── realtime/
│   └── room-hub.ts                     # EventEmitter انتشار فوری تغییرات اتاق به اتصالات SSE باز
├── services/
│   └── room-service.ts                 # حلقه تراکنشی OCC (خواندن -> موتور -> ذخیره مشروط -> انتشار)
└── http/
    └── api-helpers.ts                  # تبدیل خطاهای Zod و GameRuleError به پاسخ استاندارد JSON
src/app/api/
├── health/route.ts                     # GET /api/health
└── rooms/
    ├── route.ts                        # POST /api/rooms
    └── [code]/
        ├── route.ts                    # GET /api/rooms/[code]
        ├── join/route.ts               # POST /api/rooms/[code]/join
        ├── lobby/route.ts              # POST /api/rooms/[code]/lobby
        ├── start/route.ts              # POST /api/rooms/[code]/start
        ├── action/route.ts             # POST /api/rooms/[code]/action
        ├── chat/route.ts               # POST /api/rooms/[code]/chat
        ├── hint/route.ts               # POST /api/rooms/[code]/hint
        └── stream/route.ts             # GET /api/rooms/[code]/stream (SSE)
tests/server/
├── sqlite-persistence.test.ts          # تست بقا بعد از بستن و باز کردن مجدد دیتابیس
├── concurrency.test.ts                 # تست همزمانی ۵ اکشن موازی بدون گم شدن داده
└── api-security.test.ts                # تست اعتبارسنجی، احراز هویت و عدم نشت secrets در خروجی
```

### مسیرهای ممنوعه (تحت مالکیت سایر اعضا):
- ❌ ویرایش نکنید: `src/engine/**`, `src/client-sdk/**` (متعلق به نفر ۲)
- ❌ ویرایش نکنید: `src/components/**`, `src/app/page.tsx`, `src/app/room/**` (متعلق به نفر ۳)

---

## ۳. جزئیات دقیق پیاده‌سازی فنی

### ۳.۱. اسکیما جدول دیتابیس (SQLite و PostgreSQL یکسان)
در هر دو درایور جدول `rooms` دارای ستون‌های زیر است:
```sql
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  state_json TEXT NOT NULL, -- در PostgreSQL نوع JSONB یا TEXT
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_status_updated ON rooms (status, updated_at);
```
- **نحوه انتخاب خودکار درایور در `repository.ts`:**
  - اگر `process.env.STORAGE_DRIVER === 'supabase'` یا هر دو متغیر `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` مقداردهی شده باشند ← `SupabaseRoomRepository`.
  - در غیر این صورت ← `SqliteRoomRepository` (مسیر پیش‌فرض فایل: `process.env.SQLITE_DB_PATH || '.data/escaperoom.db'`؛ ایجاد خودکار پوشه `.data`).

### ۳.۲. الگوی کنترل همزمانی خوش‌بینانه (`withRoomTransaction` در `room-service.ts`)
برای جلوگیری از Race Condition هنگامی که ۳ تا ۶ بازیکن همزمان کلیک می‌کنند:
1. حداکثر `MAX_OCC_RETRIES = 6` بار حلقه تکرار اجرا کن:
   - رکورد فعلی `(state, version)` را از `repository.getByCode(code)` بخوان (اگر نبود `ROOM_NOT_FOUND` با کد `404`).
   - ابتدا `tickRoomTimers(state, playerId, Date.now())` و سپس تابع تغییردهنده موردنظر موتور بازی را صدا بزن.
   - اگر `changed === true`: متد `repository.saveIfVersionMatches(code, expectedVersion, nextState)` را صدا بزن.
   - اگر `saved === true`: رویداد تغییر نسخه را در `roomHub.notify(code, nextState.version)` منتشر کن و نتیجه `projectRoomForPlayer(nextState, playerId)` را برگردان.
   - اگر `saved === false` (تداخل همزمان رخ داده): یک تأخیر تصادفی کوتاه (`5ms..25ms`) بده و تکرار کن!

### ۳.۳. کد اتاق ۶ کاراکتری خوانا
هنگام ساخت اتاق در `POST /api/rooms`، کد ۶ کاراکتری را فقط از کاراکترهای غیرمبهم `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (بدون `0/O` و `1/I`) تولید کن و در صورت برخورد احتمالی با کد موجود، مجدداً تولید نما.

### ۳.۴. امنیت و نگاشت کدهای HTTP
- توکن خام (`48 hex chars`) فقط یک‌بار هنگام `create` یا `join` به کلاینت برمی‌گردد؛ در `ServerRoomState` فقط `SHA-256(token)` ذخیره و مقایسه می‌شود.
- نگاشت وضعیت HTTP برای `GameRuleError`:
  - `VALIDATION_ERROR` -> `400`
  - `UNAUTHORIZED_PLAYER` -> `401`
  - `FORBIDDEN_HOST_ONLY` -> `403`
  - `ROOM_NOT_FOUND` -> `404`
  - `ROOM_FULL`, `ROOM_ALREADY_STARTED`, `NOT_ENOUGH_PLAYERS`, `ROLES_INCOMPLETE`, `PLAYERS_NOT_READY`, `PUZZLE_ALREADY_SOLVED` -> `409`
  - `COOLDOWN_ACTIVE`, `RATE_LIMITED` -> `429`

### ۳.۵. استریم بلادرنگ SSE (`GET /api/rooms/[code]/stream`)
- پس از احراز هویت `token`، بلافاصله وضعیت اولیه یا رویداد `heartbeat` بفرست.
- هم به رویدادهای حافظه (`roomHub`) گوش بده (تأخیر `<10ms` روی یک سرور) و هم یک حلقه بررسی سبک دیتابیس هر `1000ms` اجرا کن تا در محیط‌های چندنقطه‌ای (Multi-instance Serverless) نیز تغییرات سایر инстанس‌ها بلافاصله کشف و ارسال شوند!
- پس از ۲۵ ثانیه با ارسال یک کامنت keepalive یا بستن تمیز استریم اجازه بده `EventSource` مرورگر به صورت استاندارد وصل بماند تا روی Serverless تایم‌اوت نخورد.

---

## ۴. وابستگی به سایر اعضا و نحوه توسعه مستقل
- **وابستگی:** امضای توابع `src/engine/index.ts` (تعریف‌شده در بخش ۴ `API-CONTRACT.md`).
- **نحوه تست مستقل قبل از اتمام کار نفر ۲:** در تست‌های `tests/server/` می‌توانید یا از موتور واقعی (پس از تحویل نفر ۲) و یا با `vi.mock('@/engine')` تمام رفتارهای دیتابیس، OCC، احراز هویت و API را بدون یک ثانیه توقف تست کنید.

---

## ۵. معیار تحویل نهایی (Definition of Done — Person 1)
- [ ] دستور `npm run typecheck` بدون خطا اجرا شود.
- [ ] تمام ۹ اندپوینت API دقیقاً ساختار JSON تعریف‌شده در `API-CONTRACT.md` را برگردانند.
- [ ] پایداری کامل تأیید شود: اگر نمونه `SqliteRoomRepository` بسته و دوباره باز شود، تمام اطلاعات اتاق، بازیکنان، زمان باقی‌مانده، کوله‌پشتی و چت دست‌نخورده باقی بماند.
- [ ] اجرای همزمان `Promise.all` شامل ۵ درخواست موازی از ۳ بازیکن مختلف روی یک اتاق، بدون از دست رفتن هیچ پیامی یا هیچ تغییر وضعیتی ذخیره شود (`version === initial + 5`).
- [ ] در هیچ‌یک از پاسخ‌های HTTP یا استریم SSE کلید `secrets` یا توکن سایر بازیکنان وجود نداشته باشد.
- [ ] دستور `npm run test:p1` با موفقیت ۱۰۰٪ پاس شود.
