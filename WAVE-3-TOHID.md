---
agent: Tohid
wave: 3
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# Tohid — موج ۳: حضور و اتصال مجدد، بدون همگام‌سازی حرکت

## تصمیم مبنا

گیت موج ۱ از سوی کاربر تأیید شده و گزارش مرز موج ۲ (`WAVE-2-TOHID.md`) تصمیم گرفته است که transform هم‌تیمی‌ها برای نسخهٔ اول لازم نیست. این موج فقط حضور/reconnect را کامل می‌کند؛ **هیچ موقعیت، کلید خام، ورودی فریم‌به‌فریم یا endpoint حرکتی اضافه نمی‌شود.** قرارداد مشترک `ClientRoomView` و schema پایگاه‌داده تغییر نکرده‌اند.

## یافتهٔ پیش از اصلاح

- projector وضعیت `isOnline` را از `lastSeenAt` با پنجرهٔ ۳۰ ثانیه می‌سازد.
- دریافت اولیه و اکشن‌ها/چت `lastSeenAt` را تازه می‌کردند؛ heartbeat دوثانیه‌ای SSE فقط ساعت سرور را می‌فرستاد.
- بنابراین اتصال SSE باز و بی‌تعامل پس از ۳۰ ثانیه ممکن بود در UI آفلاین دیده شود؛ همچنین عبور از TTL به‌تنهایی رویداد `room_update` تولید نمی‌کرد.

## تغییر موج ۳

- `touchSeatPresence` فقط با seat token معتبر، و با cadence حداقل ۱۵ ثانیه (نصف TTL آنلاین ۳۰ثانیه‌ای)، وضعیت joined/lastSeenAt را تازه می‌کند. ذخیره از OCC موجود استفاده می‌کند، تغییر را به اتاق منتشر می‌کند و درخواست‌های هم‌زمان/تب‌های تکراری را به یک write محدود می‌کند.
- استریم SSE برای هر اتصال مجاز، lease حضور را در cadence ۱۵ثانیه‌ای نگه می‌دارد؛ هر دو timer و subscription هنگام abort/cancel پاک‌سازی می‌شوند.
- heartbeat موجود، وضعیت آنلاین را با زمان سرور دوباره projection می‌کند. اگر TTL یک هم‌تیمی تمام شده باشد، `room_update` حتی با نسخهٔ state یکسان فرستاده می‌شود؛ نسخهٔ قدیمی‌تر هیچ‌وقت بر کلاینت اعمال نمی‌شود.
- reconnect به‌واسطهٔ EventSource و درخواست اولیهٔ احراز‌شده، حضور را دوباره آنلاین می‌کند. هیچ route یا نوع مشترک جدیدی لازم نبود.

## آزمون‌ها و پذیرش

`tests/tohid/realtime-stream-and-clock.test.ts` پوشش می‌دهد:

- cadence حضور و نبود write/version churn بین refreshها؛
- دو heartbeat هم‌زمان و یک write OCC؛
- انتشار refresh حضور برای دو شنوندهٔ هم‌زمان؛
- پایان lease و projection آفلاین؛
- نمای امن SSE و پاک‌شدن subscription پس از cancel.

Projection contract test موجود همچنان شکل دقیق `ClientRoomView` را کنترل می‌کند. تست حضور همچنین تأیید می‌کند state ذخیره‌شده فاقد position/transform/movement است.

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm run test:tohid` — ۶ فایل، ۴۱ تست موفق.
- `npm test` — ۱۷ فایل، ۱۵۷ تست موفق (پس از همگام‌سازی آخرین main).
- `npm run build` — موفق؛ ۱۴ مسیر.

## محدودیت

`isOnline` یک lease با پنجرهٔ ۳۰ثانیه‌ای است، نه تأیید اتصال دائمی. تأخیر طولانی timer می‌تواند وضعیت را موقتاً offline نشان دهد؛ refresh بعدی آن را اصلاح می‌کند. اگر در موج‌های بعدی بازیابی world position بین دستگاه‌ها یا avatar sync نیاز شد، قرارداد جداگانه و توافق مالکان لازم است.
