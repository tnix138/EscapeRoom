---
agent: Tohid
wave: 8
status: COMPLETE
intended_audience: coding_agents_only
---

# Tohid — موج ۸: clock، refresh و قفل کات‌سین

## پوشش تأییدشده در تست‌های موجود

- `tests/tohid/realtime-stream-and-clock.test.ts`: offset ساعت سرور برای skewهای مثبت و منفی، elapsed یکسان برای کلاینت‌ها با clock محلی متفاوت، صفر پیش از شروع و سقف ۷۴ ثانیه پس از پایان.
- `tests/tohid/scene-state-refresh.test.ts`: reopen پایگاه SQLite در کوچه، وسط کات‌سین، در گذار به سالن و پس از ورود به سالن تاریک؛ فاز و timestamp ماندگارند.
- `tests/tohid/cutscene-sync-and-lock.test.ts` و `tests/tohid/wave2-hardening.test.ts`: رد interaction در کات‌سین، ثبت ماندگار مرزهای ۱۱/۷۴ ثانیه و آزادشدن interaction در سالن.
- `tests/alireza/cutscene-timing.test.ts`: پوشش timing مربوط به UI/renderer که متعلق به مالک آن فایل است و تغییرش ندادم.

## تصمیم دامنه

Wave 8 با تست‌های موجود پوشش دارد و تغییر runtime تازه لازم نشد. server phase/clock منبع هماهنگی باقی می‌ماند؛ clock offset فقط زمان نمایشی را کالیبره می‌کند. دادهٔ renderer و transform کلاینت روی سرور ذخیره یا همگام نمی‌شود.
