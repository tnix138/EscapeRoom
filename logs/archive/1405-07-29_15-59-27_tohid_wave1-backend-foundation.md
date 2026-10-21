---
id: '1405-07-29_15-59-27_tohid_wave1-backend-foundation'
title: 'موج ۱ توحید — اسکلت بک‌اند، دیتابیس دوگانه و رزرو ۳–۸ نفره'
summary: 'اجرای موج ۱ توحید: اسکافولد Next.js + قرارداد منجمد، `createPreviewRoomState` برای امیرعلی/علیرضا، دیتابیس دوگانه SQLite/Supabase با OCC، توکن SHA-256، `POST /api/rooms` رزرو ۳–۸ نفره با لینک دعوت نام‌دار، `GET /api/health` و ۱۴ تست پاس.'
author: 'توحید'
author_slug: 'tohid'
activity: 'Commit'
ref: 'شاخه `arena/32c2d8dd-escaperoom` — موج ۱ توحید (هش کامیت در پیام کامیت همین گزارش ثبت شده است)'
branch: 'arena/32c2d8dd-escaperoom'
status: 'archive'
created_by: 'توحید'
created_at_jalali: '1405-07-29'
created_at_time: '15:59:27'
created_at_utc: '2026-10-21T12:29:27.000Z'
archived_by: 'توحید'
archived_at_jalali: '1405-07-29'
archived_at_time: '16:07:49'
archived_at_utc: '2026-10-21T12:37:49.000Z'
archive_note: 'آرشیو هنگام کامیت a3a3ba0 — «docs(worklog): archive merged wave 1-3 logs (Tohid)»'
commits: ['60abe2e', 'a3a3ba0']
tags: null
---

# گزارش فعالیت تیمی — 1405-07-29_15-59-27_tohid_wave1-backend-foundation

> ⚙️ جدول مشخصات و چرخه عمر این فایل به‌صورت خودکار از فراداده (YAML) بالای فایل توسط
> `npm run worklog:sync` ساخته می‌شود؛ برای تغییر وضعیت از `npm run worklog:archive` استفاده کنید.

<!-- WORKLOG:LOG-HEADER:START -->
## 📌 مشخصات فعالیت

| فیلد | مقدار |
| --- | --- |
| **شناسه لاگ** | `1405-07-29_15-59-27_tohid_wave1-backend-foundation` |
| **عنوان** | موج ۱ توحید — اسکلت بک‌اند، دیتابیس دوگانه و رزرو ۳–۸ نفره |
| **خلاصه** | اجرای موج ۱ توحید: اسکافولد Next.js + قرارداد منجمد، `createPreviewRoomState` برای امیرعلی/علیرضا، دیتابیس دوگانه SQLite/Supabase با OCC، توکن SHA-256، `POST /api/rooms` رزرو ۳–۸ نفره با لینک دعوت نام‌دار، `GET /api/health` و ۱۴ تست پاس. |
| **نوع فعالیت** | `Commit` |
| **مرجع** | شاخه `arena/32c2d8dd-escaperoom` — موج ۱ توحید (هش کامیت در پیام کامیت همین گزارش ثبت شده است) |
| **شاخه** | `arena/32c2d8dd-escaperoom` |
| **ساخته‌شده توسط** | **توحید** |
| **زمان ایجاد (ایران / شمسی)** | **۱۴۰۵/۰۷/۲۹ — ۱۵:۵۹:۲۷** |
| **زمان ایجاد (UTC)** | `2026-10-21T12:29:27.000Z` |
| **وضعیت فعلی** | ✅ **Archive** (تأیید/ادغام یا اجراشده) |
| **آرشیو شده توسط** | **توحید** |
| **زمان آرشیو (ایران / شمسی)** | **۱۴۰۵/۰۷/۲۹ — ۱۶:۰۷:۴۹** |
| **زمان آرشیو (UTC)** | `2026-10-21T12:37:49.000Z` |
| **یادداشت آرشیو** | آرشیو هنگام کامیت a3a3ba0 — «docs(worklog): archive merged wave 1-3 logs (Tohid)» |
| **کامیت‌های مرتبط** | `60abe2e` , `a3a3ba0` |

## 🔁 چرخه عمر لاگ

| رویداد | توسط | تاریخ شمسی | ساعت (ایران) | زمان UTC | یادداشت |
| --- | --- | --- | --- | --- | --- |
| 🟡 ایجاد و ثبت در `Pending` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۵:۵۹:۲۷ | `2026-10-21T12:29:27.000Z` | ثبت اولیه گزارش |
| 🟢 تبدیل به `Archive` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۰۷:۴۹ | `2026-10-21T12:37:49.000Z` | آرشیو هنگام کامیت a3a3ba0 — «docs(worklog): archive merged wave 1-3 logs (Tohid)» |

> 🧾 **خط زمان:** این لاگ در **۱۴۰۵/۰۷/۲۹ — ۱۵:۵۹:۲۷** توسط **توحید** ساخته شد و در **۱۴۰۵/۰۷/۲۹ — ۱۶:۰۷:۴۹** توسط **توحید** به **`Archive`** منتقل شد.
<!-- WORKLOG:LOG-HEADER:END -->

---

## شرح دقیق فعالیت انجام‌شده
اجرای کامل **موج ۱ توحید** طبق `TASKS-TOHID.md`:

1. **گام ۰ مشترک:** اسکافولد Next.js 15 + TypeScript و فایل منجمد قرارداد `src/contracts/types.ts` و `src/contracts/actions.ts` از روی `API-CONTRACT.md` (بدون دست‌کاری فایل‌های امیرعلی و علیرضا؛ صفحه/لی‌آوت ساخته نشد).
2. **اولویت اول موج ۱ — `src/client-sdk/preview-fixtures.ts`:** تابع `createPreviewRoomState(phase, playerCount)` برای هر ۴ فاز و ۳ تا ۸ بازیکن، تا امیرعلی (`/preview/invitation` و `/preview/alley`) و علیرضا (`/preview/cinema` و `/preview/auditorium`) از همین لحظه با داده واقعی و بدون سرور کار کنند.
3. **دیتابیس دوگانه + OCC:** اینترفیس `RoomRepository` در `src/server/db/repository.ts`، پیاده‌سازی پایدار `node:sqlite` در `.data/escaperoom.db` (`sqlite-repository.ts`) و پیاده‌سازی ابری PostgREST (`supabase-repository.ts`)؛ ذخیره مشروط با `WHERE code = ? AND version = ?` و آماده‌سازی حلقه تلاش مجدد OCC در `room-service.ts`.
4. **رزرو ۳–۸ نفره:** اندپوینت `POST /api/rooms` با اعتبارسنجی Zod (تعداد ۳ تا ۸، نام ۲ تا ۲۴ کاراکتر، پاک‌سازی XSS، نام یکتا)، تخصیص صندلی‌های ردیف ۱ و ۲ سالن ۲۰ نفره، تولید توکن ۴۸ کاراکتری هر صندلی و نگهداری فقط هش `SHA-256` در دیتابیس (`src/server/auth/seat-token.ts`)، به‌همراه `GET /api/health`.
5. **اسکیما ابری:** فایل `supabase/migrations/001_initial_schema.sql` (جدول `rooms` + ایندکس + RLS) — اجرای آن روی Supabase در لاگ زیرساختی جداگانه از ایجنت چهارم درخواست شد.
6. **پشتیبانی موج‌های بعد:** `src/engine/rng.ts` (Mulberry32)، `ticket-puzzle.ts` (اهداف حلقوی)، `view-projector.ts` (عدم نشت رقم طلایی/پاسخ پیش از پانچ)، `room-hub.ts` و اسکلت `useTheaterSession`/`reserveRoomApi` در `src/client-sdk/index.ts` دقیقاً با امضاهای قرارداد.

## نتیجه تست‌ها
- `npm run typecheck` — بدون خطا
- `npm run test:tohid` — ۱۴ تست پاس (رزرو ۳ تا ۸ نفره، پایداری پس از ری‌استارت، OCC، هش توکن، عدم نشت جواب، فیكسچر هر ۴ فاز)
- `npm run build` — موفق
- تست زنده: `GET /api/health` سالم با `storageDriver: "sqlite"` و `POST /api/rooms` برای ۳ نفر («توحید، امیرعلی، علیرضا») و ۸ نفر، ۳/۸ لینک دعوت نام‌دار صادر کرد و ورودی ۲ نفره با `400 VALIDATION_ERROR` رد شد.
