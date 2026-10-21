---
agent: Infrastructure
wave: 9
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# ایجنت چهارم زیرساخت — موج ۹: بررسی مسیرهای ذخیره‌سازی و بازخوانی کاوش سالن و تخته سرنخ‌ها

## دامنهٔ انجام‌شده

- بررسی مسیر ذخیره‌سازی و بازخوانی وضعیت کاوش سالن (`inspectedHotspots`، `restartedInTheaterAt` و `messages`) در جدول `public.rooms` پایگاه دادهٔ Supabase Cloud (`yavwoaqxhptzufmjckwz`) و درایور محلی SQLite (`.data/escaperoom.db`).
- بررسی یکپارچگی اکشن‌های فاز `in_theater` در `POST /api/rooms/[code]/action` (`inspect_hotspot` برای ۵ نقطهٔ تعاملی سالن و `chat` برای تختهٔ گفتگو/یادداشت تیمی) و حفظ کامل وضعیت کاوش پس از رفرش صفحه یا اتصال مجدد.
- بررسی تطابق کامل با تست‌های موج ۹ توحید (`tests/tohid/persistent-exploration.test.ts` و `tests/tohid/exploration-immutability-and-chat-security.test.ts`).
- استقرار موج ۹ امیرعلی (`PR #69` — HUD کاوش سالن تاریک `ExplorationHud.tsx`، تختهٔ تیمی ۵ نقطه‌ای، بازخوانی کشف‌ها پس از رفرش و صفحهٔ بررسی `/qa/exploration`) روی Vercel Production با شناسهٔ `dpl_92YBE2abGq9ebZLzNcixLBzzchrc` (کامیت `b7dcb50`).

## شواهد ذخیره‌سازی و بازخوانی در Supabase Cloud

| شاخص / فیلد پایداری | وضعیت در `public.rooms` (`yavwoaqxhptzufmjckwz`) | نتیجه |
| --- | --- | --- |
| **اتاق‌های فاز `in_theater`** | اتاق‌های `RZ8ASU` (نسخهٔ `116`) و `XUCWLD` (نسخهٔ `71`) با کلیدهای `inspectedHotspots`، `restartedInTheaterAt` و `messages` در `state_json` | ✅ پایدار |
| **موتور ذخیره‌سازی دوگانه (`SQLite` / `Supabase`)** | هم‌ارزی کامل ذخیره‌سازی و بازخوانی اتمیک همراه با افزایش `version` و به‌روزرسانی `updated_at` (`tests/tohid/supabase-driver-and-schema-parity.test.ts`) | ✅ تاییدشده |
| **امنیت پیام‌ها و عدم تغییرپذیری کاوش** | نرمال‌سازی پیام‌های چت، محدودسازی طول پیام، و حفظ یکتایی نقاط بررسی‌شدهٔ سالن در برابر درخواست‌های تکراری | ✅ تاییدشده |

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm test` — ۲۷ فایل، ۲۰۴ تست موفق (شامل `persistent-exploration.test.ts`، `exploration-immutability-and-chat-security.test.ts` و `supabase-driver-and-schema-parity.test.ts`).
