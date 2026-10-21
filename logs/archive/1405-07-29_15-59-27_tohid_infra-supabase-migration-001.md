---
id: '1405-07-29_15-59-27_tohid_infra-supabase-migration-001'
title: 'درخواست اجرای مایگریشن ۰۰۱ روی Supabase'
summary: 'تکمیل درخواست زیرساخت توحید توسط ایجنت چهارم: اجرای `supabase/migrations/001_initial_schema.sql` روی پروژه `escaperoom-orfeo` (`yavwoaqxhptzufmjckwz`)، تست سلامت جدول `public.rooms` و ثبت امن متغیرهای محیطی در Vercel.'
author: 'توحید (اجرا توسط: ایجنت چهارم زیرساخت — به مدیریت توحید)'
author_slug: 'tohid'
activity: 'Infra-Supabase'
ref: 'شاخه arena/32c2d8dd-escaperoom` ➔ `arena/c9528bce-escaperoom` — فایل `supabase/migrations/001_initial_schema.sql'
branch: 'arena/32c2d8dd-escaperoom'
status: 'archive'
created_by: 'توحید (اجرا توسط: ایجنت چهارم زیرساخت — به مدیریت توحید)'
created_at_jalali: '1405-07-29'
created_at_time: '15:59:27'
created_at_utc: '2026-10-21T12:29:27.000Z'
archived_by: 'ایجنت چهارم زیرساخت (به مدیریت توحید)'
archived_at_jalali: '1405-07-29'
archived_at_time: '16:19:23'
archived_at_utc: '2026-10-21T12:49:23.000Z'
archive_note: 'آرشیو هنگام کامیت 94047cb — «chore(infra): wave 1 — execute Supabase migration 001 & archive Tohid infra request»'
commits: ['94047cb']
tags: null
---

# گزارش فعالیت تیمی — 1405-07-29_15-59-27_tohid_infra-supabase-migration-001

> ⚙️ جدول مشخصات و چرخه عمر این فایل به‌صورت خودکار از فراداده (YAML) بالای فایل توسط
> `npm run worklog:sync` ساخته می‌شود؛ برای تغییر وضعیت از `npm run worklog:archive` استفاده کنید.

<!-- WORKLOG:LOG-HEADER:START -->
## 📌 مشخصات فعالیت

| فیلد | مقدار |
| --- | --- |
| **شناسه لاگ** | `1405-07-29_15-59-27_tohid_infra-supabase-migration-001` |
| **عنوان** | درخواست اجرای مایگریشن ۰۰۱ روی Supabase |
| **خلاصه** | تکمیل درخواست زیرساخت توحید توسط ایجنت چهارم: اجرای `supabase/migrations/001_initial_schema.sql` روی پروژه `escaperoom-orfeo` (`yavwoaqxhptzufmjckwz`)، تست سلامت جدول `public.rooms` و ثبت امن متغیرهای محیطی در Vercel. |
| **نوع فعالیت** | `Infra-Supabase` |
| **مرجع** | شاخه arena/32c2d8dd-escaperoom` ➔ `arena/c9528bce-escaperoom` — فایل `supabase/migrations/001_initial_schema.sql |
| **شاخه** | `arena/32c2d8dd-escaperoom` |
| **ساخته‌شده توسط** | **توحید (اجرا توسط: ایجنت چهارم زیرساخت — به مدیریت توحید)** |
| **زمان ایجاد (ایران / شمسی)** | **۱۴۰۵/۰۷/۲۹ — ۱۵:۵۹:۲۷** |
| **زمان ایجاد (UTC)** | `2026-10-21T12:29:27.000Z` |
| **وضعیت فعلی** | ✅ **Archive** (تأیید/ادغام یا اجراشده) |
| **آرشیو شده توسط** | **ایجنت چهارم زیرساخت (به مدیریت توحید)** |
| **زمان آرشیو (ایران / شمسی)** | **۱۴۰۵/۰۷/۲۹ — ۱۶:۱۹:۲۳** |
| **زمان آرشیو (UTC)** | `2026-10-21T12:49:23.000Z` |
| **یادداشت آرشیو** | آرشیو هنگام کامیت 94047cb — «chore(infra): wave 1 — execute Supabase migration 001 & archive Tohid infra request» |
| **کامیت‌های مرتبط** | `94047cb` |

## 🔁 چرخه عمر لاگ

| رویداد | توسط | تاریخ شمسی | ساعت (ایران) | زمان UTC | یادداشت |
| --- | --- | --- | --- | --- | --- |
| 🟡 ایجاد و ثبت در `Pending` | **توحید (اجرا توسط: ایجنت چهارم زیرساخت — به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۵:۵۹:۲۷ | `2026-10-21T12:29:27.000Z` | ثبت اولیه گزارش |
| 🟢 تبدیل به `Archive` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۱۹:۲۳ | `2026-10-21T12:49:23.000Z` | آرشیو هنگام کامیت 94047cb — «chore(infra): wave 1 — execute Supabase migration 001 & archive Tohid infra request» |

> 🧾 **خط زمان:** این لاگ در **۱۴۰۵/۰۷/۲۹ — ۱۵:۵۹:۲۷** توسط **توحید (اجرا توسط: ایجنت چهارم زیرساخت — به مدیریت توحید)** ساخته شد و در **۱۴۰۵/۰۷/۲۹ — ۱۶:۱۹:۲۳** توسط **ایجنت چهارم زیرساخت (به مدیریت توحید)** به **`Archive`** منتقل شد.
<!-- WORKLOG:LOG-HEADER:END -->

---

## شرح دقیق عملیات درخواستی
در موج ۱ توحید، فایل مهاجرت `supabase/migrations/001_initial_schema.sql` ساخته شد (جدول `public.rooms` با ستون‌های `code/version/phase/state_json/created_at/updated_at`، ایندکس‌های `phase` و `updated_at` و فعال‌سازی RLS بدون policy عمومی).

از **ایجنت چهارم زیرساخت (با مدیریت توحید)** درخواست می‌شود:
1. پروژه Supabase مخصوص بازی را بررسی/ایجاد کند و این فایل مهاجرت را روی آن اجرا نماید.
2. با کوئری سلامت `SELECT to_regclass('public.rooms');` آماده بودن جدول را تأیید کند.
3. مقادیر `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` را **بدون نوشتن در Git**، مستقیماً در متغیرهای محیطی رمزنگاری‌شده Vercel (`STORAGE_DRIVER=supabase`) ثبت کند.
4. نتیجه اجرا و وضعیت نهایی را در همین فایل ثبت و آن را از `Pending` به `Archive` منتقل نماید.

> در محیط توسعه محلی و Sandbox نیازی به این عملیات نیست؛ بازی به‌صورت پیش‌فرض با `node:sqlite` اجرا می‌شود.

---

## نتیجه اجرای ایجنت چهارم (زیرساخت)
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
