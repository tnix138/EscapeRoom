---
agent: Tohid
wave: 8
status: COMPLETE
intended_audience: coding_agents_only
---

# Tohid — موج ۸: ساعت سرور، کات‌سین و سخت‌سازی مسیر خواندن

## یافته‌ها و اصلاحات runtime

1. **انتشار بلادرنگ و ایمنی OCC در `loadRoom` (`src/server/services/room-service.ts`):**
   - پیش از این، هنگامی که `loadRoom` در مرزهای `۱۱` ثانیه (`door_cutscene → theater_cutscene`) و `۷۴` ثانیه (`theater_cutscene → in_theater`) فاز اتاق را با `tickPhaseByClock` جلو می‌برد و ذخیره می‌کرد، رویداد `publishRoomUpdate(state)` را منتشر نمی‌کرد و در صورت باختن رقابت همزمانی OCC، کپی محلی ذخیره‌نشده را برمی‌گرداند.
   - اکنون در صورت موفقیت ذخیره، تغییر بلافاصله به `room-hub` منتشر می‌شود و در صورت تداخل همزمان، وضعیت ماندگار واقعی دوباره از مخزن خوانده می‌شود.
2. **اصلاح استعلام شرطی `sinceVersion` (`src/app/api/rooms/[code]/route.ts` و `getRoomViewConditional`):**
   - پیش‌تر `GET /api/rooms/[code]?sinceVersion=N` همیشه نسخه را یکی بالا می‌برد و شرط `sinceVersion === roomView.version` هرگز برقرار نمی‌شد.
   - اکنون در پنجره فعال حضور (`< PRESENCE_REFRESH_INTERVAL_MS`) و در صورت عدم تغییر نسخه/فاز، بدون نوشتن اضافی در دیتابیس پاسخ `{ unchanged: true, version, serverNow }` برمی‌گردد؛ در عین حال احراز هویت `X-Seat-Token`، پیشبرد ساعت کات‌سین و refresh عادی بدون `sinceVersion` کاملاً حفظ شده‌اند.
3. **مقاوم‌سازی ساعت کات‌سین کلاینت (`src/client-sdk/cutscene-clock.ts`):**
   - نگهبان `Number.isFinite` به `computeClockOffset` و `computeCutsceneElapsedMs` افزوده شد تا ورودی نامعتبر `NaN`/`Infinity` هرگز محاسبه فریم‌به‌فریم زمان سپری‌شدهٔ کات‌سین را آلوده نکند.

## پوشش آزمون

- `tests/tohid/server-hardening-and-clock-sync.test.ts` (جدید: انتشار گذار ۱۱/۷۴ ثانیه در `loadRoom`، رقابت OCC همزمان، `getRoomViewConditional` و مقاومت ساعت در برابر `NaN`/`Infinity`)
- `tests/tohid/realtime-stream-and-clock.test.ts`
- `tests/tohid/cutscene-sync-and-lock.test.ts`
- `tests/tohid/scene-state-refresh.test.ts`
- `tests/tohid/wave2-hardening.test.ts`

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm run test:tohid` — ۱۴ فایل، ۵۷ تست موفق.
- `npm test` — ۲۷ فایل، ۲۰۴ تست موفق.
- `npm run build` — موفق؛ ۱۵ مسیر.
