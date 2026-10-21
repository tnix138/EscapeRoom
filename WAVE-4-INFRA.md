---
agent: Infrastructure
wave: 4
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# ایجنت چهارم زیرساخت — موج ۴: بررسی دارایی‌های کوچه، کش و بارگذاری در Preview

## دامنهٔ انجام‌شده

- بررسی بارگذاری دارایی‌های صحنهٔ کوچه (بافت‌های رویه‌ای سه‌بعدی `procedural-textures.ts`، مش‌های سنگ‌فرش خیس، دیرک چراغ گازی، پوسترهای تئاتر، درب چوبی با قفل برنجی، و فونت‌های Google Fonts با لایسنس OFL-1.1) در محیط Preview (`dpl_Baehq1tTn1KPLrGwjaqrPJGMmUZ6`) و Production (`dpl_AcVtEAPxUJs71pczn5chv4ycTzJ6`).
- اندازه‌گیری حجم چانک‌های مسیر `/preview/alley` و `/room/[code]` و بررسی هدرهای کشینگ دارایی‌های هَش‌شده (`/_next/static/chunks/*` با `Cache-Control: public, max-age=31536000, immutable`).
- بررسی یکپارچگی پایداری حالت صحنه در رفرش (`tests/tohid/scene-state-refresh.test.ts`) و حالت خواندن سرنخ کوچه (`tests/amirali/clue-reading.test.ts`).

## شاخص‌های حجم دارایی و کش صحنهٔ کوچه

| مسیر / دارایی | اندازه باندل | کشینگ و بارگذاری | وضعیت |
| --- | --- | --- | --- |
| **`/preview/alley`** | `3.37 kB` (`114 kB` First Load JS) | بارگذاری آنی، تولید رویه‌ای بافت‌های آجر، سنگ‌فرش باران‌خورده، برنج کهنه و کاغذ پوستر در حافظه بدون درخواست شبکهٔ خارجی | ✅ سالم |
| **`/room/[code]` (Alley Act 1)** | `2.31 kB` (`139 kB` First Load JS) | چانک‌های استاتیک هَش‌شده با `Cache-Control: public, max-age=31536000, immutable` روی CDN لبهٔ Vercel | ✅ سالم |
| **حافظهٔ GPU صحنهٔ کوچه** | `< 35 MB` (`~42` Draw Calls) | بسیار پایین‌تر از سقف بودجهٔ عملکرد (`150 MB` / `80` Draw Calls)؛ بدون افت فریم در رزولوشن دسکتاپ و موبایل | ✅ سالم |

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm test` — ۲۷ فایل، ۲۰۴ تست موفق (شامل `tests/amirali/clue-reading.test.ts` و `tests/tohid/scene-state-refresh.test.ts`).
- بررسی زندهٔ `https://escaperoom-orfeo.vercel.app/preview/alley` — پاسخ `200 OK` و رندر کامل کوچهٔ سه‌بعدی و کتیبهٔ سرنخ‌ها.
