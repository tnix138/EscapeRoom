---
id: '1405-07-29_19-58-02_tohid_wave5-reservation-recovery'
title: 'موج ۵ توحید — رزرو، دعوت و بازیابی نشست'
summary: 'آزمون API رزرو و بازیابی همان seat پس از refresh اضافه شد؛ ورودی نامعتبر و نشست جعلی نیز رد می‌شوند.'
author: 'توحید'
author_slug: 'tohid'
activity: 'Commit'
ref: 'شاخه arena/bab0d18a-escaperoom'
branch: 'arena/bab0d18a-escaperoom'
status: 'pending'
created_by: 'توحید'
created_at_jalali: '1405-07-29'
created_at_time: '19:58:02'
created_at_utc: '2026-10-21T16:28:02.000Z'
archived_by: null
archived_at_jalali: null
archived_at_time: null
archived_at_utc: null
archive_note: null
commits: null
tags: null
---

# گزارش فعالیت تیمی — 1405-07-29_19-58-02_tohid_wave5-reservation-recovery

> ⚙️ جدول مشخصات و چرخه عمر این فایل به‌صورت خودکار از فراداده (YAML) بالای فایل توسط
> `npm run worklog:sync` ساخته می‌شود؛ برای تغییر وضعیت از `npm run worklog:archive` استفاده کنید.

<!-- WORKLOG:LOG-HEADER:START -->
## 📌 مشخصات فعالیت

| فیلد | مقدار |
| --- | --- |
| **شناسه لاگ** | `1405-07-29_19-58-02_tohid_wave5-reservation-recovery` |
| **عنوان** | موج ۵ توحید — رزرو، دعوت و بازیابی نشست |
| **خلاصه** | آزمون API رزرو و بازیابی همان seat پس از refresh اضافه شد؛ ورودی نامعتبر و نشست جعلی نیز رد می‌شوند. |
| **نوع فعالیت** | `Commit` |
| **مرجع** | شاخه arena/bab0d18a-escaperoom |
| **شاخه** | `arena/bab0d18a-escaperoom` |
| **ساخته‌شده توسط** | **توحید** |
| **زمان ایجاد (ایران / شمسی)** | **۱۴۰۵/۰۷/۲۹ — ۱۹:۵۸:۰۲** |
| **زمان ایجاد (UTC)** | `2026-10-21T16:28:02.000Z` |
| **وضعیت فعلی** | 🟡 **Pending** (در انتظار تأیید، ادغام یا اجرا) |

## 🔁 چرخه عمر لاگ

| رویداد | توسط | تاریخ شمسی | ساعت (ایران) | زمان UTC | یادداشت |
| --- | --- | --- | --- | --- | --- |
| 🟡 ایجاد و ثبت در `Pending` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۹:۵۸:۰۲ | `2026-10-21T16:28:02.000Z` | ثبت اولیه گزارش |
| 🟢 تبدیل به `Archive` | ⏳ در انتظار | — | — | — | هنوز آرشیو نشده است |

> 🧾 **خط زمان:** این لاگ در **۱۴۰۵/۰۷/۲۹ — ۱۹:۵۸:۰۲** توسط **توحید** ساخته شد و در حال حاضر در وضعیت **`Pending`** (در انتظار تأیید، ادغام یا اجرا) قرار دارد.
<!-- WORKLOG:LOG-HEADER:END -->

---

PR قبلی موج ۴ ادغام شد؛ در موج ۵ تست route-level برای POST reservation و GET room با توکن‌های دعوت اضافه شد. سه توکن یکتا، هویت seat و phase پس از refresh ثابت می‌مانند؛ توکن در view افشا نمی‌شود و ورودی نامعتبر/توکن جعلی رد می‌شود. هیچ کد سرور/route/قرارداد مشترک یا فایل مالک UI تغییر نکرد. typecheck، ۴۴ تست Tohid، ۱۶۰ تست کلی، build و Worklog check موفق‌اند.
