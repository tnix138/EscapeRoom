# گزارش فعالیت / درخواست زیرساخت — 1405-07-29_15-59-27_tohid_infra-supabase-migration-001

- **نام شخص:** توحید (اجرا توسط: ایجنت چهارم زیرساخت — به مدیریت توحید)
- **تاریخ شمسی:** ۱۴۰۵/۰۷/۲۹
- **ساعت انجام:** ۱۵:۵۹:۲۷ (تکمیل و آرشیو زیرساخت: ۱۶:۱۸:۳۰)
- **نوع فعالیت:** Infra-Supabase
- **شناسه مرجع (Commit / PR):** شاخه `arena/32c2d8dd-escaperoom` ➔ `arena/c9528bce-escaperoom` — فایل `supabase/migrations/001_initial_schema.sql`
- **وضعیت:** Archive (اجرا و تأیید شده توسط ایجنت چهارم زیرساخت)
- **زمان دقیق سیستمی:** 2026-10-21T12:29:27Z (تکمیل: 2026-10-21T12:48:30Z)

### شرح دقیق عملیات درخواستی
در موج ۱ توحید، فایل مهاجرت `supabase/migrations/001_initial_schema.sql` ساخته شد (جدول `public.rooms` با ستون‌های `code/version/phase/state_json/created_at/updated_at`، ایندکس‌های `phase` و `updated_at` و فعال‌سازی RLS بدون policy عمومی).

از **ایجنت چهارم زیرساخت (با مدیریت توحید)** درخواست می‌شود:
1. پروژه Supabase مخصوص بازی را بررسی/ایجاد کند و این فایل مهاجرت را روی آن اجرا نماید.
2. با کوئری سلامت `SELECT to_regclass('public.rooms');` آماده بودن جدول را تأیید کند.
3. مقادیر `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` را **بدون نوشتن در Git**، مستقیماً در متغیرهای محیطی رمزنگاری‌شده Vercel (`STORAGE_DRIVER=supabase`) ثبت کند.
4. نتیجه اجرا و وضعیت نهایی را در همین فایل ثبت و آن را از `Pending` به `Archive` منتقل نماید.

> در محیط توسعه محلی و Sandbox نیازی به این عملیات نیست؛ بازی به‌صورت پیش‌فرض با `node:sqlite` اجرا می‌شود.

---

### نتیجه اجرای ایجنت چهارم (زیرساخت)
- **مجری:** ایجنت چهارم زیرساخت (به مدیریت توحید)
- **تاریخ شمسی اجرا:** ۱۴۰۵/۰۷/۲۹
- **ساعت انجام:** ۱۶:۱۸:۳۰ (به وقت رسمی ایران)
- **پروژه Supabase:** `escaperoom-orfeo` (شناسه پروژه: `yavwoaqxhptzufmjckwz`، منطقه: `eu-central-1`، موتور PostgreSQL `17.11`، وضعیت سرویس‌های `db` / `rest` / `auth`: `ACTIVE_HEALTHY`)
- **اجرای مایگریشن:** فایل `supabase/migrations/001_initial_schema.sql` با نام مایگریشن `initial_schema_rooms` با موفقیت روی دیتابیس ابری اجرا شد.
- **تست سلامت جدول و RLS:** کوئری `SELECT to_regclass('public.rooms') AS rooms_table, relrowsecurity AS rls_enabled FROM pg_class WHERE oid = to_regclass('public.rooms');` مقدار `{"rooms_table": "rooms", "rls_enabled": true}` را بازگرداند.
- **ثبت امن متغیرهای محیطی در Vercel:** در پروژه Vercel به نام `escaperoom-orfeo` (`prj_HD4C8ADfEmbBJtIFToqu7GuxyOtI`) هر سه متغیر `STORAGE_DRIVER=supabase`، `SUPABASE_URL=https://yavwoaqxhptzufmjckwz.supabase.co` و `SUPABASE_SERVICE_ROLE_KEY` (به‌صورت `encrypted` برای محیط‌های `production`، `preview` و `development`) بدون درج هیچ کلید محرمانه‌ای در Git ثبت شدند.
- **لینک عمومی دیپلوی و تست سلامت:**
  - آدرس اصلی Production: `https://escaperoom-orfeo.vercel.app`
  - آدرس سلامت سرور: `https://escaperoom-orfeo.vercel.app/api/health` ⬅ پاسخ دریافتی: `{"ok":true,"data":{"status":"healthy","storageDriver":"supabase"}}`
