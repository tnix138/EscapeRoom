# 👥 حضور در جهان سه‌بعدی

> فازهای مرتبط: ۰۳، ۰۴، ۱۲
> مالک اصلی: توحید (فاز ۰۳ — قرارداد) + علیرضا (فاز ۰۴ — کلاینت) + امیرعلی (فاز ۱۲ — HUD)
> مالک دوم: —

## چه مشکلی را حل می‌کند؟

الان دو بازیکن در یک اتاق هستند ولی **همدیگر را نمی‌بینند**. فقط در چت و لیست آنلاین. این نقض مستقیم «cooperative escape room» است.

بازیکن باید هم‌تیمی خودش را در جهان سه‌بعدی ببیند، حرکتش را دنبال کند، و با هم معما را حل کنند.

## چه چیزی می‌سازیم؟

### ۱. قرارداد presence (فاز ۰۳ — توحید)

```typescript
interface PresenceSnapshot {
  playerId: string;
  seatIndex: number;
  position: { x: number; y: number; z: number };
  yaw: number;
  phase: string;
  lastUpdate: number;
}
نرخ ارسال: ۵ تا ۱۰ بار در ثانیه.
نگهداری سرور: فقط آخرین snapshot (بدون تاریخچه).
پاک‌سازی: ۳۰ ثانیه بعد از آخرین به‌روزرسانی.
endpoint: POST /api/rooms/[code]/presence (بدنه: PresenceSnapshot).

تست‌های لازم:

snapshot معتبر قبول می‌شود.

snapshot نامعتبر (position خارج bounds) رد می‌شود.

snapshot قدیمی (بیش از ۳۰ ثانیه) پاک می‌شود.

rate limit (۵۰ درخواست در ثانیه) اعمال می‌شود.

۲. کلاینت حضور (فاز ۰۴ — علیرضا)
در src/engine3d/presence/:

usePresence hook — خواندن snapshot‌های هم‌تیمی‌ها از SSE.

RemotePlayer — یک مدل سه‌بعدی ساده (مکعب یا کپسول با نام).

RemotePlayerManager — مدیریت چند بازیکن.

ارسال snapshot خود بازیکن (throttle ۱۰Hz).

محدودهٔ فایل: src/engine3d/presence/** (فقط این).

تست‌های لازم:

یک RemotePlayer ساخته می‌شود.

دو RemotePlayer ساخته می‌شود.

موقعیت به‌روزرسانی می‌شود.

بازیکن آفلاین حذف می‌شود.

۳. HUD حضور (فاز ۱۲ — امیرعلی)
در src/components/hud/:

نشانگر جهت هم‌تیمی‌ها (فلش روی صفحه).

نام هم‌تیمی بالای سرش (به‌عنوان HTML overlay).

محدودهٔ فایل: src/components/hud/** (فقط این).

چه چیزی نمی‌سازیم (فعلاً)
❌ آواتار کامل با انیمیشن (فعلاً مکعب ساده)

❌ صدای هم‌تیمی

❌ اشاره با دست

❌ همگام‌سازی حرکات دقیق (فقط position + yaw)

محدودهٔ فایل (خلاصه)
مالک	فایل‌ها
توحید	src/server/presence/**, src/app/api/rooms/[code]/presence/route.ts, src/contracts/presence.ts, tests/tohid/presence-*.test.ts
علیرضا	src/engine3d/presence/**, tests/alireza/presence-*.test.ts
امیرعلی	src/components/hud/presence/**, tests/amirali/presence-*.test.ts
هیچ فایلی بین این سه نفر مشترک نیست.

معیار موفقیت
✅ دو بازیکن در یک اتاق هم‌دیگر را می‌بینند.

✅ وقتی یکی حرکت می‌کند، دیگری حرکتش را می‌بیند (با تأخیر < ۲۰۰ms).

✅ وقتی یکی آفلاین می‌شود، بعد از ۳۰ ثانیه از دید دیگری محو می‌شود.

✅ عملکرد FPS روی موبایل ۳۰+ و دسکتاپ ۶۰ است.

text

