---
document_type: implementation_record
status: implemented_pending_owner_review
wave: 6
owner: امیرعلی
intended_audience: coding_agents_only
human_reading: not_required
---

# موج ۶ — بلیط و معما

**دامنه:** `src/components/alley/HeldTicketsDrawer.tsx`، `TheaterDoorLockModal.tsx`،
`AlleyFirstPersonScene.tsx`، `AlleyRoomThreeIntegration.tsx`،
`src/components/alley/puzzle-rules.ts` (جدید)، `src/components/hud/WhisperChatPanel.tsx`،
`src/components/hud/chat-rules.ts` (جدید)، `src/app/globals.css` و
`tests/amirali/puzzle-wave6.test.ts` (جدید).
بدون تغییر در API، `src/engine3d/**` یا قواعد بازی.

## مسئله

- پانچ بلیط با سه `<select>` بومی بود: در موبایل کوچک، با کیبورد فقط Tab/Tab، و بدون خلاصهٔ
  روشن از انتخاب فعلی. دکمهٔ پانچ ۳۴px و صفحه‌کلید قفل ۳۴px بود.
- پشت کوپن با ترنسفورم پنهان می‌شد ولی همچنان با Tab قابل دسترسی بود.
- مودال قفل نه تلهٔ فوکوس داشت، نه Esc، نه بازگشت فوکوس؛ ارقام واردشده هم جای مشخصی
  نداشتند و وضعیت تیم فقط با رنگ چراغ‌ها منتقل می‌شد.
- در دو صحنه، اگر سرور رقم را همگام نکرده بود، کلاینت **رقم حدسی** می‌ساخت
  (`Math.random` و `(4 + seatIndex * 3) % 10`) — خلاف قاعدهٔ «پاسخ پنهان را حدس نزن».
- نجوای گروهی شمارندهٔ «خوانده‌نشده» واقعی نداشت، نوع پیام (کوپن/سیستم) مشخص نبود و
  ورودی/دکمه‌ها زیر ۴۴px بودند.

## راه‌حل

### ۱) قواعد خالص معما — `puzzle-rules.ts`
- `sanitizeDoorCode` ارقام فارسی/عربی را لاتین می‌کند، جداکننده‌ها را می‌ریزد و به طول لازم
  محدود می‌کند (چسباندن کد پشتیبانی می‌شود).
- `doorCodeProgress` خانه‌های پر/خالی را برمی‌گرداند؛ `describeDigitProgress` متن وضعیت
  فارسی می‌سازد.
- `teamTicketSummary`/`describeTeamReadiness` وضعیت گروه را با متن بیان می‌کنند (نه فقط رنگ).
- `resolveOwnRevealedDigit` فقط عدد صحیح ۰–۹ را از view سرور می‌پذیرد و در نبود آن
  `null` می‌دهد؛ هیچ محاسبه یا حدسی در کار نیست.
- `keypadKeyLabel` برچسب دسترس‌پذیر کلیدهای قفل را می‌سازد.

### ۲) بلیط و کوپن
- سه گروه رادیوی بومی با `fieldset`/`legend`: ۸ نماد (شبکهٔ ۴×۲، ۵۲px)، پردهٔ ۱–۴ و
  ردیف I–IV؛ کلیدهای جهت‌دار مرورگر بدون کد اضافه کار می‌کنند.
- خلاصهٔ انتخاب با `aria-live` و `aria-describedby` روی دکمهٔ پانچ.
- دکمهٔ پانچ ۴۶px؛ در حالت موفق کارت تأیید با رقمِ خود بازیکن یا پیام
  «در انتظار همگام‌سازی سرور…» (بدون حدس).
- کوپن: چهرهٔ پنهان با `visibility` (و نه فقط transform) از ترتیب Tab خارج می‌شود،
  `aria-expanded`/`aria-controls` روی دکمهٔ برگرداندن، فوکوس روی عنوان پشت کوپن، و
  وضعیت زندهٔ «مخابرهٔ سرنخ».

### ۳) قفل در
- `role="dialog"` + `aria-modal` + `aria-labelledby`/`aria-describedby`.
- تلهٔ فوکوس با Tab/Shift+Tab، بستن با Esc، بازگشت فوکوس به دکمهٔ بازکننده.
- خانه‌های رقم (`.lock-slots`) با ارقام فارسی و وضعیت پر/خالی؛ ورودی `inputMode="numeric"`
  با چسباندن و `aria-invalid`.
- صفحه‌کلید ۴۶px با برچسب «رقم ۷»/«حذف رقم آخر»/«پاک کردن همهٔ ارقام».
- وضعیت تیم: شمارش «۲ از ۵»، هر هم‌تیمی با `aria-label` و علامت ✓/• و پیام متنی
  «هنوز ۳ بلیط پانچ نشده است».
- دکمهٔ چرخاندن قفل فقط با کد کامل فعال می‌شود؛ متن پیشرفت علت غیرفعال بودن را می‌گوید.

### ۴) نجوای گروهی
- `role="log"` + `aria-live="polite"` + `aria-relevant="additions"`.
- شمارندهٔ واقعی خوانده‌نشده بر اساس آخرین بار باز شدن پنل؛ `aria-label` روی نشان.
- برچسب نوع پیام: «نجوا»/«کوپن»/«سیستم» و `<time dateTime>`.
- ورودی ۴۴px با `label` پنهان، شمارندهٔ «۱۲/۲۴۰» و وضعیت ارسال در ناحیهٔ زنده.
- «مخابرهٔ کوپن» ۴۴px با `aria-busy`.

### ۵) حذف حدس پاسخ
- `AlleyFirstPersonScene` و `AlleyRoomThreeIntegration` فقط
  `resolveOwnRevealedDigit(room.me.revealedDoorDigit, mainTicket.revealedGoldenDigit)` را
  نمایش می‌دهند؛ `Math.random` و محاسبهٔ محلی حذف شد.
- کلیدهای چرخش دوربین وقتی مودال قفل یا پنل سرنخ باز است غیرفعال می‌شوند تا پشت مودال
  حرکت نکنند.

### ۶) خوانایی
- همهٔ کنترل‌های تازه ≥ ۴۴px؛ متن‌ها با توکن‌های `--text-*` (۱۲px به بالا).
- در ≤۷۲۰px شبکهٔ نمادها و بخش‌ها دو ستونی می‌شود و مودال/پنل تمام‌عرض‌تر.

## تست‌ها

`tests/amirali/puzzle-wave6.test.ts` — ۲۱ تست: پاک‌سازی کد (فارسی/عربی/جداکننده/طول)،
خانه‌های رقم، وضعیت تیم برای گروه‌های ۳ تا ۸ نفر، کامل بودن انتخاب پانچ،
`resolveOwnRevealedDigit` (هیچ حدسی)، عدم وجود `Math.random` در صحنه‌ها،
قواعد نجوا (trim/سقف/خوانده‌نشده/برچسب‌ها) و گاردهای دسترس‌پذیری (radio groups،
dialog/Esc/Tab، role=log، اهداف لمسی و سقف فونت).

`npm run typecheck` ✅ · `npm run test:amirali` ۷۸ تست ✅ · `npm test` ۲۲۵ تست ✅ ·
`npm run build` ۱۴ مسیر ✅

## خارج از دامنه

- تغییر API/قواعد معما، mesh یا کنترلر سه‌بعدی.
- بازبینی ۳۲۰px و زوم ۲۰۰٪ (موج ۱۰) و زیرنویس/صدا (موج ۸).
