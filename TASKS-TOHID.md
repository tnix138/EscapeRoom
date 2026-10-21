# 🟦 سند وظایف اختصاصی توحید (Tohid)

> **نقش محوری:** مهندس هسته سرور، دیتابیس پایدار، موتور معمای حلقوی ۳ تا ۸ نفره و همگام‌سازی بلادرنگ
> **شاخه کاری Git:** `feat/tohid-backend-engine`
> **اسناد کافی برای شروع کار:** همین سند + `PROJECT.md` + `API-CONTRACT.md` (بدون نیاز به مطالعه کدهای امیرعلی یا علیرضا)

---

## ۱. مأموریت توحید در یک نگاه
تو مغز متفکر و ستون فقرات فنی بازی را می‌سازی تا امیرعلی و علیرضا بدون دغدغه همزمانی یا دیتابیس، صحنه‌های اول‌شخص و کات‌سین را سوار کنند:
1. ذخیره‌سازی پایدار دوگانه (`SQLite` توکار Node 22 برای اجرای فوری محلی/Sandbox + `Supabase PostgreSQL` برای استقرار ابری) که بعد از Refresh مرورگر هیچ وضعیتی از دست نرود؛
2. رزرو اتاق برای **۳ تا ۸ نفر** و صدور **لینک دعوت یکتا و امن (`SHA-256`) منقش به نام هر بازیکن**؛
3. طراحی و پیاده‌سازی **الگوریتم ریاضی حلقوی بلیط‌ها (`Cyclic Ticket Generator`)** به شکلی که در گروه ۳، ۴، ۵، ۶، ۷ یا ۸ نفره **هیچ بازیکنی حتی یک ثانیه بیکار نماند**؛
4. کالیبراسیون میلی‌ثانیه‌ای ساعت سرور (`serverNow` + `cutsceneStartedAt`) و استریم بلادرنگ `SSE` تا هر ۳ تا ۸ نفر کات‌سین ۷۴ ثانیه‌ای را **دقیقاً در یک ثانیه واحد** تماشا کنند!

---

## ۲. مرز مالکیت پوشه‌ها (فقط در این مسیرها کد بزن!)

### ✅ مسیرهای اختصاصی توحید:
```text
supabase/
└── migrations/
    └── 001_initial_schema.sql          # اسکیما جدول rooms برای PostgreSQL
src/server/
├── auth/
│   ├── seat-token.ts                   # تولید توکن ۴۸ کاراکتری صندلی + هش SHA-256
│   └── rate-limit.ts                   # جلوگیری از Brute-force روی قفل درب تئاتر
├── db/
│   ├── repository.ts                   # اینترفیس واحد + تشخیص خودکار SQLite یا Supabase
│   ├── sqlite-repository.ts            # پیاده‌سازی پایدار با node:sqlite در .data/escaperoom.db
│   └── supabase-repository.ts          # پیاده‌سازی ابری با کنترل همزمانی (version)
├── realtime/
│   └── room-hub.ts                     # انتشار بلادرنگ تغییرات نسخه اتاق برای اتصالات SSE
└── services/
    └── room-service.ts                 # حلقه تراکنشی OCC (خواندن -> موتور -> ذخیره مشروط -> انتشار)
src/engine/
├── index.ts                            # ماشین وضعیت اتاق و پیشبرد خودکار فازهای ۴گانه
├── rng.ts                              # تولید تصادفی تکرارپذیر Mulberry32 بر پایه seed
├── ticket-puzzle.ts                    # الگوریتم گراف حلقوی بلیط‌ها برای N = 3..8 بازیکن
└── view-projector.ts                   # حذف ۱۰۰٪ پاسخ‌های مخفی و ارسال فقط بلیط دست خود بازیکن
src/app/api/
├── health/route.ts                     # GET /api/health
└── rooms/
    ├── route.ts                        # POST /api/rooms (رزرو ۳–۸ نفره + صدور لینک‌ها)
    └── [code]/
        ├── route.ts                    # GET /api/rooms/[code]
        ├── action/route.ts             # POST /api/rooms/[code]/action
        ├── chat/route.ts               # POST /api/rooms/[code]/chat
        └── stream/route.ts             # GET /api/rooms/[code]/stream (SSE)
src/client-sdk/
├── index.ts                            # reserveRoomApi, useTheaterSession, createPreviewRoomState
└── preview-fixtures.ts                 # داده شبیه‌ساز آماده برای توسعه موازی امیرعلی و علیرضا!
tests/tohid/
├── cyclic-tickets-3-to-8.test.ts       # اثبات عدم بیکاری هیچ بازیکنی به ازای N = 3,4,5,6,7,8
├── cutscene-sync-and-lock.test.ts      # اثبات قفل بودن اکشن‌ها در طول ۷۴ ثانیه کات‌سین و گذار به in_theater
└── persistence-and-security.test.ts    # اثبات بقای داده بعد از ری‌استارت و عدم نشت جواب‌ها در JSON
```

### ❌ مسیرهای ممنوعه برای توحید (متعلق به امیرعلی و علیرضا):
- دست نزن به: `src/components/**`, `src/audio/**`, `src/app/page.tsx`, `src/app/invite/**`, `src/app/room/**`, `src/app/preview/**`

---

## ۳. برنامه اجرای موازی در ۳ موج (تا هیچ‌کس منتظر نماند!)

### 🚀 موج ۱ (اولویت اول — همگام با موج ۱ امیرعلی و علیرضا)
1. **اولین فایل را بساز: `src/client-sdk/preview-fixtures.ts` و `createPreviewRoomState`**
   - در همان ۳۰ دقیقه اول این تابع را با داده‌های نمونه واقعی بساز و تحویل بده تا **امیرعلی** و **علیرضا** بلافاصله صفحات `/preview/*` خودشان را با داده واقعی بالا بیاورند!
2. **لایه دیتابیس دوگانه (`sqlite-repository.ts` و `supabase-repository.ts`) + OCC:**
   - جدول `rooms (code TEXT PRIMARY KEY, version INT, phase TEXT, state_json TEXT, created_at BIGINT, updated_at BIGINT)`.
   - ذخیره‌سازی مشروط با `WHERE code = ? AND version = ?` و حلقه Retry تا ۶ مرتبه تا اگر ۸ بازیکن در یک لحظه بلیط پانچ کردند هیچکدام گم نشود.
3. **اندپوینت `POST /api/rooms`:**
   - اعتبارسنجی Zod روی `playerCount` (`3..8`) و آرایه `playerNames` (غیرخالی، پاک‌سازی XSS، طول ۲ تا ۲۴ کاراکتر).
   - تخصیص خودکار صندلی‌ها در سالن ۲۰ نفره (ردیف ۱ و ۲ نزدیک هم تا بازیکنان در کات‌سین با چرخاندن سر به چپ و راست هم‌تیمی‌هایشان را ببینند!) و تولید آرایه `invites` با مسیر `/invite/[code]/[seatToken]`.
- **🎯 خروجی دمو موج ۱ با امیرعلی و علیرضا:** فرم رزرو امیرعلی به API تو وصل می‌شود و برای «توحید، امیرعلی، علیرضا» ۳ لینک دعوت واقعی می‌سازد!

---

### 🚀 موج ۲ (موتور معمای حلقوی ۳ تا ۸ نفره و امنیت)
1. **پیاده‌سازی دقیق الگوریتم بلیط‌های حلقوی در `ticket-puzzle.ts` برای هر `N ∈ [3..8]`:**
   - برای هر صندلی `i` از `0` تا `N - 1` بر اساس `rng(seed)` سه مقدار هدف تولید کن:
     - `targetEmblem[i]` از بین ۸ نماد تئاتر
     - `targetAct[i]` از بین پرده‌های `1..4` (که روی پوستر دیوار چپ کوچه عنوانش نوشته شده)
     - `targetRowCode[i]` از بین `'I' | 'II' | 'III' | 'IV'` (متناظر با `alleyRowHintName` روی جدول دیوار راست کوچه)
     - `goldenDigit[i]` از بین ارقام `1..9`
   - **توزیع زنجیره‌ای بدون بیکاری:** روی `companionStub` در دست بازیکن `i`، نام بازیکن بعدی `next = (i + 1) % N` به همراه `targetEmblem[next]` و عنوان صحنه `targetAct[next]` قرار می‌گیرد!
   - بنابراین تک‌تک `N` بازیکن همزمان درگیر خواندن کوپن هم‌تیمی، چرخاندن سر به دیوار چپ و راست کوچه، پانچ کردن بلیط خودشان (`PUNCH_MY_TICKET`) و خواندن رقم طلایی خط برش برای باز کردن قفل درب (`UNLOCK_THEATER_DOOR`) هستند!
2. **ماشین زمان خودکار کات‌سین در `tickPhaseByClock(state, now)`:**
   - به محض ثبت کد صحیح `N` رقمی درب ورودی:
     - `phase = 'door_cutscene'` و `cutsceneStartedAt = now` ثبت می‌شود.
     - اگر `now - cutsceneStartedAt >= 11_000` و `< 74_000`: فاز به `'theater_cutscene'` می‌رود.
     - اگر `now - cutsceneStartedAt >= 74_000`: فاز به صورت دائمی به **`'in_theater'`** تغییر کرده و `restartedInTheaterAt = cutsceneStartedAt + 74_000` ذخیره می‌شود (شروع مجدد بازی داخل سالن تاریک با موسیقی ترسناک).
3. **امنیت `view-projector.ts`:**
   - هرگز پاسخ‌های پانچ‌نشده، کد نهایی درب تئاتر، یا بلیط دست سایر بازیکنان را در `ClientRoomView` قرار نده! هر بازیکن فقط `myHeldTickets` متعلق به خودش را می‌بیند.

---

### 🚀 موج ۳ (استریم زنده SSE، هوک کلاینت و تست‌های خودکار)
1. **پیاده‌سازی `GET /api/rooms/[code]/stream` و هوک `useTheaterSession`:**
   - محاسبه دقیق `clockOffset = roomView.serverNow - Date.now()` در کلاینت و به‌روزرسانی ۶۰ فریم/ثانیه `cutsceneElapsedMs` تا کات‌سین علیرضا بین همه‌ی مرورگرها هم‌فاز مطلق باشد.
   - ذخیره `seatToken` در `sessionStorage` تب فعلی + `localStorage` دستگاه برای بازیابی آنی بعد از Refresh صفحه.
2. **تست‌های جامع در `tests/tohid/`** برای تمامی تعداد نفرات `3, 4, 5, 6, 7, 8`.

---

## ۴. هماهنگی زیرساخت (Supabase / Vercel) و الزام اجباری لاگ‌گذاری شمسی (`Pending` ➔ `Archive`)

### الف) ارجاع عملیات‌های Supabase و Vercel به ایجنت چهارم
- چون امیرعلی و علیرضا فقط به GitHub دسترسی دارند و عملیات ابری توسط **ایجنت چهارم زیرساخت (`TASKS-INFRA-AGENT.md` که خودت، توحید، بالا می‌آوری)** اجرا می‌شود، هر بار که فایل مهاجرت جدیدی مثل `supabase/migrations/001_initial_schema.sql` اضافه کردی یا متغیر محیطی جدیدی لازم شد، یک لاگ از نوع `Infra-Supabase` یا `Infra-Vercel` در بخش **`Pending`** ثبت کن تا ایجنت چهارم دقیقاً طبق آن عمل کرده و پس از اتمام به **`Archive`** منتقل کند.

### ب) ثبت اجباری لاگ برای **تک‌تک Commitها، هر Push و تک‌تک PRها**
به ازای هر **Commit**، هر **Push** و هر **PR** الزاماً یک فایل لاگ بساز. جدول‌های بخش‌های `Pending` و `Archive` فایل [`WORKLOG.md`](./WORKLOG.md) **دستی ویرایش نمی‌شوند**؛ ابزار لاگ آن‌ها را از فراداده فایل‌ها می‌سازد:

```bash
npm run worklog:hooks     # یک‌بار: فعال‌سازی گارد pre-push و الزام کامیت فارسی

# ۱) لاگ Commit یا PR
npm run worklog:new -- --author "توحید" --slug tohid --activity Commit \
  --title "موج ۳ توحید — عنوان کوتاه فارسی" --topic wave3-sse-sync --ref "شاخه arena/xxx-escaperoom" --commit

# ۲) قبل از پوش: لاگ پوش (کامیت‌ها، SHA و فایل‌های تغییر یافته خودکار پر می‌شوند)
npm run worklog:push -- --author "توحید" --slug tohid --commit

# ۳) پس از تأیید/ادغام: آرشیو با ثبت «آرشیو شده توسط» و زمان
npm run worklog:archive -- <log-id> --by "توحید" --note "PR #N ادغام شد"

# ۴) بررسی سلامت
npm run worklog:check
```

**قواعد سخت:** (۱) پوش بدون فایل لاگ توسط `.githooks/pre-push` رد می‌شود؛ (۲) پیام کامیت باید فارسی باشد و `.githooks/commit-msg` کامیت غیرفارسی را رد می‌کند؛ (۳) هر لاگ باید «ساخته‌شده توسط + تاریخ شمسی + ساعت ایران + UTC» و پس از آرشیو «آرشیو شده توسط + زمان آرشیو» را داشته باشد. مرجع کامل: [`WORKLOG.md`](./WORKLOG.md) و [`AGENTS.md`](./AGENTS.md).

---

## ۵. چک‌لیست تحویل نهایی توحید (Definition of Done)
- [x] `npm run typecheck` بدون خطا اجرا شود.
- [x] معمای حلقوی بلیط‌ها به ازای **هر ۶ حالت تعداد بازیکن (`۳، ۴، ۵، ۶، ۷ و ۸ نفر`)** تست شده و ثابت شود بدون مشارکت ۱۰۰٪ نفرات قابل حل نیست و همواره یک جواب یکتا دارد.
- [x] پاسخ‌های معما و توکن سایر صندلی‌ها به هیچ وجه در خروجی `GET /api/rooms/[code]` افشا نشوند.
- [x] در طول ۷۴ ثانیه کات‌سین، هرگونه اکشن تقلبی کلاینت با خطای `CUTSCENE_LOCKED` مسدود شود و دقیقاً پس از پایان کات‌سین فاز `in_theater` در دیتابیس ماندگار گردد.
- [x] تمامی کامیت‌ها، پوش‌ها و PRهای توحید دارای رکورد کامل شمسی (سازنده + آرشیوکننده + زمان) در `WORKLOG.md` و پوشه `logs/` باشند.
