---
document_type: implementation_record
status: implemented_pending_owner_review
wave: 7
owner: امیرعلی
intended_audience: coding_agents_only
human_reading: not_required
---

# موج ۷ — رابط سالن و شخصیت‌ها

**دامنه:** `src/components/alley/AlleyFirstPersonScene.tsx`،
`src/components/alley/AlleyRoomThreeIntegration.tsx`،
`src/components/hud/theater-roster.ts` (جدید)، `src/components/hud/TheaterCompanionHud.tsx`
(جدید)، `src/app/globals.css` و `tests/amirali/theater-companion-wave7.test.ts` (جدید).

**خارج از دامنه:** `src/components/auditorium/**`، `src/components/cinema/**`،
`src/app/room/**` و `src/engine3d/**` — مالکیت علیرضا. هیچ mesh، کاراکتر، دوربین یا
داده‌ای ساخته/تغییر نشد.

## مسئله

در کوچه، تنها راه دیدن هم‌تیمی‌ها چند چراغ کوچک روی در بود: نه برچسب صندلی، نه وضعیت
آنلاین، نه توضیحی از اینکه الان باید چه کاری کرد. در سالن هم فهرست حاضرین بدون
«صندلی» و بدون نشانهٔ داستان نمایش داده می‌شد. بازیکن تازه‌وارد نمی‌دانست کدام نام
صاحب کدام صندلی است و فصل جاری چه انتظاری دارد.

## راه‌حل

### ۱) قواعد خالص — `theater-roster.ts`
- `buildRoster` فهرست را بر اساس `seatIndex` مرتب می‌کند، صندلی جاری را «تو» می‌کند و
  برای هر نفر `seatLabel` (با جایگزین «صندلی ۰۳»)، وضعیت «آنلاین/آفلاین» و پیشرفت
  («بلیط پانچ‌شده» / «دعوت‌نامه دیده‌شده» / «در انتظار ورود») می‌سازد.
- `presenceSummary` خلاصهٔ «۳ از ۵ نفر آنلاین» را با ارقام فارسی می‌دهد.
- `storyCueFor(phase, stats)` برای `alley_puzzle`، `door_cutscene`، `theater_cutscene`،
  `in_theater` (و فاز ناشناخته) فصل/عنوان/جملهٔ راهنما می‌سازد؛ متن‌ها فقط شمارش
  عمومی می‌گویند و هیچ رقم طلایی یا پاسخ معما در آن‌ها نیست.
- `describeRosterEntry` یک توصیف کامل برای صفحه‌خوان می‌سازد.

### ۲) کامپوننت — `TheaterCompanionHud`
- پیش‌فرض **بسته** است تا دید صحنه آزاد بماند؛ فقط یک نوار کوتاه «هم‌سفران تماشاخانه»
  با خلاصهٔ آنلاین‌ها دیده می‌شود.
- باز شدن با دکمه (`aria-expanded`، `aria-controls`) — بدون شورتکات سراسری تا با
  `W/A/S/D`، `E` و `H` تداخل نکند.
- فهرست `<ul>` با `aria-label`؛ هر ردیف `aria-label` کامل (نام، صندلی، آنلاین، پیشرفت)
  دارد؛ وضعیت آنلاین هم با نقطه و هم با متن بیان می‌شود.
- نشانهٔ داستان با `aria-live="polite"` و دکمهٔ بستن با `aria-label`؛ بستن هر نشانه
  تا تغییر فاز ماندگار است.
- هیچ `fetch`/`EventSource` ندارد؛ فقط از view سرور تغذیه می‌شود (بدون اتصال دوم).

### ۳) نصب
- در `AlleyFirstPersonScene` بین سربرگ و پانوراما، و در `AlleyRoomThreeIntegration`
  روی لایهٔ سه‌بعدی رندر می‌شود.
- برای سالن، همان کامپوننت با `phase="in_theater"` و
  `inspectedCount`/`hotspotTotal` آماده است؛ mount در `DarkAuditoriumScene` (مالکیت
  علیرضا) باید با هماهنگی/PR جدا انجام شود. این موج عمداً به مسیر او دست نزده است.

### ۴) چیدمان و خوانایی
- دسکتاپ: `position: fixed` گوشهٔ بالا-راست، عرض ۳۰۴px، `max-height: 62vh` با اسکرول.
- موبایل: زیر سربرگ دو‌ردیفی (`top: 112px`)، عرض `min(304px, 100vw - 16px)`.
- فونت‌ها با توکن `--text-*` (۱۲px به بالا)، ردیف‌ها ۴۶px و دکمهٔ تاگل ۵۴px؛
  `z-index: 11` پایین‌تر از مودال قفل (۳۰) و پنل سرنخ (۴۰) است.

## تست‌ها

`tests/amirali/theater-companion-wave7.test.ts` — ۱۲ تست:
ترتیب/شناسهٔ صندلی برای گروه‌های ۳ تا ۸ نفر، «تو» شدن، برچسب جایگزین صندلی،
خلاصهٔ آنلاین، توصیف دسترس‌پذیر، نشانهٔ داستان برای چهار فاز + فاز ناشناخته،
نبود کد سه‌رقمی در متن‌ها، ماندگاری بستن نشانه، و گاردهای markup/CSS
(`aria-expanded`/`aria-controls`/`aria-live`، عدم fetch، نصب در دو پوسته،
`position: fixed` گوشهٔ صفحه و فونت ≥۱۲px).

`npm run typecheck` ✅ · `npm run test:amirali` ۹۰ تست ✅ · `npm test` ۲۳۷ تست ✅ ·
`npm run build` ۱۴ مسیر ✅

## باقی‌مانده برای موج‌های بعد

- زیرنویس/صدا (موج ۸)، HUD کاوش سالن تاریک (موج ۹) و QA نهایی ۳۲۰px/زوم ۲۰۰٪ (موج ۱۰).
- mount سالن توسط مالک `DarkAuditoriumScene` با همان props (فقط `room.players`،
  `room.me.playerId`، `room.phase`، `inspectedCount` و `hotspotTotal`).
