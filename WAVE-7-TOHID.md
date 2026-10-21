---
agent: Tohid
wave: 7
status: COMPLETE
intended_audience: coding_agents_only
---

# Tohid — موج ۷: انتقال هماهنگ به سالن

## دامنه

- مسیر واقعی رزرو، پانچ صندلی‌ها و بازشدن قفل در از routeهای API اجرا می‌شود.
- پس از ورود به `door_cutscene`، با هر seat token جداگانه `GET /api/rooms/[code]` اجرا می‌شود؛ همهٔ اعضا باید phase و فهرست seat/هویت/شمارهٔ صندلی یکسان ببینند، درحالی‌که فیلد `me` مخصوص صندلی درخواست‌کننده است.
- زمان شروع کات‌سین در تمام viewها پایدار و token خام خارج از پاسخ view است.

## تغییر

`tests/tohid/theater-transition-recovery.test.ts` تست route-level جدید است. تست scene refresh موج ۴ همچنان بازیابی phase پس از reopen SQLite را پوشش می‌دهد؛ این موج سازگاری phase/گروه بین تمام viewerهای احرازشده را در لحظهٔ انتقال می‌سنجد.

## محدودیت

- فقط `door_cutscene` به‌عنوان فاز ورود به انتقال در API آزموده شده؛ فازهای بعدی و بازیابی پس از reopen در تست موج ۴ پوشش داده شده‌اند.
- renderer سه‌بعدی و UI شخص دیگری‌اند؛ هیچ transform، spawn یا کد renderer تغییر نکرد.
- هیچ endpoint حرکت، sync ترنسفورم هم‌تیمی یا تغییر قرارداد مشترک اضافه نشده است.

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm run test:tohid` — ۱۰ فایل، ۴۶ تست موفق.
- `npm test` — ۲۲ فایل، ۱۷۴ تست موفق.
- `npm run build` — موفق؛ ۱۵ مسیر.
- `npm run worklog:check` و `git diff --check` — موفق.

## تکمیل

PR #52 در main ادغام شد (merge commit `6ac69c2`).
