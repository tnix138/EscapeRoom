---
id: '1405-07-29_19-30-50_infra-agent_production-deploy-3d-orfeo'
title: 'دیپلوی Production نسخه سه‌بعدی (Three.js) و پوسته خوانا روی Vercel و تست سلامت Supabase'
summary: 'استقرار نسخه سه‌بعدی و پوسته خوانای جدید روی Vercel Production (dpl_w6wdyEKqCrGJpasSK81vXgQy4seV — READY/PROMOTED در ۳۲.۵ ثانیه)، بررسی سلامت ۵ سرویس Supabase و Smoke Test زنده ۷ مسیر'
author: 'ایجنت چهارم زیرساخت (به مدیریت توحید)'
author_slug: 'infra-agent'
activity: 'Infra-FullDeploy'
ref: 'Vercel dpl_w6wdyEKqCrGJpasSK81vXgQy4seV / Supabase yavwoaqxhptzufmjckwz'
branch: 'arena/5f12b76c-escaperoom'
status: 'archive'
created_by: 'ایجنت چهارم زیرساخت (به مدیریت توحید)'
created_at_jalali: '1405-07-29'
created_at_time: '19:30:50'
created_at_utc: '2026-10-21T16:00:50.000Z'
archived_by: 'ایجنت چهارم زیرساخت (به مدیریت توحید)'
archived_at_jalali: '1405-07-29'
archived_at_time: '19:43:04'
archived_at_utc: '2026-10-21T16:13:04.000Z'
archive_note: 'ادغام در PR #43 (23e66f4)'
commits: ['9d25ac0']
tags: null
---

# گزارش فعالیت تیمی — 1405-07-29_19-30-50_infra-agent_production-deploy-3d-orfeo

> ⚙️ جدول مشخصات و چرخه عمر این فایل به‌صورت خودکار از فراداده (YAML) بالای فایل توسط
> `npm run worklog:sync` ساخته می‌شود؛ برای تغییر وضعیت از `npm run worklog:archive` استفاده کنید.

<!-- WORKLOG:LOG-HEADER:START -->
## 📌 مشخصات فعالیت

| فیلد | مقدار |
| --- | --- |
| **شناسه لاگ** | `1405-07-29_19-30-50_infra-agent_production-deploy-3d-orfeo` |
| **عنوان** | دیپلوی Production نسخه سه‌بعدی (Three.js) و پوسته خوانا روی Vercel و تست سلامت Supabase |
| **خلاصه** | استقرار نسخه سه‌بعدی و پوسته خوانای جدید روی Vercel Production (dpl_w6wdyEKqCrGJpasSK81vXgQy4seV — READY/PROMOTED در ۳۲.۵ ثانیه)، بررسی سلامت ۵ سرویس Supabase و Smoke Test زنده ۷ مسیر |
| **نوع فعالیت** | `Infra-FullDeploy` |
| **مرجع** | Vercel dpl_w6wdyEKqCrGJpasSK81vXgQy4seV / Supabase yavwoaqxhptzufmjckwz |
| **شاخه** | `arena/5f12b76c-escaperoom` |
| **ساخته‌شده توسط** | **ایجنت چهارم زیرساخت (به مدیریت توحید)** |
| **زمان ایجاد (ایران / شمسی)** | **۱۴۰۵/۰۷/۲۹ — ۱۹:۳۰:۵۰** |
| **زمان ایجاد (UTC)** | `2026-10-21T16:00:50.000Z` |
| **وضعیت فعلی** | ✅ **Archive** (تأیید/ادغام یا اجراشده) |
| **آرشیو شده توسط** | **ایجنت چهارم زیرساخت (به مدیریت توحید)** |
| **زمان آرشیو (ایران / شمسی)** | **۱۴۰۵/۰۷/۲۹ — ۱۹:۴۳:۰۴** |
| **زمان آرشیو (UTC)** | `2026-10-21T16:13:04.000Z` |
| **یادداشت آرشیو** | ادغام در PR #43 (23e66f4) |
| **کامیت‌های مرتبط** | `9d25ac0` |

## 🔁 چرخه عمر لاگ

| رویداد | توسط | تاریخ شمسی | ساعت (ایران) | زمان UTC | یادداشت |
| --- | --- | --- | --- | --- | --- |
| 🟡 ایجاد و ثبت در `Pending` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۹:۳۰:۵۰ | `2026-10-21T16:00:50.000Z` | ثبت اولیه گزارش |
| 🟢 تبدیل به `Archive` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۹:۴۳:۰۴ | `2026-10-21T16:13:04.000Z` | ادغام در PR #43 (23e66f4) |

> 🧾 **خط زمان:** این لاگ در **۱۴۰۵/۰۷/۲۹ — ۱۹:۳۰:۵۰** توسط **ایجنت چهارم زیرساخت (به مدیریت توحید)** ساخته شد و در **۱۴۰۵/۰۷/۲۹ — ۱۹:۴۳:۰۴** توسط **ایجنت چهارم زیرساخت (به مدیریت توحید)** به **`Archive`** منتقل شد.
<!-- WORKLOG:LOG-HEADER:END -->

---

## 📝 شرح دقیق فعالیت انجام‌شده

- **موضوع:** دیپلوی Production نسخه سه‌بعدی (Three.js) و پوسته خوانا روی Vercel و تست سلامت Supabase (پس از تأیید صریح کاربر)
- **مرجع:** Vercel `dpl_w6wdyEKqCrGJpasSK81vXgQy4seV` / Supabase `yavwoaqxhptzufmjckwz`
- **جزئیات عملیات ابری:**
  1. **تست سلامت و داده در Supabase (`escaperoom-orfeo` / `yavwoaqxhptzufmjckwz`):**
     - سرویس‌های `db`، `rest`، `auth` (`GoTrue v2.197.0`)، `realtime` و `pooler` همگی در وضعیت `ACTIVE_HEALTHY` هستند.
     - مایگریشن `20261021124510` (`initial_schema_rooms`) منطبق با `supabase/migrations/001_initial_schema.sql` فعال است و نیاز به مایگریشن جدیدی نیست.
     - جدول `public.rooms` دارای ۵ اتاق فعال (`XUCWLD` با `version: 71`، `E9XFHG` با `version: 18`، `WZ3ZEQ` با `version: 3`، `CK2UPX` با `version: 3` و `4DTLVZ` با `version: 1`) است.
  2. **دیپلوی Vercel Production (`escaperoom-orfeo` / `prj_HD4C8ADfEmbBJtIFToqu7GuxyOtI`):**
     - ایجاد دیپلوی Production روی شاخه `main` (کامیت `beaad6e8910ba3c9d6ed15a7e2f090df3e75a614` شامل موتور سه‌بعدی Three.js، پوسته خوانای موج ۲ و ۳، و ممیزی موج ۱).
     - شناسه دیپلوی: `dpl_w6wdyEKqCrGJpasSK81vXgQy4seV` (`escaperoom-orfeo-m6abk9wak-tnix138.vercel.app`).
     - وضعیت نهایی: `READY` / `PROMOTED` در زمان بیلد `32.5` ثانیه (`32530 ms`) روی دامنه اصلی `https://escaperoom-orfeo.vercel.app`.
  3. **آرشیو لاگ‌های PR #40 ایجنت چهارم:**
     - انتقال ۴ لاگ ادغام‌شدهٔ PR #40 (`1405-07-29_19-23-06_infra-agent_wave1-infra-build-audit`، `1405-07-29_19-24-00_infra-agent_push`، `1405-07-29_19-25-43_infra-agent_pr40-wave1-infra-audit` و `1405-07-29_19-26-07_infra-agent_push`) به `logs/archive/`.

## ✅ نتیجه بررسی‌ها و تست‌ها

- `GET https://escaperoom-orfeo.vercel.app/api/health` → `{"ok":true,"data":{"status":"healthy","storageDriver":"supabase","serverNow":1792598415075}}`
- `GET https://escaperoom-orfeo.vercel.app/` → رندر کامل تالار رزرو «پردهٔ سرخ | تماشاخانهٔ اُرفه‌ئو»
- `GET https://escaperoom-orfeo.vercel.app/preview/alley` → رندر کوچه سه‌بعدی واقعی (Three.js)، راهنمای کنترل‌ها و قاب خوانای بلیط/کوپن
- `GET https://escaperoom-orfeo.vercel.app/preview/cinema` → رندر کات‌سین سه‌بعدی دربان و سالن ۲۰ نفره
- `GET https://escaperoom-orfeo.vercel.app/preview/auditorium` → رندر سالن سه‌بعدی تاریک و ویران
- `GET https://escaperoom-orfeo.vercel.app/preview/performance` → رندر صفحه بنچمارک کارایی و لایسنس دارایی‌ها (موج ۱۰)
- `GET https://escaperoom-orfeo.vercel.app/room/XUCWLD` → اتصال زنده به Supabase و نمایش گارد لینک دعوت اختصاصی
- `npm run worklog:check && npm test` → موفق (۱۷ فایل تست، ۱۵۰ تست پاس)
