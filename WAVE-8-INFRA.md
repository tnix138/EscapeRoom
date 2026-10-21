---
agent: Infrastructure
wave: 8
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# ایجنت چهارم زیرساخت — موج ۸: بررسی کات‌سین و هدرهای استریم SSE، عدم بافرینگ و Timeout

## دامنهٔ انجام‌شده

- بررسی هدرهای پاسخ استریم زنده در مسیر `GET /api/rooms/[code]/stream` و تطبیق تنظیمات `vercel.json` با نیازمندی‌های استریم بدون بافرینگ روی لبهٔ Vercel (`Cache-Control: no-cache, no-transform`، `X-Accel-Buffering: no`، `Connection: keep-alive` و `maxDuration: 60`).
- بررسی همگام‌سازی ساعت سرور (`serverNow`)، تیک‌های ۱ ثانیه‌ای SSE در طول کات‌سین (`cutsceneStartedAt` / `cutsceneDurationMs = 15000`)، و ارتقای خودکار فاز از `cutscene` به `in_theater` حتی در صورت قطع موقت SSE و بازگشت به Polling شرطی (`sinceVersion`).
- بررسی یکپارچگی تست‌های کات‌سین و ساعت سرور (`tests/tohid/cutscene-sync-and-lock.test.ts`، `tests/tohid/server-hardening-and-clock-sync.test.ts`، `tests/tohid/realtime-stream-and-clock.test.ts` و `tests/alireza/cutscene-timing.test.ts`).

## جدول تنظیمات و رفتار استریم SSE و کات‌سین

| شاخص / هدر | مقدار تنظیم‌شده | رفتار در محیط عملیاتی Vercel | وضعیت |
| --- | --- | --- | --- |
| **`Content-Type`** | `text/event-stream; charset=utf-8` | ارسال رویدادهای `snapshot` و `heartbeat` به‌محض تولید در سرور | ✅ تاییدشده |
| **`Cache-Control`** | `no-cache, no-transform` | جلوگیری از کش یا فشرده‌سازی بافرکننده در CDN | ✅ تاییدشده |
| **`X-Accel-Buffering`** | `no` | غیرفعال‌سازی بافرینگ پروکسی معکوس در لبهٔ شبکه | ✅ تاییدشده |
| **`maxDuration` (`vercel.json`)** | `60` ثانیه (`functionTimeout: 300` Fluid Compute) | پشتیبانی کامل از طول کات‌سین ۱۵ ثانیه‌ای و اتصال مجدد خودکار `EventSource` پس از چرخهٔ تابع | ✅ تاییدشده |
| **ساعت کات‌سین (`cutscene-clock.ts`)** | `elapsedMs = clamp(serverNow - cutsceneStartedAt)` | هم‌ترازی زمانی بین تمام بازیکنان و انتقال قطعی به `in_theater` پس از اتمام تایمر | ✅ تاییدشده |

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm test` — ۲۷ فایل، ۲۰۴ تست موفق (شامل ۲۶ تست `cutscene-timing.test.ts`، ۶ تست `realtime-stream-and-clock.test.ts`، ۴ تست `server-hardening-and-clock-sync.test.ts` و ۲ تست `cutscene-sync-and-lock.test.ts`).
- بررسی زندهٔ `https://escaperoom-orfeo.vercel.app/preview/cinema` — پاسخ `200 OK` و رندر کامل صحنهٔ سینیور متئو.
