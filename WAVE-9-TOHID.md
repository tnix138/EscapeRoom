---
agent: Tohid
wave: 9
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# Tohid — موج ۹: کاوش پایدار سالن

## دامنه

- state یک hotspot با اکشن احرازشدهٔ seat در server service ثبت می‌شود؛ حضور seat دیگر، پیشرفت مشترک را می‌بیند.
- retry همان hotspot برای همان seat idempotent است و نام بازیکن از token صندلی می‌آید، نه از دادهٔ ارسالی client.
- اکشن در فاز کوچه رد می‌شود؛ توکن نامعتبر نمی‌تواند پیشرفت بسازد.
- پس از reopen SQLite و GET مجدد، phase، زمان شروع سالن و فهرست hotspotهای بررسی‌شده بازیابی می‌شوند.

## تغییر

`tests/tohid/persistent-exploration.test.ts` regression test جدید است. هیچ runtime/API/contract/schema/migration یا کد renderer لازم نشد.

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm run test:tohid` — ۱۱ فایل، ۴۷ تست موفق.
- `npm test` — ۲۳ فایل، ۱۷۵ تست موفق.
- `npm run build` — موفق؛ ۱۵ مسیر.
- `npm run worklog:check` و `git diff --check` — موفق.

## مرز دامنه

Hotspot state authority در سرور است؛ مختصات بازیکنان یا transform renderer به اشتراک گذاشته یا ذخیره نمی‌شود. Endpoint حرکت یا transform-sync اضافه نمی‌شود.
