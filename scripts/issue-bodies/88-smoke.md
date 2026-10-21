🧪 **اسمک‌تست انتشار حالا کل مسیر را می‌سنجد (و روی build تولیدی سبز است)**

`node scripts/smoke-test.mjs` روی `next start` محلی ۱۵ مرحله سبز و با `SMOKE_FULL_PATH=1` ۱۶ مرحله سبز داد: رزرو → حضور → SSE → پانچ سه بلیط → باز شدن در → قفل کات‌سین → `in_theater` → پیش‌نمایش‌ها → نگهبان ادمین. کامیت `d516fa5`.

این یعنی بعد از رفع مسدودکننده‌های زیر، `deploy.yml` با همین اسکریپت می‌تواند سبزی production را بسنجد:

1. merge این شاخه به `main` (تا workflowها و کد جدید روی `main` باشند)،
2. ست کردن `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` در Vercel،
3. اجرای smoke روی دامنهٔ production (الان `/admin/login` ۴۰۴ می‌دهد؛ یعنی deploy کهنه است).
