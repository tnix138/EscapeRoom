---
agent: Infrastructure
wave: 2
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# ایجنت چهارم زیرساخت — موج ۲: بررسی Runtime Preview و باندل WebGL

## دامنهٔ انجام‌شده

- ساخت و بررسی دیپلوی پیش‌نمایش (`Preview / STAGED`) روی Vercel برای آخرین وضعیت شاخهٔ `main` (کامیت `ddde895` پس از PR #51) با شناسهٔ `dpl_Baehq1tTn1KPLrGwjaqrPJGMmUZ6`.
- بررسی باندل کلاینت WebGL (`three@^0.186.1`)، پاسخ دارایی‌های استاتیک هَش‌شده (`/_next/static/chunks/*`)، تنظیمات Origin پیش‌نمایش (`allowedDevOrigins: ['*.e2b.app']` در `next.config.mjs`) و هدرهای بدون بافر SSE در `vercel.json`.
- اجرای Smoke Test بدون افشای هیچ کلید محرمانه‌ای روی مسیرهای پیش‌نمایش (`/`, `/preview/invitation`, `/preview/alley`, `/preview/cinema`, `/preview/auditorium`, `/preview/performance`, `/api/health`).

## شواهد استقرار Preview و باندل‌ها

| شاخص | مقدار |
| --- | --- |
| **پروژه Vercel** | `escaperoom-orfeo` (`prj_HD4C8ADfEmbBJtIFToqu7GuxyOtI`) |
| **شناسه دیپلوی Preview** | `dpl_Baehq1tTn1KPLrGwjaqrPJGMmUZ6` |
| **وضعیت دیپلوی** | `READY` / `STAGED` (زمان بیلد `33.7` ثانیه — `33675 ms`) |
| **آدرس Preview** | `https://escaperoom-orfeo-eem9jbg06-tnix138.vercel.app` |
| **Alias شاخه** | `https://escaperoom-orfeo-git-main-tnix138.vercel.app` |
| **باندل مشترک پایه (First Load JS)** | `103 kB` |
| **باندل مسیر `/room/[code]` (WebGL + SSE)** | `2.31 kB` (`139 kB` First Load JS) |
| **باندل مسیر `/preview/alley`** | `3.37 kB` (`114 kB` First Load JS) |

## اعتبارسنجی

- `npm run typecheck` — موفق (بدون خطا).
- `npm test` — ۲۱ فایل، ۱۷۳ تست موفق.
- `npm run build` — موفق؛ ۱۵ مسیر استاتیک و داینامیک.
- `npm run worklog:check` و `git diff --check` — موفق.

## نتیجه و ارجاع

بیلد و پیش‌نمایش Runtime سه‌بعدی (`Three.js`) و پوستهٔ خوانای دسکتاپ بدون خطای باندل، CORS یا کش تایید شد؛ نیازی به تغییر `vercel.json` یا ارجاع خطای بیلد به علیرضا/امیرعلی وجود نداشت.
