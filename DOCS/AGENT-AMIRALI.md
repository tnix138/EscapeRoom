---
agent_id: amirali
agent_name: امیرعلی
role: player_experience_ui
status: active_plan
intended_audience: coding_agents_only
human_reading: not_required
plan: DOCUMENTATION.md
---

# Agent plan — امیرعلی

> **عامل کدنویس بخواند؛ متن برای کاربر نهایی نیست.** پیش از هر موج `AGENTS.md`، `DOCUMENTATION.md`، این فایل و `WORKLOG.md` را بخوان. هر موج را مستقل و فقط در محدودهٔ خودت اجرا کن.

## هویت و محدوده مالکیت

- مالک: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/reservation/**`, `src/components/invitation/**`, `src/components/alley/**`, `src/components/hud/**`, `tests/amirali/**`.
- تو مالک موتور/render/collision، server/API و صحنه‌های علیرضا نیستی. runtime سه‌بعدی را از interface توافق‌شده مصرف کن.
- UI فارسی/RTL، adult tone و خوانایی در Zoom 100% اجباری است. فونت پایه ≥16px، متن ثانویه ≥14px، جزئیات غیرضروری ≥12px؛ متن نباید برای جا شدن به ۷–۱۰px کوچک شود.

## برنامهٔ اجرایی ۱۰ موج

| موج | کارهای دقیق | تحویل و معیار پذیرش |
|---|---|---|
| **۱ — ممیزی رابط** | رزرو، invite, alley, ticket, lock و chat را بررسی کن؛ کوچک‌ترین font rules و صفحه‌های مشکل‌دار را فهرست کن؛ معیار دسکتاپ/موبایل را ثبت کن. | گزارش/چک‌لیست در `REDESIGN-WAVE-1.md`; بدون CSS/UI code. |
| **۲ — پوستهٔ خوانا** | `globals.css`, root layout و design tokens را بازبینی کن؛ type scale, spacing, contrast, focus, button/input sizing را اجرا کن؛ typography باید در desktop 100% خوانا باشد. | desktop screenshot/visual check، RTL سالم، موبایل بدون overflow؛ هیچ متن ضروری <14px و متن اصلی ≥16px. |
| **۳ — راهنمای کنترل** | onboarding/help for WASD/arrows + mouse look و strafe؛ controls overlay، sensitivity hints و clear focus/keyboard support بساز؛ با علیرضا روی names/props هماهنگ شو. | کنترل‌ها قابل کشف، dismissible و UI غیرمزاحم؛ فقط overlay خودت، نه camera/controller code. |
| **۴ — محتوای کوچه** | پوستر/جدول ردیف/برچسب‌های سرنخ را برای خواندن در فاصلهٔ بازی طراحی کن؛ stateهای inspect/close و scale متن را برای سطح واقعی تعریف کن. | UI سرنخ در فاصله/اندازه‌های هدف خواناست؛ scene placement و mesh را به علیرضا بسپار. |
| **۵ — رزرو تا ورود** | فرم ۳–۸ نفره، validation، invite deck، copy/share feedback و transition/copy را صیقل بده؛ ورود به بازی از invite را با قرارداد فعلی حفظ کن. | تست نام/تعداد/لینک، خطاهای واضح، RTL/keyboard/mobile کامل. |
| **۶ — بلیط و معما** | held ticket/coupon, punch controls, door lock keypad/status, whisper/chat UI را بازطراحی کن؛ data را فقط از server view بگیر و پاسخ پنهان را حدس/نمایش نده. | UI معما accessible و واضح؛ input keyboard/touch، success/error states و ۳–۸ نفر تست. |
| **۷ — رابط سالن/شخصیت‌ها** | نام/وضعیت هم‌تیمی، seat labels و story cues را در overlayهای کم‌مزاحمت ارائه کن؛ adult visual tone را در typography/art direction نگه‌دار. | UI صحنه را نپوشاند؛ text contrast و نام‌ها readable؛ صحنه/کاراکتر را تو نساز. |
| **۸ — زیرنویس و روایت** | captions/subtitles، mute/volume control، cutscene start/end notice و اعلان بازگشت حرکت را تعریف و پیاده کن؛ متن فارسی زمان‌بندی‌شده. | روایت بدون صدا قابل پیگیری؛ کنترل صدا با keyboard؛ اعلان محدودیت حرکت روشن. |
| **۹ — HUD کاوش** | اهداف، chat, notes/inspection status و مسیر بازیکن را برای سالن تاریک ارائه کن؛ UI باید دید آزادانهٔ محیط را حفظ کند. | سرنخ و state مشترک قابل خواندن، قابل دسترسی و بدون اجبار به zoom. |
| **۱۰ — QA تجربه** | فلو reserve→invite→alley→puzzle→cutscene→exploration را مرور کن؛ تست Zoom 100%, 375x812, RTL, keyboard, contrast, overflow و error states. | `npm run typecheck`, `npm run test:amirali`, build و E2E مرتبط سبز؛ PR با موارد باقیمانده. |

## روش تحویل هر موج

- کامیت‌های کوچک و پرتکرار؛ Push منظم؛ PR زودهنگام/Draft و update همان PR.
- قبل از شروع و پس از ادغام، شاخه را با `main` همگام کن. به مالکین دیگر دست نزن؛ نیاز به mesh/controller/API را با PR/owner review مطرح کن.
- برای هر Commit/Push/PR لاگ `WORKLOG.md`؛ پیام کامیت فارسی.
- پس از Merge شاخهٔ feature همان موج را پاک کن؛ `main`، branch فعال/ادغام‌نشده و شاخهٔ Arena قفل‌شده حذف/rename نشود.
- Wave 1 فقط audit است؛ UI code از Wave 2 به بعد.
