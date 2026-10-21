---
id: '1405-07-29_19-58-32_tohid_pr-wave5-reservation-recovery'
title: 'ثبت PR #49 — رزرو و بازیابی نشست موج ۵'
summary: 'PR #49 تست API رزرو، invite و refresh همان seat را اضافه می‌کند؛ قرارداد و مسیرهای runtime دست‌نخورده‌اند.'
author: 'توحید'
author_slug: 'tohid'
activity: 'PR'
ref: 'https://github.com/tnix138/EscapeRoom/pull/49'
branch: 'arena/bab0d18a-escaperoom'
status: 'pending'
created_by: 'توحید'
created_at_jalali: '1405-07-29'
created_at_time: '19:58:32'
created_at_utc: '2026-10-21T16:28:32.000Z'
archived_by: null
archived_at_jalali: null
archived_at_time: null
archived_at_utc: null
archive_note: null
commits: null
tags: null
---

# گزارش فعالیت تیمی — 1405-07-29_19-58-32_tohid_pr-wave5-reservation-recovery

> ⚙️ جدول مشخصات و چرخه عمر این فایل به‌صورت خودکار از فراداده (YAML) بالای فایل توسط
> `npm run worklog:sync` ساخته می‌شود؛ برای تغییر وضعیت از `npm run worklog:archive` استفاده کنید.

<!-- WORKLOG:LOG-HEADER:START -->
## 📌 مشخصات فعالیت

| فیلد | مقدار |
| --- | --- |
| **شناسه لاگ** | `1405-07-29_19-58-32_tohid_pr-wave5-reservation-recovery` |
| **عنوان** | ثبت PR #49 — رزرو و بازیابی نشست موج ۵ |
| **خلاصه** | PR #49 تست API رزرو، invite و refresh همان seat را اضافه می‌کند؛ قرارداد و مسیرهای runtime دست‌نخورده‌اند. |
| **نوع فعالیت** | `PR` |
| **مرجع** | https://github.com/tnix138/EscapeRoom/pull/49 |
| **شاخه** | `arena/bab0d18a-escaperoom` |
| **ساخته‌شده توسط** | **توحید** |
| **زمان ایجاد (ایران / شمسی)** | **۱۴۰۵/۰۷/۲۹ — ۱۹:۵۸:۳۲** |
| **زمان ایجاد (UTC)** | `2026-10-21T16:28:32.000Z` |
| **وضعیت فعلی** | 🟡 **Pending** (در انتظار تأیید، ادغام یا اجرا) |

## 🔁 چرخه عمر لاگ

| رویداد | توسط | تاریخ شمسی | ساعت (ایران) | زمان UTC | یادداشت |
| --- | --- | --- | --- | --- | --- |
| 🟡 ایجاد و ثبت در `Pending` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۹:۵۸:۳۲ | `2026-10-21T16:28:32.000Z` | ثبت اولیه گزارش |
| 🟢 تبدیل به `Archive` | ⏳ در انتظار | — | — | — | هنوز آرشیو نشده است |

> 🧾 **خط زمان:** این لاگ در **۱۴۰۵/۰۷/۲۹ — ۱۹:۵۸:۳۲** توسط **توحید** ساخته شد و در حال حاضر در وضعیت **`Pending`** (در انتظار تأیید، ادغام یا اجرا) قرار دارد.
<!-- WORKLOG:LOG-HEADER:END -->

---

موج ۵ توحید با تست route-level برای رزرو، لینک دعوت، احراز seat پس از refresh و ورودی‌های نامعتبر. تغییر فقط tests/docs است؛ تست Playwright مالک Alireza اجرا/ادعا نشده است. CI نهایی پس از ارسال این لاگ بررسی شود.
