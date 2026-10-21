---
agent: Tohid
wave: 5
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# Tohid — موج ۵: رزرو، دعوت و بازیابی نشست

## دامنهٔ انجام‌شده

- مسیر واقعی `POST /api/rooms` برای رزرو و تولید لینک‌های نام‌دار را آزمودم؛ برای هر صندلی توکن یکتا و invite path همان صندلی صادر می‌شود.
- مسیر احراز‌شدهٔ `GET /api/rooms/[code]` را برای همهٔ seat tokenها فراخوانی کردم؛ هر view فقط هویت همان صندلی را نشان می‌دهد و توکن خام به پاسخ view نشت نمی‌کند.
- درخواست دوباره با همان token پس از refresh را شبیه‌سازی کردم؛ `roomCode`، `playerId`، `seatIndex` و phase پایدار می‌مانند.
- حالت‌های رزرو با تعداد نامعتبر، JSON خراب، نبود token و token جعلی روی اتاق معتبر را بررسی کردم.
- کد صفحهٔ اتاق را فقط خواندم: بازیابی نشست از query token یا `sessionStorage`/`localStorage` پیاده‌سازی مالك UI است و دست‌نخورده ماند.

## تغییر

`tests/tohid/reservation-recovery.test.ts` تست API-level جدید است. هیچ تغییری در reservation logic، قرارداد مشترک، route، migration یا فایل مالک دیگری لازم نشد.

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm run test:tohid` — ۸ فایل، ۴۴ تست موفق.
- `npm test` — ۱۹ فایل، ۱۶۰ تست موفق.
- `npm run build` — موفق؛ ۱۴ مسیر.
- `npm run worklog:check` و `git diff --check` — موفق.

## پذیرش و محدودیت

- تست API این موج از مسیر واقعی routeها و SQLite محلی استفاده می‌کند.
- تست سرتاسری Playwright چندبازیکنهٔ موجود متعلق به Alireza است؛ در این PR دوباره اجرا یا ادعای اجرای آن نمی‌شود.
- منطق بازیابی token سمت UI به‌صورت کد بازبینی شد؛ تست browser/storage متعلق به مالک UI/Alireza است.
- invite token خام فقط در پاسخ مجاز reservation است؛ در GET room view افشا نمی‌شود.
