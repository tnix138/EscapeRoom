---
agent: Tohid
wave: 6
status: COMPLETE
intended_audience: coding_agents_only
---

# Tohid — موج ۶: امنیت معمای کوچه

## دامنه

- مسیر rate limit قفل در را با مسیر واقعی service آزمایش می‌کند: پنج تلاش ناموفق برای هر seat، رد تلاش ششم با `RATE_LIMITED`/HTTP 429، و اجازهٔ تلاش پس از پایان پنجرهٔ ۶۰ ثانیه.
- بررسی می‌کند سهمیهٔ یک seat سهمیهٔ عضو دیگر گروه را مصرف نکند و تلاش rate-limited در `doorAttempts` ذخیره نشود.
- پوشش موجود موج‌های پیشین را دوباره بررسی کردم: گراف حلقوی و پاسخ یکتای پانچ برای گروه‌های ۳ تا ۸ نفره، پنهان‌ماندن اطلاعات خصوصی در projection، پانچ همزمان با OCC و قفل زودهنگام در مجموعه‌تست‌های قبلی هستند.

## تغییر

فقط `tests/tohid/alley-security.test.ts` به‌عنوان regression test جدید اضافه شد. rate limit موجود در service با سقف پنج تلاش در ۶۰ ثانیه برای هر seat آزموده شد؛ هیچ تغییر runtime، قرارداد مشترک، route، schema، migration یا حرکت/transform تیمی لازم نبود.

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm run test:tohid` — ۹ فایل، ۴۵ تست موفق.
- `npm test` — ۲۱ فایل، ۱۷۳ تست موفق.
- `npm run build` — موفق؛ ۱۵ مسیر.
- `npm run worklog:check` و `git diff --check` — موفق.

## محدودیت

Rate limiter موجود حافظه‌ای و process-local است؛ تغییر دوام آن بین restartها یا پیاده‌سازی distributed limiting خارج از این regression test است و نیازمند تصمیم جداگانهٔ مالک سرور/زیرساخت است.

## تکمیل

PR #51 در main ادغام شد (merge commit `ddde895`).
