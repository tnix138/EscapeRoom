---
agent: Infrastructure
wave: 7
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# ایجنت چهارم زیرساخت — موج ۷: بررسی دارایی‌های صحنهٔ سالن و بارگذاری در Preview

## دامنهٔ انجام‌شده

- بررسی بارگذاری دارایی‌های سه‌بعدی و صوتی صحنهٔ سالن تاریک و ویران اُرفه‌ئو (`AuditoriumViewport3D.tsx`، بافت‌های مخمل قرمز سوخته، پارکت شکسته، لوستر سقوط‌کرده، پردهٔ مخمل پاره، پیانوی شکسته، مجسمهٔ گچی اُرفه‌ئو و موتور صوتی Web Audio API در `theater-audio-engine.ts`) روی محیط‌های Preview (`dpl_Baehq1tTn1KPLrGwjaqrPJGMmUZ6`) و Production (`dpl_AcVtEAPxUJs71pczn5chv4ycTzJ6`).
- بررسی حجم باندل `/preview/auditorium` و `/room/[code]` در فاز `in_theater` و سازگاری انتقال گروه به سالن (`tests/tohid/theater-transition-recovery.test.ts` و `tests/alireza/theater-audio-engine.test.ts`).

## شاخص‌های دارایی و بارگذاری صحنهٔ سالن

| مسیر / دارایی | اندازه باندل | مشخصات بارگذاری و عملکرد | وضعیت |
| --- | --- | --- | --- |
| **`/preview/auditorium`** | `3.58 kB` (`114 kB` First Load JS) | بارگذاری آنی، تولید رویه‌ای بافت‌های مخمل سوخته و چوب شکسته، ۵ نقطهٔ تعاملی (`Hotspot`) با نشانگر سه‌بعدی | ✅ سالم |
| **موتور صوتی سالن (`theater-audio-engine.ts`)** | توکار (بدون فایل صوتی حجیم خارجی) | سنتز رویه‌ای Web Audio API برای صدای محیطی سالن، افکت‌های تعامل و فید صوتی با لایسنس MIT | ✅ سالم |
| **حافظهٔ GPU صحنهٔ سالن** | `< 45 MB` (`~58` Draw Calls) | کاملاً درون سقف بودجهٔ عملکرد (`150 MB` / `80` Draw Calls)؛ نرخ فریم پایدار روی دسکتاپ و موبایل | ✅ سالم |

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm test` — ۲۷ فایل، ۲۰۴ تست موفق (شامل ۱۱ تست `theater-audio-engine.test.ts` و تست `theater-transition-recovery.test.ts`).
- بررسی زندهٔ `https://escaperoom-orfeo.vercel.app/preview/auditorium` — پاسخ `200 OK` و رندر کامل سالن تاریک سه‌بعدی (`🌑 سه‌بعدی تاریک (ویران)`).
