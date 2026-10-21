---
agent: Infrastructure
wave: 3
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# ایجنت چهارم زیرساخت — موج ۳: ماتریس تست دستگاه‌ها و ورودی‌های حرکت

## دامنهٔ انجام‌شده

- اجرای Smoke Test ماتریس ورودی‌ها و کنترل‌های حرکت سه‌بعدی در محیط Preview (`dpl_Baehq1tTn1KPLrGwjaqrPJGMmUZ6`) و Production (`dpl_AcVtEAPxUJs71pczn5chv4ycTzJ6` روی کامیت `37e11ac`).
- بررسی یکپارچگی هندلرهای ورودی صفحه‌کلید (`WASD` / کلیدهای جهت‌نما / `E` / `Escape` / `?`)، نگاه آزاد ماوس (`Pointer Lock` + fallback درگ ماوس در iframe/پیش‌نمایش)، و کنترل‌های لمسی موبایل (`D-Pad` مجازی و سوایپ چرخش سر افقی و عمودی).
- بررسی سازگاری کامل با تست‌های واحد حرکت و راهنمای کنترل‌ها (`tests/alireza/pov-head-pan.test.ts`، `tests/alireza/spawn-and-interaction.test.ts`، `tests/amirali/controls-help.test.ts`، `tests/tohid/wave2-hardening.test.ts`).

## ماتریس بررسی دستگاه‌ها و ورودی‌ها

| محیط / ورودی | مکانیزم و مسیر بررسی‌شده | وضعیت |
| --- | --- | --- |
| **Desktop Chrome / Firefox (Keyboard)** | حرکت پیوستهٔ ۶۰ هرتز با `WASD` و کلیدهای جهت‌نما، کلید تعامل `E`، باز و بسته کردن راهنمای حرکت با `?` و `Escape` در `/preview/alley` و `/room/[code]` | ✅ سالم |
| **Desktop Mouse / Pointer Lock** | فعال‌سازی Pointer Lock روی بوم WebGL و fallback چرخش با Drag ماوس در محیط‌های بدون مجوز Pointer Lock (مانند iframe پیش‌نمایش)؛ محدودسازی Pitch در بازهٔ `[-65°, +65°]` | ✅ سالم |
| **Mobile Touch / Responsive Viewport** | پد حرکتی لمسی (`Touch D-Pad`) برای گام‌برداری و ناحیهٔ سوایپ نگاه برای چرخش افقی/عمودی سر بدون تداخل با اسکرول صفحه (`touch-action: none`) | ✅ سالم |
| **Modal / Clue Reading Input Guard** | توقف حرکت هنگام باز بودن مودال خواندن سرنخ یا راهنمای کنترل‌ها (`isMovementBlocked`) برای جلوگیری از جابه‌جایی ناخواسته در صحنه | ✅ سالم |

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm test` — ۲۷ فایل، ۲۰۴ تست موفق.
- بررسی زندهٔ `/preview/alley` روی `https://escaperoom-orfeo.vercel.app/preview/alley` — رندر کامل بوم سه‌بعدی و دکمهٔ `؟راهنمای حرکت` با پاسخ `200 OK`.
