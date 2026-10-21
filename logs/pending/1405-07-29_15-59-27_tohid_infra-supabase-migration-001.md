# گزارش فعالیت / درخواست زیرساخت — 1405-07-29_15-59-27_tohid_infra-supabase-migration-001

- **نام شخص:** توحید
- **تاریخ شمسی:** ۱۴۰۵/۰۷/۲۹
- **ساعت انجام:** ۱۵:۵۹:۲۷
- **نوع فعالیت:** Infra-Supabase
- **شناسه مرجع (Commit / PR):** شاخه `arena/32c2d8dd-escaperoom` — فایل `supabase/migrations/001_initial_schema.sql`
- **وضعیت:** Pending (منتظر اجرا توسط ایجنت چهارم زیرساخت)
- **زمان دقیق سیستمی:** 2026-10-21T12:29:27Z

### شرح دقیق عملیات درخواستی
در موج ۱ توحید، فایل مهاجرت `supabase/migrations/001_initial_schema.sql` ساخته شد (جدول `public.rooms` با ستون‌های `code/version/phase/state_json/created_at/updated_at`، ایندکس‌های `phase` و `updated_at` و فعال‌سازی RLS بدون policy عمومی).

از **ایجنت چهارم زیرساخت (با مدیریت توحید)** درخواست می‌شود:
1. پروژه Supabase مخصوص بازی را بررسی/ایجاد کند و این فایل مهاجرت را روی آن اجرا نماید.
2. با کوئری سلامت `SELECT to_regclass('public.rooms');` آماده بودن جدول را تأیید کند.
3. مقادیر `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` را **بدون نوشتن در Git**، مستقیماً در متغیرهای محیطی رمزنگاری‌شده Vercel (`STORAGE_DRIVER=supabase`) ثبت کند.
4. نتیجه اجرا و وضعیت نهایی را در همین فایل ثبت و آن را از `Pending` به `Archive` منتقل نماید.

> در محیط توسعه محلی و Sandbox نیازی به این عملیات نیست؛ بازی به‌صورت پیش‌فرض با `node:sqlite` اجرا می‌شود.
