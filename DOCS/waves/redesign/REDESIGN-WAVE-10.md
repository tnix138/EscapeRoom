---
document_type: implementation_record
status: implemented_pending_owner_review
wave: 10
owner: امیرعلی
intended_audience: coding_agents_only
human_reading: not_required
---

# موج ۱۰ — QA تجربه (۳۲۰px، زوم ۲۰۰٪، RTL، صفحه‌کلید و خطا)

**دامنه:** `src/app/globals.css` (بلوک «موج ۱۰»، فقط افزودن قاعده)،
`src/components/hud/WhisperChatPanel.tsx` (بستن با Esc + بازگشت فوکوس) و
`tests/amirali/experience-qa-wave10.test.ts` (جدید).

**خارج از دامنه:** `src/engine3d/**`، `src/components/auditorium/**`،
`src/components/cinema/**`، `src/app/preview/**` و `src/app/room/**` — مالکیت علیرضا.
هیچ فایلی از او تغییر نکرد؛ مسیر اتاق فقط خوانده و بررسی شد.

## مسئله

موج‌های ۲ تا ۹ هرکدام یک سطح را ساختند، ولی هیچ‌کس کل مسیر
reserve → invite → alley → puzzle → cutscene → exploration را در شرایط سخت
(۳۲۰px، زوم ۲۰۰٪، صفحه‌کلید، وضعیت خطا) یک‌جا نسنجیده بود. موج ۱۰ فقط QA است:
اول اندازه‌گیری، بعد کوچک‌ترین اصلاح لازم، و در پایان یک قرارداد کیفیت که در تست
قفل شود.

## روش سنجش

۱) **ممیزی CSS** با تجزیهٔ برنامه‌ای `globals.css`: همهٔ `width/min-width/height`های
ثابت، `position: fixed`ها، قالب‌های گرید با ستون ثابت، `100vw`ها و `font-size`ها
استخراج و با عرض ۳۲۰px و ارتفاع ~۳۸۴px (زوم ۲۰۰٪ روی نمایشگر ۱۳۶۶×۷۶۸) سنجیده شد.
۲) **مرور فلو روی سرور واقعی** (dev server + SQLite محلی): رزرو سه‌نفره، ورود هر
سه صندلی، تماشای دعوت‌نامه، حل معما از دادهٔ همان view که مرورگر می‌بیند، باز کردن
قفل، گذر از دو کات‌سین و بررسی سالن.
۳) **کنتراست** جفت‌های متن/زمینهٔ واقعی با فرمول WCAG محاسبه شد.
۴) **قرارداد کیفیت** در `tests/amirali/experience-qa-wave10.test.ts` نوشته شد تا
این بررسی‌ها در هر PR دوباره اجرا شوند.

## یافته‌ها و اصلاح‌ها

| # | یافته | اصلاح |
| --- | --- | --- |
| ۱ | پنل نجوای گروهی با Escape بسته نمی‌شد؛ بازیکن صفحه‌کلید داخل پنل گیر می‌کرد (تنها لایهٔ روی صحنه بدون Esc). | هندلر `Escape` + بازگشت فوکوس به سربرگ پنل (`toggleRef`) و تست اختصاصی. |
| ۲ | دکمهٔ بستن مودال قفل در، در پالایش موج ۴ به ۳۶px کوچک شده بود. | `width/height: var(--control-height)` = ۴۴px. |
| ۳ | دکمهٔ «بازپخش دعوت‌نامه» در نوار کوچه `min-height: 40px` بود. | `min-height: var(--control-height)`. |
| ۴ | دکمه‌های چرخش دوربین در نمای کلاسیک ۳۲×۳۲ بودند. | ۴۴×۴۴ با `min-width/min-height`. |
| ۵ | دکمهٔ بستن «نشانهٔ داستان» در HUD همراهان ۳۲×۳۲ بود. | ۴۴×۴۴ با حاشیهٔ منفی جبرانی تا چیدمان سربرگ به‌هم نریزد. |
| ۶ | فهرست پیام‌های نجوا ارتفاع ثابت ۲۰۴–۲۴۸px داشت؛ در زوم ۲۰۰٪ (ارتفاع ~۳۸۴px) دکمهٔ ارسال از صفحه بیرون می‌زد. | `max-height: min(248px, 34svh)` تا فهرست با ارتفاع صفحه نفس بکشد. |
| ۷ | `.whisper-panel`/`.whisper-expanded` در عرض پایه `max-width` نداشتند (فقط در مدیاکوئری). | `max-width: calc(100vw - 16px)` در همهٔ عرض‌ها. |
| ۸ | نمای کوچه در پنجرهٔ کوتاه (زوم ۲۰۰٪) ارتفاع ثابت ۵۴۰px داشت و اسکرول عمودی می‌ساخت. | `height/min-height: min(540px, 76svh)` در `≤720px`. |

**چیزهایی که سنجیده شد و سالم بود (بدون تغییر):** هیچ `font-size` زیر ۱۲px وجود
ندارد؛ هیچ `min-width` بالای ۲۸۸px نیست؛ همهٔ HUDهای ثابت عرضشان با `100vw` مهار
شده؛ `.reservation-layout` در `≤620px`، `.ticket-pair` در `≤680px` و
`.invitation-controls` در `≤380px` تک/دوستونه می‌شوند؛ ورودی‌ها، گزینه‌های شمارش
و کلیدهای کی‌پد از قبل ≥۴۴px بودند؛ `prefers-reduced-motion` پوشش دارد.

## مرور فلو (شاهد اجرایی)

| مرحله | بررسی | نتیجه |
| --- | --- | --- |
| رزرو | `POST /api/rooms` با ۳ نام → `201`, `roomCode`, سه لینک دعوت نام‌دار | ✅ |
| دعوت | باز شدن `/invite/:code/:token` برای هر سه صندلی (`200`) و پذیرش `COMPLETE_INVITATION_VIDEO` | ✅ |
| کوچه | فاز `alley_puzzle` برای هر سه بازیکن، `joined=true`، دادهٔ بلیط/کوپن/پلاکارد/جدول ردیف | ✅ |
| معما | حل پانچ از دادهٔ همان view بازیکن (نماد از کوپن نفر قبلی، پرده از پلاکارد، ردیف از جدول) → `accepted: true` برای هر سه؛ رقم‌های طلایی ۷،۵،۲ | ✅ |
| قفل در | `UNLOCK_THEATER_DOOR` با کد سه‌رقمی → «قفل چرخید»؛ `punchedCount 3/3` | ✅ |
| کات‌سین | در `door_cutscene` هر اکشن دیگر `409 CUTSCENE_LOCKED` می‌گیرد؛ گذر `door_cutscene → theater_cutscene → in_theater` در ~۸۰ ثانیه | ✅ |
| کاوش | `INSPECT_AUDITORIUM_HOTSPOT` پذیرفته شد و در view هم‌تیمی هم دیده شد (`shattered-chandelier: ["بهرام"]`) — همان داده‌ای که HUD موج ۹ مصرف می‌کند | ✅ |

صفحه‌های عمومی در SSR: `/`، `/preview/invitation`، `/preview/alley`،
`/preview/auditorium`، `/preview/cinema`، `/qa/exploration`، `/api/health` → همه `200`.

## تست‌ها

- `tests/amirali/experience-qa-wave10.test.ts` — **۱۹ تست** در ۶ دسته: RTL و پوسته،
  ۳۲۰px و زوم (مهار عرض پنل‌های ثابت، `svh`، فروپاشی گریدها، سقف `min-width`)،
  هدف لمسی ۴۴px برای ۱۸ کنترل، کنتراست ۸ جفت رنگ، صفحه‌کلید/فوکوس/خطا
  (Esc در پنج لایه، `aria-modal`, `role="alert"`, `aria-invalid`, نبود
  `dangerouslySetInnerHTML`) و ترتیب فلو (رزرو ← دعوت ← اتاق و نگاشت هر فاز به صحنه).
- `npm run typecheck` → بدون خطا.
- `npm run test:amirali` → ۱۰ فایل، ۱۵۸ تست موفق.
- `npm test` → ۳۳ فایل، ۳۰۹ تست موفق.
- `npm run build` → موفق، ۱۶ مسیر.
- دود dev + مرور فلو بالا روی همان سرور.

## محدودیت‌ها و باقی‌مانده

- در این محیط مرورگر واقعی (Chromium) نصب نیست؛ بنابراین بازبینی چشمی
  screenshot-based و اجرای `npm run test:e2e:alireza` (Playwright) انجام نشد.
  به‌جای آن: ممیزی CSS، رندر SSR، مرور فلو روی API واقعی و تست قرارداد.
- نصب HUD کاوش در `DarkAuditoriumScene` (مالکیت علیرضا) هنوز تحویل‌نشده است؛ تا
  آن زمان در فاز `in_theater` HUD دیده نمی‌شود (داده‌اش آماده و در تست تأیید شده).
- بازبینی چشمی نهایی ۳۲۰px/زوم روی دستگاه واقعی به تیم انسانی سپرده می‌شود.
