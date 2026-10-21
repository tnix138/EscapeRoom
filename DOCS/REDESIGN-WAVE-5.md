---
document_type: implementation_record
status: implemented_pending_owner_review
wave: 5
owner: امیرعلی
intended_audience: coding_agents_only
human_reading: not_required
---

# موج ۵ — رزرو تا ورود

**دامنه:** `src/components/reservation/` (فرم، Deck، قواعد، کلیپ‌بورد)،
`src/components/invitation/seat-storage.ts` (جدید) و `InvitationGate.tsx`، به‌همراه
`src/app/globals.css` و `tests/amirali/reservation-wave5.test.ts` (جدید).
بدون تغییر در `src/engine3d/**`، مسیر اتاق، قراردادهای API یا قواعد بازی.

## مسئله

فرم رزرو فقط یک پیام کلی خطا داشت؛ معلوم نبود کدام صندلی خالی یا تکراری است. کپی لینک
دعوت‌نامه در مرورگرهایی که Clipboard API را نمی‌دهند بی‌صدا شکست می‌خورد و در حالت
پیش‌نمایش آدرس‌ها نسبت به origin ساخته نمی‌شدند. قرارداد ذخیرهٔ توکن صندلی هم در دو
فایل تکرار شده بود.

## راه‌حل

### ۱) قواعد خالص رزرو — `reservation-rules.ts`
- `validateReservation(names)` برای هر مهمان یک پیام جدا برمی‌گرداند
  (`fieldErrors`) به‌همراه `firstInvalidField` و خطای مستقل تعداد (`countError`).
- نام‌ها پیش از مقایسه یکسان‌سازی می‌شوند: حذف نویسه‌های صفرعرض (ZWNJ/ZWSP)،
  تبدیل `ي/ك` عربی به `ی/ک` و جمع‌کردن فاصله‌ها؛ پس «سارا» و « سارا » یا
  «علي» و «علی» تکراری‌اند.
- پیام کلی خلاصه است و جزئیات کنار همان صندلی نمایش داده می‌شود.
- `validateGuestNames()` برای سازگاری با فراخوان‌های قبلی همان `message` را می‌دهد.
- ابزارهای نمایش: `toPersianDigits`، `seatLabelForIndex` («صندلی ۰۱»)،
  `guestDisplayName`، `guestCountLabel`، `buildInviteShareText`، `resolveInviteUrl`.

### ۲) کپی با مسیر جایگزین — `clipboard.ts`
- اول `navigator.clipboard.writeText`، بعد `textarea` موقت + `execCommand('copy')`.
- نتیجهٔ `{ok:false, reason:'unsupported'|'blocked'}` باعث باز شدن **کپی دستی** در Deck
  می‌شود: ورودی خواندنی با انتخاب خودکار و راهنمای `Ctrl+C`؛ کاربر هرگز بن‌بست ندارد.
- محیط تزریق‌پذیر است تا بدون مرورگر تست شود.

### ۳) فرم رزرو — `ReservationForm.tsx`
- خطا فقط بعد از اولین تلاش ارسال نمایش داده می‌شود (`submitAttempted`)، نه هنگام تایپ.
- هر فیلد `aria-invalid` و `aria-describedby` دارد؛ فوکوس بعد از خطا روی اولین فیلد
  نامعتبر (یا ردیف تعداد) می‌رود.
- انتخاب تعداد ۳ تا ۸ با `aria-pressed`، ناوبری کلید جهت‌دار (در RTL چپ = بیشتر) و
  ارقام فارسی؛ تغییر تعداد نام‌های موجود را حفظ می‌کند.
- خطای سرور جدا از خطای اعتبارسنجی نمایش داده می‌شود.

### ۴) Deck دعوت‌نامه — `InviteLinksDeck.tsx`
- آدرس مطلق فقط بعد از mount از `window.location.origin` ساخته می‌شود
  (بدون hydration mismatch)؛ `resolveInviteUrl` دامنهٔ فارسی را دست‌نخورده نگه می‌دارد.
- کپی هر کارت + کپی همه با سرصفحهٔ کد اتاق و شماره‌گذاری فارسی.
- وضعیت کپی در `aria-live` اعلام می‌شود، تیک روی همان کارت می‌آید و فوکوس پس از
  موفقیت/شکست جابه‌جا نمی‌شود؛ بعد از رزرو، فوکوس روی عنوان Deck می‌رود.
- حالت پیش‌نمایش با نشان واضح از رزرو واقعی جدا شده است.

### ۵) قرارداد ورود — `seat-storage.ts`
- تنها نقطهٔ نوشتن/خواندن کلیدهای `seat:<code>` و `orfeo:<code>:<token>`؛
  همان ترتیبی که مسیر اتاق می‌خواند (`?token=` → `seat:` → `orfeo:`).
- `InvitationGate` از همین ماژول استفاده می‌کند؛ storage مسدود ورود را نمی‌شکند.

### ۶) خوانایی و موبایل
- همهٔ متن‌های جدید با توکن‌های `--text-*` (۱۲px به بالا) و هدف لمسی ۴۴px.
- بلوک کپی دستی در موبایل تمام‌عرض می‌شود و ورودی حداقل ۴۴px ارتفاع دارد.

## تست‌ها

`tests/amirali/reservation-wave5.test.ts` — ۱۹ تست:
یکسان‌سازی نام (ZWNJ، ي/ك، فاصله)، خطای هر فیلد، تکراری با شمارهٔ صندلی، حد ۳۲ نویسه،
خطای تعداد، ساخت متن اشتراک، URL پیش و پس از mount، پیام‌های خطای کپی، سه مسیر کپی
(API، fallback، شکست) و قرارداد ذخیره/بازیابی توکن.

`npm run test:amirali` → ۵۷ تست، `npm test` → ۱۹۳ تست، `npm run build` → ۱۴ مسیر.

## خارج از دامنه

- تغییر `src/app/room/[code]/page.tsx`، API اتاق یا قاعدهٔ بازی.
- همگام‌سازی زیرنویس (موج ۶/۸) و بازبینی ۳۲۰px/زوم ۲۰۰٪ (موج ۱۰).
