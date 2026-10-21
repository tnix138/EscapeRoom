---
document_type: implementation_record
status: implemented_pending_owner_review
wave: 9
owner: امیرعلی
intended_audience: coding_agents_only
human_reading: not_required
---

# موج ۹ — HUD کاوش سالن تاریک

**دامنه:** `src/components/hud/exploration-hud.ts` (جدید)،
`src/components/hud/ExplorationHud.tsx` (جدید)،
`src/components/hud/WhisperChatPanel.tsx` (پشتیبانی از حالت کنترل‌شده)،
دو پوستهٔ کوچهٔ تحت مالکیت امیرعلی (`AlleyFirstPersonScene.tsx`،
`AlleyRoomThreeIntegration.tsx`)، `src/app/qa/exploration/page.tsx` (سطح بازبینی،
خارج از مسیر بازیکن)، `src/app/globals.css` و `tests/amirali/exploration-wave9.test.ts` (جدید).

**خارج از دامنه:** `src/engine3d/**`، `src/components/auditorium/**`،
`src/components/cinema/**` و `src/app/preview/**` — مالکیت علیرضا. هیچ فایلی از او تغییر نکرد.

## مسئله

- در سالن تاریک بازیکن نمی‌دانست چه اهدافی مانده، کدام بخش سالن را خودش یا هم‌تیمی‌ها
  بررسی کرده‌اند و کجای مسیر شش‌مرحله‌ای ایستاده است.
- پنل نجوای گروهی فقط از دکمهٔ خودش باز می‌شد؛ از داخل جریان کاوش میان‌بری نداشت.
- هر HUD تازه اگر وسط صحنه باز شود دید اول‌شخص را می‌بندد؛ در موج‌های قبل
  نجوای گروهی (بالا-چپ)، اعلان حرکت (بالا-وسط) و HUD همراهان (بالا-راست) سه گوشهٔ
  بالای صفحه را گرفته بودند.

## راه‌حل

### ۱) منطق خالص — `src/components/hud/exploration-hud.ts`

بدون DOM و بدون واکشی؛ همهٔ ورودی‌ها از *view سرور* می‌آید (`phase`، `players`،
`auditorium.inspectedHotspots`، پیام‌ها، `doorLockState`).

- `isExplorationPhase` — HUD فقط در `alley_puzzle` و `in_theater` دیده می‌شود؛ در
  کات‌سین‌ها و فازهای بسته پنهان است.
- `HALL_HOTSPOTS` — چهار بخش سالن (لوستر شکسته، تابلوهای کج، سه سِن تاریک، درهای قفل)
  با عنوان و راهنمای گشت، هم‌راستا با `AuditoriumHotspotId` سرور.
- `ALLEY_CLUES` — دو سرنخ کوچه (`playbill`, `rowChart`).
- `objectivesFor` — کوچه: خواندن سرنخ‌ها، پانچ بلیط خود، پانچ کل تیم، چرخاندن قفل؛
  سالن: گشت چهار بخش، در میان گذاشتن یادداشت‌ها (پیام گروهی)، بازگشت همه به آنلاین،
  و «نشانهٔ راه خروج» که `countsForProgress: false` است و در درصد پیشرفت شمرده نمی‌شود.
- `notesFor` — وضعیت هر بخش با **متن**: «هنوز بررسی نشده» / «شما بررسی کردید · N نفر» /
  «X بررسی کرده» / «خوانده‌اید»؛ هرگز فقط رنگ نیست.
- `trailFor` — شش گام «رسیدن به کوچه → بررسی سالن تاریک» با دقیقاً یک گام `current`.
  اگر بازی از کوچه گذشته باشد گام‌های قبلی «انجام شد» می‌شوند (سرنخ‌ها در نشست
  قبلی خوانده شده‌اند و کلاینت آن را نگه نمی‌دارد).
- `explorationProgress` / `buildExplorationState` / `describeProgress` /
  `compactSummary` / `describeNote` — درصد، برچسب فارسی («۲ از ۴ هدف») و متن
  صفحه‌خوان. همهٔ اعداد با `toPersianNumber` ساخته می‌شوند.
- هیچ پاسخ معما، رقم در یا توکن صندلی دیگر در خروجی نیست (تست الگوهای ممنوعه).

### ۲) کامپوننت — `ExplorationHud`

سه حالت `collapsed | open | hidden`؛ پیش‌فرض **بسته** تا دید صحنه باز بماند.

- دکمهٔ جمع‌شده (`aria-expanded`، `aria-controls`) خلاصهٔ پیشرفت را نشان می‌دهد.
- پنل: نوار پیشرفت `role="progressbar"` با `aria-valuenow`، موقعیت فعلی، فهرست
  اهداف، یادداشت‌های بررسی، مسیر شش‌گامی و بخش گفتگوی گروهی با آخرین پیام.
- پنل همیشه در DOM است و با `hidden` بسته می‌شود؛ پس `aria-controls` همیشه به یک
  مقصد معتبر اشاره می‌کند.
- `role="status"` + `aria-live="polite"` فقط هنگام تغییر پیشرفت اعلام می‌کند (نه هر رندر).
- Esc پنل را می‌بندد و فوکوس را به دکمهٔ اصلی برمی‌گرداند.
- «باز کردن گفتگوی گروهی» با `onOpenChat` به پنل نجوا وصل می‌شود.
- «پنهان کردن برای دید بهتر صحنه» HUD را به یک دکمهٔ کوچک بازیابی تبدیل می‌کند.

### ۳) اتصال واقعی به هر دو پوستهٔ کوچه

- `visitedClues` در هر پوسته با باز شدن هر سرنخ (دکمه یا کلید E) ثبت می‌شود؛
  در نمای سه‌بعدی تابع `openClue` هم‌زمان وضعیت باز/بسته را عوض می‌کند.
- `explorationInput` از `room.phase`، بازیکنان، `doorLockState`، پیام‌ها، سرنخ‌های
  دیده‌شده و موقعیت دوربین ساخته می‌شود (در نمای کلاسیک با `useMemo`).
- `WhisperChatPanel` حالا `open`/`onOpenChange` اختیاری می‌گیرد
  (`const isOpen = open ?? internalOpen`)؛ میان‌بر HUD دقیقاً همان پنل را باز می‌کند.

### ۴) چیدمان و خوانایی (`globals.css` — بلوک «موج ۹»)

- `.exploration-hud` ثابت در **پایین-چپ** (`bottom: 96px`، `left: clamp(12px, 2vw, 22px)`،
  عرض `min(380px, 100vw - 32px)`) تا مرکز صحنه، نجوای بالا-چپ، اعلان حرکت بالا-وسط و
  HUD همراهان بالا-راست دست‌نخورده بمانند. `pointer-events: none` روی قاب و `auto`
  فقط روی کنترل‌ها، پس بوم صحنه کلیک/درگ خودش را از دست نمی‌دهد.
- چیدمان `column-reverse`: دکمهٔ جمع‌شده سر جای خود می‌ماند و پنل به سمت **بالا** باز
  می‌شود (`max-height: min(64vh, 540px)`).
- همهٔ هدف‌های لمسی ≥۴۴px؛ هیچ `font-size` زیر ۱۲px؛ برچسب وضعیت هدف/یادداشت/مسیر
  ۱۴px است و متن «۱ از ۳» با جهت طبیعی فارسی (بدون `direction: ltr`) خوانده می‌شود.
- موبایل (`≤720px`): `bottom: 104px` — بالاتر از کنترل دوربین نمای کلاسیک و نوار
  پایین نمای سه‌بعدی؛ برچسب‌ها به `42vw` محدود می‌شوند تا دکمه از صفحه بیرون نزند.

### ۵) سطح بازبینی `/qa/exploration`

صفحهٔ کلاینتی مستقل (خارج از مسیر بازیکن و بدون لینک از بازی) که همان fixture رسمی
`createPreviewRoomState('in_theater')` را می‌گیرد و چهار دکمهٔ «بررسی بخش سالن»،
«افزودن پیام گروهی»، «پاک کردن» و «ریست پنل» دارد. با این صفحه می‌توان HUD را بدون
دست‌زدن به `DarkAuditoriumScene` (مالکیت علیرضا) چشمی و دستی آزمود. SSR آن شامل کل
مارک‌آپ HUD است و برای دود خودکار هم استفاده می‌شود.

### ۶) تحویل یک‌خطی به سالن

نصب HUD در صحنهٔ سالن به مالک آن سپرده شده است:

```tsx
<ExplorationHud
  input={{ phase: room.phase, me, players, auditorium: room.auditorium, messages: room.messages }}
  onOpenChat={() => setChatOpen(true)}
/>
```

HUD خودش `visible` را از `phase` می‌فهمد؛ در `in_theater` با
`room.auditorium.inspectedHotspots` کار می‌کند و به هیچ تغییر دیگری در صحنه نیاز ندارد.

## تست‌ها

- `tests/amirali/exploration-wave9.test.ts` — **۲۳ تست**: دیده‌شدن در فازهای درست،
  هدف‌های کوچه/سالن، شمارش از view سرور، تیم ۳ تا ۸ نفره، هدف سرنخ بدون اثر در درصد،
  وضعیت یادداشت‌ها (من/دیگران/دست‌نخورده)، یک گام `current`، پیشروی گام‌ها پس از عبور
  از کوچه، خلاصهٔ پیام، اعلام صفحه‌خوان، نبود رقم لاتین و پاسخ معما، وجود HUD در هر دو
  پوسته، کنترل پنل نجوا، و نگهبان چیدمان (پایین-چپ، `column-reverse`، `z-index`،
  نبود `direction: ltr`، موبایل `104px`).
- `npm run typecheck` → بدون خطا.
- `npm run test:amirali` → ۹ فایل، ۱۳۹ تست موفق.
- `npm test` → ۳۲ فایل، ۲۹۰ تست موفق.
- `npm run build` → موفق، ۱۶ مسیر (شامل `/qa/exploration`).
- دود روی dev server: `/`, `/preview/invitation`, `/preview/alley`,
  `/preview/auditorium`, `/qa/exploration`, `/api/health` → همه ۲۰۰؛ SSR
  `/qa/exploration` شامل «پیشرفت کاوش: ۱ از ۳ هدف» و «پنهان کردن برای دید بهتر صحنه».
- بازبینی دستی کد: بدون `fetch`/`EventSource`، بدون دادهٔ پاسخ، بدون تغییر در
  `src/engine3d/**`، `auditorium/**`، `cinema/**` یا `app/preview/**`.

## باقی‌مانده

- نصب HUD در `DarkAuditoriumScene` (مالکیت علیرضا) — رابط آماده و مستند است.
- بازبینی ۳۲۰px و زوم ۲۰۰٪ در موج ۱۰.
