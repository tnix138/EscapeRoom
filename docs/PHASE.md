
# 🗺️ نقشهٔ فازها

> این فایل **تنها جایی** است که ترتیب و مالکیت فازها هست. اگر تغییری لازم شد، فقط این فایل عوض می‌شود.
>
> **هر فاز** یک بخش جداگانه در همین فایل دارد. ایجنت مالک، فقط بخش فاز خودش را می‌خواند.

---

## جدول کامل

| فاز | عنوان | مالک(ها) | وابستگی | اولویت |
|---|---|---|---|---|
| ۰۱ | پاک‌سازی مستندات و ساخت `docs-v2/` | توحید | — | 🔴 بحرانی |
| ۰۲ | اتوماسیون CI/CD | توحید | ۰۱ | 🔴 بحرانی |
| ۰۳ | مدل حضور بازیکن (قرارداد + تست) | توحید | ۰۱ | 🟠 بالا |
| ۰۴ | مدل حضور در کلاینت (Three.js) | علیرضا | ۰۳ | 🟠 بالا |
| ۰۵ | نورپردازی: PBR و سایه | علیرضا | ۰۱ | 🟠 بالا |
| ۰۶ | مواد و بافت رویه‌ای | علیرضا | ۰۵ | 🟡 متوسط |
| ۰۷ | اتمسفر ترس: مه، صدا، HUD | علیرضا + امیرعلی | ۰۵ | 🟠 بالا |
| ۰۸ | کات‌سین سینمایی (Three.js) | علیرضا | ۰۵ | 🟡 متوسط |
| ۰۹ | پنل ادمین: احراز هویت | امیر + امیرعلی | ۰۱ | 🟡 متوسط |
| ۱۰ | پنل ادمین: آمار و مشاهده | امیر | ۰۹ | 🟡 متوسط |
| ۱۱ | محتوای داستانی | علیرضا + نازنین | — | 🟡 متوسط |
| ۱۲ | HUD بازیکن در ۳D | امیرعلی | ۰۴ | 🟡 متوسط |
| ۱۳ | ابزارهای مدیریتی | امیر | ۰۹ | 🟢 پایین |
| ۱۴ | QA تجربه | نازنین | ۰۴، ۰۵، ۰۷ | 🟢 پایین |
| ۱۵ | انتشار نهایی | توحید | همه | 🔴 بحرانی |

## ترتیب زمانی پیشنهادی

```
هفته ۱:  ۰۱ (توحید)
هفته ۲:  ۰۲ (توحید) + ۰۵ (علیرضا) + ۰۹ (امیر + امیرعلی) + ۱۱ (علیرضا + نازنین)
هفته ۳:  ۰۳ (توحید) + ۰۶ (علیرضا) + ۱۰ (امیر) + ۱۲ (امیرعلی)
هفته ۴:  ۰۴ (علیرضا) + ۰۷ (علیرضا + امیرعلی) + ۱۳ (امیر)
هفته ۵:  ۰۸ (علیرضا) + ۱۴ (نازنین)
هفته ۶:  ۱۵ (توحید)
```

**نکته:** این ترتیب پیشنهادی است. اگر فازی زودتر تمام شد، می‌تواند زودتر شروع شود.

---

## 🔧 اتصال سه فاز ۰۷ / ۰۹ / ۱۲ — گزارش یک‌جا

سه فاز UI که تا حالا «آماده ولی وصل‌نشده» بودند، در یک به‌روزرسانی به مسیر واقعی بازی وصل شدند:

| فاز | قبل | بعد |
|---|---|---|
| ۰۷ | HUD ترس ساخته شده بود ولی در هیچ صحنه‌ای نبود | `HorrorSignalHud` سه‌سطحی در `AlleyRoomThreeIntegration` mount شد و از وضعیت در/قفل تغذیه می‌شود |
| ۰۹ | صفحهٔ ورود بود، ولی هیچ محافظی جلسه را نمی‌سنجید | `AdminSessionGate` در چیدمان `/admin` یک بار جلسه را می‌سنجد و فقط روی ۴۰۱/۴۰۳ ریدایرکت می‌کند |
| ۱۲ | `PresenceHud` ساخته شده بود ولی در هیچ صحنه‌ای نبود | `PresenceHud` + `usePresenceFeed` (قرارداد #104) در نمای کوچه mount شدند |

اصل مشترک هر سه: **اگر سرویس بالادستی آماده نیست، خاموش و بی‌صدا** — نه خطای کنسول، نه ریدایرکت، نه حلقه. با آمدن سرویس، بدون تغییر کد روشن می‌شوند.

### بازبینی UI — دو باگ گزارش‌شدهٔ امیرعلی (۱۴۰۵/۰۷/۳۰)

| باگ | علت ریشه‌ای | رفع |
|---|---|---|
| بنر «ماوس قفل شده» وسط صفحه می‌ماند و نمی‌رود | `movementNotice` در حالت `pointer-lock` همیشه یک اعلان برمی‌گرداند؛ در بازی ماوس تقریباً همیشه قفل است | راهنما فقط **۴ ثانیه** بعد از قفل شدن نمایش داده می‌شود (`MOVEMENT_POINTER_HINT_MS`)، بعد خودش محو می‌شود؛ با قفل بعدی دوباره می‌آید. «حرکت قفل شد» برای مودال/کات‌سین دست‌نخورده ماند. |
| ورود جواب معما شلوغ است و قابل جمع‌کردن نیست | کیپد ۱۲ دکمه‌ای همیشه باز بود | دکمهٔ کشویی «بستن/نمایش صفحه‌کلید» با `aria-expanded` و `aria-controls`؛ کیپدِ بسته با `hidden` واقعاً از چیدمان حذف می‌شود و ورودی متنی/دکمهٔ قفل سر جایشان هستند. |

- 📊 تست خودکار: `tests/amirali/ui-clutter-fixes.test.ts` (۱۵ تست) + **۳۱ بررسی تعاملی واقعی** (رندر React در jsdom): کلیک کشو، `aria-expanded`، `hidden`، تایپ با کیپد بسته، محو شدن اعلان پس از ۴ ثانیه، بازگشت اعلان با قفل دوم و پایداری اعلان مودال.
- 📊 کل مخزن: **۴۷۶ تست در ۴۳ فایل سبز** · `tsc` صفر خطا · `next build` موفق.

### وضعیت مسدودکننده‌ها (به‌روزرسانی دوم)

1. ✅ **سرور حضور ساخته شد** — `presence-tracker.ts`، `presence-service.ts` و `/api/rooms/[code]/presence` + رویداد `presence_update` روی استریم. با smoke زنده تأیید شد (رزرو → POST حضور ۲۰۰ → GET ۲۰۰ → قاب SSE حاوی بازیکن؛ توکن غلط ۴۰۱، موقعیت خارج از محدوده ۴۰۰).
2. ✅ **API پنل ادمین ساخته شد** — `/api/admin/login|logout|session` با توکن HS256 در کوکی httpOnly. smoke زنده: بدون جلسه ۴۰۱، `/admin` بدون جلسه ۳۰۷ به `/admin/login`، ورود درست ۲۰۰ + کوکی، صفحهٔ `/admin` ۲۰۰، خروج ۲۰۰ و بعد از آن ۴۰۱، ششمین تلاش ورود ۴۲۹.
3. ✅ **BOM از `package.json` حذف شد** — `next build` و `next dev` دیگر با `SyntaxError: Unexpected token '\uFEFF'` نمی‌شکنند.
4. ✅ داشبورد آمار فاز ۱۰ (امیر) تحویل شد: `/api/admin/stats|players|rooms|errors` + صفحات `/admin`، `/admin/players`، `/admin/errors`.
5. ℹ️ حضور در حافظهٔ هر نمونه است (مثل `room-hub`)؛ برای استقرار چندنمونه‌ای باید به Redis منتقل شود.

---

# 📋 فاز ۰۱ — پاک‌سازی مستندات و ساخت `docs-v2/`

**مالک:** توحید
**وابستگی:** —
**اولویت:** 🔴 بحرانی
**مدت تخمینی:** ۲ روز

## هدف

مستندات قدیمی (`docs/`) را پاک کن. `docs-v2/` را کامل کن. `README.md` را به‌روز کن.

## چه فایل‌هایی را تغییر می‌دهی؟

- پاک کردن: `docs/` (کل پوشه)
- پاک کردن: `AGENTS.md` قدیمی (اگر در ریشه است)
- پاک کردن: `WORKLOG.md` قدیمی (اگر در ریشه است)
- ساختن: `docs-v2/README.md`
- ساختن: `docs-v2/VISION.md`
- ساختن: `docs-v2/RULES.md`
- ساختن: `docs-v2/AGENTS.md`
- ساختن: `docs-v2/PHASES.md` (همین فایل)
- ساختن: `docs-v2/CONTRACTS.md`
- ساختن: `docs-v2/AUTO.md`
- ساختن: `docs-v2/features/*.md`
- ساختن: `docs-v2/checklists/*.md`
- به‌روزرسانی: `README.md` ریشه (اشاره به `docs-v2/`)

## معیار موفقیت

- ✅ `docs/` وجود ندارد.
- ✅ `docs-v2/` کامل است (۱۳ فایل).
- ✅ `README.md` ریشه به `docs-v2/README.md` اشاره می‌کند.
- ✅ هیچ فایل قدیمی در ریشه نمانده.

## وضعیت

- ✅ تکمیل شد (انحراف پذیرفته‌شده در مسیر: پوشه در عمل `docs/` است، نه `docs-v2/`؛ خودِ `docs/` مرجع نهایی و منبع حقیقت است)
- 📝 تاریخ: ۱۴۰۵/۰۷/۳۱
- 🔗 کامیت مرجع: `e46e4f5`
- 📊 نتیجهٔ تست: `docs/` کامل (۱۱ فایل + `features/` + `checklists/`)؛ `README.md` ریشه به `docs/README.md` اشاره می‌کند؛ بازبینی مستندات در Issue #95 بدون یافته‌ٔ متناقض بسته شد

---

# 📋 فاز ۰۲ — اتوماسیون CI/CD

**مالک:** توحید
**وابستگی:** ۰۱
**اولویت:** 🔴 بحرانی
**مدت تخمینی:** ۲ روز

## هدف

اتوماسیون push به CI به merge خودکار روی `main`. حذف PR دستی.

## چه فایل‌هایی را تغییر می‌دهی؟

- `.github/workflows/ci.yml` (جدید یا بازنویسی)
- `.github/workflows/auto-merge.yml` (جدید)
- `.github/workflows/deploy.yml` (جدید)
- `scripts/auto-merge.sh` یا `.mjs` (جدید)
- `package.json` (اسکریپت‌های جدید)

## معیار موفقیت

- ✅ هر push به `agent/*` باعث اجرای CI می‌شود.
- ✅ اگر CI سبز بود، merge خودکار به `main` انجام می‌شود.
- ✅ اگر CI قرمز بود، merge انجام نمی‌شود.
- ✅ توحید می‌تواند deploy کند (فقط از `main` سبز).
- ✅ هیچ PR دستی لازم نیست.

## وضعیت

- 🟡 در حال انجام — فایل‌های اتوماسیون نوشته و روی شاخهٔ ادغام سبز شده‌اند، ولی **روی `main` فعال نیستند**
- ✅ `ci.yml` (typecheck + lint + test + build)، `auto-merge.yml`، `deploy.yml`، `issue-sync.yml` در `.github/workflows/`
- ✅ `scripts/issue-sync.mjs` + `scripts/issue-plan.json` برای کامنت/بستن Issueها با `GITHUB_TOKEN`
- ✅ اسکریپت‌های `npm run ci` / `lint` / `smoke` / `hash:admin`
- 🚫 مسدود: `origin/main` هیچ فایل workflow ندارد و برنچ‌پروتکشن/سکرت `GITHUB_TOKEN` بدون دسترسی ادمین قابل تنظیم نیست
- 📝 تاریخ: ۱۴۰۵/۰۷/۳۱
- 🔗 کامیت مرجع: `0437604`
- 📊 نتیجهٔ تست: اجرای محلی معادل CI سبز — `tsc --noEmit` پاک، `npm run lint` پاک، ۵۷۹ تست در ۵۴ فایل، `next build` موفق

---

# 📋 فاز ۰۳ — مدل حضور بازیکن (قرارداد + تست)

**مالک:** توحید
**وابستگی:** ۰۱
**اولویت:** 🟠 بالا
**مدت تخمینی:** ۳ روز

## هدف

قرارداد `PresenceSnapshot` و endpoint `POST /api/rooms/[code]/presence`. سرور فقط آخرین snapshot را نگه می‌دارد (بدون تاریخچه).

## چه فایل‌هایی را تغییر می‌دهی؟

- `src/contracts/presence.ts` (جدید)
- `src/server/presence/**` (جدید)
- `src/app/api/rooms/[code]/presence/route.ts` (جدید)
- `tests/tohid/presence-*.test.ts` (جدید)
- `docs-v2/CONTRACTS.md` (به‌روزرسانی قرارداد ۲)

## محدودهٔ فایل

- `src/contracts/presence.ts`
- `src/server/presence/**`
- `src/app/api/rooms/[code]/presence/route.ts`
- `tests/tohid/presence-*.test.ts`
- `docs-v2/CONTRACTS.md`

**به هیچ فایل دیگری دست نزن.**

## معیار موفقیت

- ✅ snapshot معتبر قبول می‌شود.
- ✅ snapshot نامعتبر (position خارج bounds) رد می‌شود.
- ✅ snapshot قدیمی (بیش از ۳۰ ثانیه) پاک می‌شود.
- ✅ rate limit (۵۰ درخواست در ثانیه) اعمال می‌شود.
- ✅ تست‌های `tests/tohid/presence-*.test.ts` سبز هستند.

## وضعیت

- ✅ پیاده‌سازی شد (به‌صورت تکمیلی، چون در تاریخ ۱۴۰۵/۰۸/۰۱ هیچ فایلی از این فاز در مخزن نبود)
- 📝 فایل‌ها: `src/server/realtime/presence-tracker.ts` (انبار حافظه‌ای + اعتبارسنجی)،
  `src/server/services/presence-service.ts` (سرویس با توکن صندلی)،
  `src/app/api/rooms/[code]/presence/route.ts` (GET و POST)
- ✅ `POST` هویت را از هدر `x-seat-token` می‌خواند؛ `playerId`/`seatIndex` داخل بدنه نادیده گرفته می‌شوند
- ✅ `yaw` رادیان است و در `[-π, π)` نرمال می‌شود
- ✅ موقعیت خارج از `[-9.5, 9.5] × [0, 3.2] × [-18.5, 8.5]` یا مقدار غیرمتناهی → ۴۰۰
- ✅ پاک‌سازی ۳۰ ثانیه‌ای، سقف ۳۲ ورودی هر اتاق، rate limit ۵۰/ثانیه برای هر صندلی (۴۲۹)
- ✅ قاب `presence_update` = `{ presences, serverNow }` روی استریم موجود، با نرخ ۲۵۰ms و فقط وقتی امضا عوض شود
- 📊 تست: `tests/amirali/presence-server-phase12.test.ts` (۲۱ تست) + smoke زنده HTTP

---

# 📋 فاز ۰۴ — مدل حضور در کلاینت (Three.js)

**مالک:** علیرضا
**وابستگی:** ۰۳
**اولویت:** 🟠 بالا
**مدت تخمینی:** ۴ روز

## هدف

دیدن هم‌تیمی‌ها در جهان سه‌بعدی. ارسال snapshot خود بازیکن با throttle ۱۰Hz.

## چه فایل‌هایی را تغییر می‌دهی؟

- `src/engine3d/presence/**` (جدید)
- `tests/alireza/presence-*.test.ts` (جدید)

## محدودهٔ فایل

- `src/engine3d/presence/**`
- `tests/alireza/presence-*.test.ts`

**به هیچ فایل دیگری دست نزن.** مخصوصاً `src/server/**` (توحید) و `src/components/**` (امیرعلی).

## معیار موفقیت

- ✅ `usePresence` hook کار می‌کند.
- ✅ `RemotePlayer` ساخته می‌شود.
- ✅ دو بازیکن یکدیگر را می‌بینند.
- ✅ موقعیت به‌روزرسانی می‌شود.
- ✅ بازیکن آفلاین بعد از ۳۰ ثانیه حذف می‌شود.
- ✅ FPS روی موبایل ۳۰+ و دسکتاپ ۶۰ است.

## وضعیت

- ✅ تکمیل شد — hook/ترنسپورت، `RemotePlayer` و `RemotePlayerManager` تست شده‌اند و **اکنون در صحنهٔ کوچه mount هستند**.
- ✅ `src/client-sdk/presence-avatars.ts` قاب حضور HUD (`position`, `yawDeg`) را به snapshot موتور تبدیل می‌کند؛ بازیکن محلی حذف و آواتار آفلاین بعد از ۳۰ ثانیه پاک می‌شود.
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: `59ad5c5`
- 📊 نتیجهٔ تست: `tests/tohid/presence-avatar-wiring.test.ts` (۱۰) + `tests/alireza/presence-client.test.ts` (۸) + قرارداد/فاز ۱۲ (۵۳) — سبز
- ⏳ FPS روی دستگاه واقعی به‌عنوان دروازهٔ انتشار در #88 سنجیده می‌شود (روش کار در `docs/checklists/before-release.md`).

---

# 📋 فاز ۰۵ — نورپردازی: PBR و سایه

**مالک:** علیرضا
**وابستگی:** ۰۱
**اولویت:** 🟠 بالا
**مدت تخمینی:** ۴ روز

## هدف

نورپردازی PBR (ambient, directional, point, spot) با سایه‌های نرم. مه سه‌بعدی.

## چه فایل‌هایی را تغییر می‌دهی؟

- `src/engine3d/lighting/**` (جدید یا بازنویسی)
- `tests/alireza/lighting-*.test.ts` (جدید)

## محدودهٔ فایل

- `src/engine3d/lighting/**`
- `tests/alireza/lighting-*.test.ts`

**به هیچ فایل دیگری دست نزن.**

## معیار موفقیت

- ✅ نور ambient، directional، point، spot ساخته می‌شوند.
- ✅ سایه‌ها نرم و واقعی‌اند.
- ✅ مه با `near`/`far` کار می‌کند.
- ✅ انیمیشن نور (سوسو زدن) کار می‌کند.
- ✅ FPS روی موبایل ۳۰+ و دسکتاپ ۶۰ است.

## وضعیت

- ✅ پیاده‌سازی و تست‌های نورپردازی تکمیل و در PR #106 ادغام شد (2026-10-21).
- ✅ `npm run typecheck`، `npm test` و `npm run build` روی شاخهٔ فعلی موفق‌اند؛ تست دستگاه واقعی FPS در دسترس نیست.

---

# 📋 فاز ۰۶ — مواد و بافت رویه‌ای

**مالک:** علیرضا
**وابستگی:** ۰۵
**اولویت:** 🟡 متوسط
**مدت تخمینی:** ۳ روز

## هدف

Materialهای PBR با normal map، roughness map، AO map رویه‌ای. سطح خیس با reflection.

## چه فایل‌هایی را تغییر می‌دهی؟

- `src/engine3d/materials/**` (جدید یا بازنویسی)
- `tests/alireza/materials-*.test.ts` (جدید)

## محدودهٔ فایل

- `src/engine3d/materials/**`
- `tests/alireza/materials-*.test.ts`

**به هیچ فایل دیگری دست نزن.**

## معیار موفقیت

- ✅ `PBRMaterial` با normal map ساخته می‌شود.
- ✅ `ProceduralTextures` کار می‌کند.
- ✅ `WetSurfaceMaterial` با reflection کار می‌کند.
- ✅ FPS روی موبایل ۳۰+ و دسکتاپ ۶۰ است.

## وضعیت

- ✅ مواد PBR و بافت‌های رویه‌ای تکمیل و در PR #106 ادغام شد (2026-10-21).
- ✅ تست‌های فاز، `npm run typecheck`، `npm test` و `npm run build` موفق‌اند.
- ⏳ سنجش FPS روی دستگاه واقعی در #87/#88 باقی است؛ روش گام‌به‌گام در `docs/checklists/before-release.md` ثبت شد.

---

# 📋 فاز ۰۷ — اتمسفر ترس: مه، صدا، HUD

**مالک:** علیرضا + امیرعلی
**وابستگی:** ۰۵
**اولویت:** 🟠 بالا
**مدت تخمینی:** ۵ روز (دو مالک موازی)

## هدف

اتمسفر ترس: صدای محیطی، جامپ‌اسکر، post-processing (سمت ۳D — علیرضا)، HUD ترس (سمت UI — امیرعلی).

## محدودهٔ فایل علیرضا

- `src/engine3d/horror/**` (جدید)
- `src/audio/horror/**` (جدید)
- `tests/alireza/horror-*.test.ts` (جدید)

## محدودهٔ فایل امیرعلی

- `src/components/hud/horror/**` (جدید)
- `tests/amirali/horror-*.test.ts` (جدید)

**هیچ فایلی بین این دو نفر مشترک نیست.**

## معیار موفقیت

- ✅ جامپ‌اسکر در زمان درست اتفاق می‌افتد.
- ✅ صدای ضربان قلب پخش می‌شود.
- ✅ HUD در حالت ترس تغییر می‌کند.
- ✅ post-processing (vignette, grain) اعمال می‌شود.
- ✅ FPS روی موبایل ۳۰+ و دسکتاپ ۶۰ است.

## وضعیت

- ✅ سهم HUD امیرعلی در PR #109 تکمیل و به صحنه وصل شد.
- ✅ سهم اولیهٔ علیرضا: vignette/film grain، جامپ‌اسکر زمان‌محور و `HorrorAudio` با ضربان قلب (PR #106).
- ✅ قرارداد `HorrorIntensity` در `src/contracts/horror.ts` آماده شد (PR #110)؛ دیگر نیاز به قرارداد محلی نیست.
- ✅ **اتصال به صحنه انجام شد:** مهِ واکنش‌گرا (`FearResponsiveFog`) روی `engine.scene` کوچه با چگالی متناسب با سطح ترس، و `HorrorAudio` (باد + همهمهٔ دور + ضربان قلب) که فقط با تعامل کاربر راه می‌افتد و `setFearLevel` آن با سطح ترس هم‌گام است.
- ✅ افکت‌های صوتی یک‌باره (`windowed`-style) داخل کات‌سین با `StoryCueDirector` پخش می‌شوند.
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: `c030fec`
- 📊 نتیجهٔ تست: `tests/alireza/horror-atmosphere.test.ts` (۹) + `tests/amirali/horror-*` (۳۵) + `tests/qa/horror-wiring.test.ts` (۴) — سبز؛ کل مخزن ۵۹۸ تست در ۵۷ فایل
- ⏳ FPS روی دستگاه واقعی در #88 سنجیده می‌شود.

# 📋 فاز ۰۸ — کات‌سین سینمایی (Three.js)

**مالک:** علیرضا
**وابستگی:** ۰۵
**اولویت:** 🟡 متوسط
**مدت تخمینی:** ۵ روز

## هدف

انتقال کات‌سین از CSS به دوربین سه‌بعدی با keyframe animation. حداقل ۷ شات. post-processing.

## چه فایل‌هایی را تغییر می‌دهی؟

- `src/components/cinema/**` (بازنویسی یا جدید)
- `src/engine3d/cinema/**` (جدید)
- `tests/alireza/cinema-*.test.ts` (جدید)

## محدودهٔ فایل

- `src/components/cinema/**`
- `src/engine3d/cinema/**`
- `tests/alireza/cinema-*.test.ts`

**به هیچ فایل دیگری دست نزن.** مخصوصاً `src/components/hud/**` (امیرعلی).

## معیار موفقیت

- ✅ کات‌سین با دوربین سه‌بعدی اجرا می‌شود.
- ✅ حداقل ۷ شات دارد.
- ✅ post-processing اعمال می‌شود.
- ✅ در ۷۴ ثانیه تمام می‌شود.
- ✅ FPS روی موبایل ۳۰+ و دسکتاپ ۶۰ است.

## وضعیت

- ✅ کات‌سین سه‌بعدی در PR #108 ادغام شد (2026-10-21): هفت شات، post-processing و تایم‌لاین ۷۴ثانیه‌ای.
- ✅ تست‌های پروژه، `npm run typecheck` و `npm run build` روی شاخهٔ فعلی موفق‌اند؛ تست دستگاه واقعی FPS در دسترس نیست.

---

# 📋 فاز ۰۹ — پنل ادمین: احراز هویت

**مالک:** امیر + امیرعلی
**وابستگی:** ۰۱
**اولویت:** 🟡 متوسط
**مدت تخمینی:** ۳ روز (دو مالک موازی)

## هدف

ساختار پنل ادمین + احراز هویت ساده (username/password از `.env`).

## محدودهٔ فایل امیر

- `src/app/admin/**` (جدید)
- `src/app/api/admin/login/route.ts` (جدید)
- `src/app/api/admin/logout/route.ts` (جدید)
- `src/components/admin/LoginForm.tsx` (جدید)
- `src/components/admin/AdminSidebar.tsx` (جدید)
- `tests/amir/admin-auth.test.ts` (جدید)

## محدودهٔ فایل امیرعلی

- `src/app/admin/login/page.tsx` (جدید — فقط صفحهٔ ورود)
- `src/app/admin/layout.tsx` (جدید — فقط چیدمان)

**هیچ فایلی بین این دو نفر مشترک نیست.**

## معیار موفقیت

- ✅ می‌توان با username/password وارد شد.
- ✅ غیر ادمین ۴۰۳ می‌گیرد.
- ✅ جلسه در کوکی `httpOnly` ذخیره می‌شود.
- ✅ خروج کار می‌کند.
- ✅ تست‌های `tests/amir/admin-auth.test.ts` سبز هستند.

## وضعیت

- ✅ تکمیل شد (هر دو سهم)
- 📝 سهم امیرعلی: `src/app/admin/layout.tsx`، `src/app/admin/login/page.tsx`، `src/app/admin/login/login-rules.ts`، محافظ جلسهٔ `AdminSessionGate` و صفحهٔ ورودِ پنل `src/app/admin/page.tsx`
- 📝 سهم امیر (تکمیلی، چون در تاریخ ۱۴۰۵/۰۸/۰۱ هیچ‌کدام در مخزن نبود): `src/server/auth/admin-session.ts`، `/api/admin/login`، `/api/admin/logout`، `/api/admin/session`
- ✅ **محافظ جلسه**: در `src/app/admin/layout.tsx` یک بار `GET /api/admin/session` می‌سنجد؛
  ۴۰۱/۴۰۳ → `/admin/login?next=…`؛ ۴۰۴/۵۰۰/خطای شبکه → **هیچ ریدایرکتی** (بدون حلقهٔ ریدایرکت)
- ✅ مسیر `next` فقط برای مسیرهای داخلی `/admin/**` ساخته می‌شود؛ ورودی خارجی/پروتکل‌نسبی دور ریخته می‌شود (جلوگیری از open redirect)
- ✅ **احراز هویت**: توکن HS256 (`header.payload.signature`) با `node:crypto` در کوکی `HttpOnly; SameSite=Lax; Secure` (در production)، عمر ۸ ساعت
- ✅ اعتبارنامه‌ها فقط از env: `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (یا `ADMIN_PASSWORD` محلی) + `ADMIN_SESSION_SECRET`؛ بدون آن‌ها ورود **۵۰۳** می‌دهد (fail-closed)
- ✅ مقایسهٔ ثابت‌زمان نام کاربری و گذرواژه؛ rate limit ۵ بار در دقیقه برای هر IP (۴۲۹)
- ℹ️ **انحراف مستند:** Issue #95 می‌گوید فرم از `src/components/admin/LoginForm.tsx` (امیر) import شود؛ آن فایل هرگز در مخزن ساخته نشد. فرم به‌صورت درون‌خطی در `src/app/admin/login/page.tsx` پیاده شده و با API واقعی ورود موفق می‌دهد. با آمدن `LoginForm` امیر، فقط بدنهٔ فرم جابه‌جا می‌شود.
- 📅 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: `4be0071` (merge #111)
- 📊 نتیجهٔ تست: `admin-login-phase09.test.ts` (۲۲) + `admin-gate-phase09.test.ts` (۹) + `admin-auth-phase09.test.ts` (۱۵) = **۴۶ تست سبز**؛ smoke زندهٔ production: ۴۰۱ → ورود ۲۰۰ + کوکی → `/admin` ۲۰۰ → خروج → ۴۰۱؛ ششمین تلاش ۴۲۹
- ✅ داشبورد حداقلی `/admin`: بدون جلسه → ۳۰۷ به صفحهٔ ورود؛ با جلسه → نام، نقش، پایان جلسه و دکمهٔ خروج (جایگزین موقت داشبورد فاز ۱۰)
- 📊 تست: `tests/amirali/admin-login-phase09.test.ts` (۲۲) + `admin-gate-phase09.test.ts` (۹) + `admin-auth-phase09.test.ts` (۱۵) — ۴۶ تست سبز
- ✅ داشبورد فاز ۱۰ (امیر) وصل شد: آمار اتاق‌ها/بازیکنان، لیست اتاق‌ها و خطاها زیر `AdminSessionGate`.

# 📋 فاز ۱۰ — پنل ادمین: آمار و مشاهده

**مالک:** امیر
**وابستگی:** ۰۹
**اولویت:** 🟡 متوسط
**مدت تخمینی:** ۳ روز

## هدف

داشبورد آمار (تعداد اتاق، بازیکن، خطا). مشاهدهٔ لیست اتاق‌ها و بازیکنان.

## چه فایل‌هایی را تغییر می‌دهی؟

- `src/app/admin/page.tsx` (داشبورد)
- `src/app/admin/rooms/page.tsx`
- `src/app/admin/players/page.tsx`
- `src/app/api/admin/stats/route.ts`
- `src/app/api/admin/rooms/route.ts`
- `src/app/api/admin/players/route.ts`
- `src/components/admin/StatsCard.tsx`
- `src/components/admin/RoomsTable.tsx`
- `src/components/admin/PlayersTable.tsx`
- `tests/amir/admin-stats.test.ts`

## محدودهٔ فایل

- `src/app/admin/**` (به‌جز `login/` و `layout.tsx` که در فاز ۰۹ ساخته شد)
- `src/app/api/admin/**` (به‌جز `login/` و `logout/`)
- `src/components/admin/**` (به‌جز `LoginForm.tsx` و `AdminSidebar.tsx`)
- `tests/amir/admin-stats.test.ts`

## معیار موفقیت

- ✅ داشبورد آمار را نشان می‌دهد.
- ✅ لیست اتاق‌ها را نشان می‌دهد.
- ✅ لیست بازیکنان را نشان می‌دهد.
- ✅ آمار با دیتابیس هم‌خوان است.

## وضعیت

- ✅ تکمیل شد
- ✅ `/api/admin/stats|players|rooms|errors` روی `src/server/admin/queries.ts` (SQLite و Supabase هر دو)
- ✅ `/admin` با کارت‌های آمار، لیست اتاق‌ها، لیست بازیکنان و صفحهٔ خطاها؛ همه پشت `AdminSessionGate`
- ✅ حذف بازیکن از پنل (`DELETE /api/admin/players/[id]`) با ثبت رویداد ادمین
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: `0437604`
- 📊 نتیجهٔ تست: `tests/amir/admin-auth.test.ts` (۱۸) + `admin-shell.test.ts` (۶) + `admin-*.test.ts` فاز ۱۰/۱۳؛ کل مجموعه ۵۷۹ تست سبز

---

# 📋 فاز ۱۱ — محتوای داستانی

**مالک:** علیرضا + نازنین
**وابستگی:** —
**اولویت:** 🟡 متوسط
**مدت تخمینی:** در طول همهٔ فازها

## هدف

داستان، دیالوگ، صدا، طراحی مراحل. این فاز **در طول همهٔ فازها** جریان دارد.

## محدودهٔ فایل علیرضا

- `src/audio/**` (صداهای داستانی)
- `src/components/cinema/**` (دیالوگ کات‌سین)
- `src/engine3d/**` (طراحی مراحل)

## محدودهٔ فایل نازنین

- `docs-v2/features/**` (توضیح داستان)
- `tests/qa/story-*.test.ts` (تست داستان)

**هیچ فایلی بین این دو نفر مشترک نیست.**

## معیار موفقیت

- ✅ داستان در `docs-v2/features/` توضیح داده شده.
- ✅ دیالوگ‌ها در کات‌سین پیاده شده.
- ✅ صداهای داستانی پخش می‌شوند.
- ✅ تست داستان سبز است.

## وضعیت

- ✅ تکمیل شد
- ✅ دیالوگ‌ها و cueهای صوتی (سهم علیرضا) در PR #114 و در کات‌سین واقعی mount شده‌اند
- ✅ داستان مرجع، شخصیت‌ها، پایان و واژه‌نامه: `docs/features/story.md` (Issue #97)
- ✅ `validateStoryScript()` + تست‌های روایت و زمان‌بندی صدا
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: `e46e4f5`
- 📊 نتیجهٔ تست: `tests/qa/story-narrative.test.ts` (۱۲) + `story-cue-timing.test.ts` (۶) + تست‌های کات‌سین/صدا — سبز

---

# 📋 فاز ۱۲ — HUD بازیکن در ۳D

**مالک:** امیرعلی
**وابستگی:** ۰۴
**اولویت:** 🟡 متوسط
**مدت تخمینی:** ۳ روز

## هدف

نشانگر جهت هم‌تیمی‌ها (فلش). نام هم‌تیمی بالای سرش.

## چه فایل‌هایی را تغییر می‌دهی؟

- `src/components/hud/presence/**` (جدید)
- `tests/amirali/presence-*.test.ts` (جدید)

## محدودهٔ فایل

- `src/components/hud/presence/**`
- `tests/amirali/presence-*.test.ts`

**به هیچ فایل دیگری دست نزن.** مخصوصاً `src/engine3d/**` (علیرضا).

## معیار موفقیت

- ✅ فلش جهت هم‌تیمی‌ها را نشان می‌دهد.
- ✅ نام هم‌تیمی بالای سرش است.
- ✅ وقتی هم‌تیمی از دید خارج می‌شود، فلش به سمتش اشاره می‌کند.
- ✅ FPS تحت تأثیر قرار نمی‌گیرد.

## وضعیت

- ✅ تکمیل شد
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: 127a542 (HUD) + aaa6d0c (merge) + به‌روزرسانی اتصال
- 📦 خروجی: `src/components/hud/presence/**` (مدل خالص + `PresenceHud` + `presence-contract` + `usePresenceFeed`) — ۵۱ تست سبز
- ✅ فلش جهت هم‌تیمی بیرون از دید و پشت سر، نام و فاصله روی سرِ هم‌تیمی در دید، حذف بعد از ۳۰ ثانیه (قرارداد ۲)
- ✅ **اتصال به صحنه انجام شد**: `PresenceHud` + `usePresenceFeed` در `AlleyRoomThreeIntegration` mount شدند و از `room.players` نام هم‌تیمی‌ها را می‌گیرند.
- ✅ **لایهٔ قرارداد** در `presence-contract.ts`: `POST /api/rooms/{code}/presence` با `x-seat-token` و بدنهٔ `{position, yaw(rad), phase}` (بدون `playerId`/`seatIndex` — هویت از توکن)، دریافت `presence_update` = `{presences, serverNow}`، یاو رادیان↔درجه، هم‌جوشی ۵۰ms، throttle ۱۰Hz، `keepalive` ۱s.
- ✅ **fail-safe سرویس غایب**: probe اولیه با `AbortSignal.timeout(3000)`؛ اگر سرویس حضور وجود نداشت (۴۰۴/۴۰۵)، hook یک بار بررسی می‌کند و **بی‌صدا خاموش** می‌ماند — نه ۴۰۴ پشت‌سرهم، نه EventSource دوم. پس از ۵ خطای پیاپی هم ارسال متوقف می‌شود.
- ✅ **سرور حضور وصل شد**: `src/app/api/rooms/[code]/presence/route.ts` + `presence-service.ts` + `presence-tracker.ts` و رویداد `presence_update` روی استریم. اکنون مسیر کامل «کلاینت → سرور → استریم → HUD» با smoke زنده تأیید شده است.
- ℹ️ `src/contracts/presence.ts` ساخته نشد (نوع‌ها در دو لایهٔ مجاز خودشان تعریف شده‌اند)؛ اگر توحید قرارداد مشترک را ساخت، `presence-contract.ts` همان شکل سیمی را دارد و تغییری لازم نیست.
- 📊 تست: `tests/amirali/presence-phase12.test.ts` (۳۲) + `presence-contract.test.ts` (۲۱) + `presence-server-phase12.test.ts` (۲۴) = **۷۷ تست سبز**

# 📋 فاز ۱۳ — ابزارهای مدیریتی

**مالک:** امیر
**وابستگی:** ۰۹
**اولویت:** 🟢 پایین
**مدت تخمینی:** ۲ روز

## هدف

حذف بازیکن. مشاهدهٔ لیست خطاها.

## چه فایل‌هایی را تغییر می‌دهی؟

- `src/app/admin/errors/page.tsx` (جدید)
- `src/app/api/admin/errors/route.ts` (جدید)
- `src/app/api/admin/players/[id]/route.ts` (جدید)
- `src/components/admin/ErrorsTable.tsx` (جدید)
- `tests/amir/admin-players.test.ts` (جدید)

## محدودهٔ فایل

- `src/app/admin/errors/**`
- `src/app/api/admin/errors/**`
- `src/app/api/admin/players/**`
- `src/components/admin/ErrorsTable.tsx`
- `tests/amir/admin-players.test.ts`

## معیار موفقیت

- ✅ می‌توان بازیکن را حذف کرد.
- ✅ لیست خطاها نمایش داده می‌شود.
- ✅ خطاها با زمان و کد نمایش داده می‌شوند.

## وضعیت

- ✅ تکمیل شد
- ✅ حذف بازیکن با تأیید دو مرحله‌ای در پنل (`/admin/players`) و `DELETE /api/admin/players/[id]`
- ✅ لیست خطاها با کد، زمان و پیام از `admin_events` (صفحهٔ `/admin/errors` + `GET /api/admin/errors`)
- ✅ هر عملیات مدیریتی به‌صورت رویداد در دیتابیس ثبت می‌شود (`recordAdminEvent`)
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: `0437604`
- 📊 نتیجهٔ تست: تست‌های ادمین فاز ۱۰/۱۳ (شامل ۴۰۱/۴۰۳ روی مسیر حذف و اعتبارسنجی ورودی) — سبز

---

# 📋 فاز ۱۴ — QA تجربه

**مالک:** نازنین
**وابستگی:** ۰۴، ۰۵، ۰۷
**اولویت:** 🟢 پایین
**مدت تخمینی:** ۴ روز

## هدف

مرور کل مسیر بازی. تست سخت‌افزارهای مختلف. تست تجربهٔ بازیکن.

## چه فایل‌هایی را تغییر می‌دهی؟

- `tests/qa/**` (جدید)
- `docs-v2/checklists/**` (بازبینی)

## محدودهٔ فایل

- `tests/qa/**`
- `docs-v2/checklists/**`

**به هیچ فایل کدی دست نزن.**

## معیار موفقیت

- ✅ کل مسیر بازی (رزرو به کوچه به کات‌سین به سالن به فرار) تست شده.
- ✅ روی دسکتاپ ۶۰ FPS و موبایل ۳۰+ FPS.
- ✅ هیچ خطای کنسولی نیست.
- ✅ چک‌لیست `before-release.md` پر شده.

## وضعیت

- 🟡 در حال انجام
- ✅ مسیر کامل بازی تست شد: `tests/qa/game-path.test.ts` (۸ تست) — ترتیب فازها، مرزهای ۱۱s/۷۴s، هم‌گامی کلاینت با ساعت سرور، شروع سالن تاریک، نبود توکن/seed در نمای کلاینت
- ✅ روایت و صدا: `tests/qa/story-narrative.test.ts` + `tests/qa/story-cue-timing.test.ts`
- ⏳ باقی‌ماندهٔ دستی: سنجش FPS روی دسکتاپ/موبایل واقعی و پر کردن `docs/checklists/before-release.md` (نیازمند اجرای انسان روی دستگاه)
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: `e46e4f5`
- 📊 نتیجهٔ تست: ۲۰ تست QA سبز؛ کل مجموعه ۵۷۹ تست در ۵۴ فایل

---

# 📋 فاز ۱۵ — انتشار نهایی

**مالک:** توحید
**وابستگی:** همه
**اولویت:** 🔴 بحرانی
**مدت تخمینی:** ۲ روز

## هدف

انتشار نهایی روی Vercel Production. Smoke test. اعلام به تیم.

## چه فایل‌هایی را تغییر می‌دهی؟

- `.github/workflows/deploy.yml` (تنظیمات نهایی)
- `docs-v2/checklists/before-release.md` (پر کردن)
- `CHANGELOG.md` (جدید یا به‌روزرسانی)

## معیار موفقیت

- ✅ production deploy شده.
- ✅ smoke test روی production سبز است.
- ✅ لینک نهایی به تیم داده شده.
- ✅ `CHANGELOG.md` به‌روز است.

## وضعیت

- 🚫 مسدود — انتشار نهایی انجام نشده
- ✅ `deploy.yml` نوشته شد و `CHANGELOG.md` به‌روز است
- 🚫 production کهنه است: `https://escaperoom-orfeo.vercel.app/api/health` سالم است (storageDriver=supabase) ولی `/admin/login` هنوز ۴۰۴ می‌دهد
- 🚫 متغیرهای `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` روی Vercel ست نیستند
- 🚫 `.github/workflows` روی `main` وجود ندارد، پس deploy خودکار از `main` اجرا نمی‌شود
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: —
- 📊 نتیجهٔ تست: اجرای محلی سبز (۵۷۹ تست)؛ smoke روی production ناقص — فقط `/api/health`

---

## چطور وضعیت یک فاز را به‌روز کنم؟

در بخش «وضعیت» همان فاز، یکی از این‌ها را بنویس:

- ⏳ در انتظار شروع
- 🟡 در حال انجام (تاریخ شروع)
- ✅ تکمیل شد (تاریخ + کامیت مرجع + نتیجهٔ تست)
- 🚫 مسدود شد (دلیل + فاز مسدودکننده)

مثال:

```
## وضعیت

- ✅ تکمیل شد
- 📝 تاریخ: ۱۴۰۵/۰۸/۰۱
- 🔗 کامیت مرجع: abc1234
- 📊 نتیجهٔ تست: npm test — ۳۲ فایل، ۳۴۵ تست سبز
