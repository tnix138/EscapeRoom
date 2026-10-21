---
agent: Infrastructure
wave: 5
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# ایجنت چهارم زیرساخت — موج ۵: Smoke Test بلیت و کوپن یکپارچه و پیوستن چند کاربر

## دامنهٔ انجام‌شده

- اجرای Smoke Test کامل چرخهٔ رزرو (`POST /api/rooms`)، بازخوانی توکن‌های صندلی میزبان (`POST /api/rooms/[code]` با `hostToken`)، پیوستن هم‌زمان چند بازیکن با لینک دعوت صندلی (`POST /api/rooms/[code]/join` با `seatToken`) و بررسی گارد عدم دسترسی بدون توکن روی `/room/[code]`.
- بررسی ذخیرهٔ پایدار اتاق‌ها در جدول `public.rooms` پایگاه دادهٔ Supabase Cloud (`yavwoaqxhptzufmjckwz`) بدون نشت `seatToken` یا `sessionToken` بازیکنان دیگر در نمای عمومی.
- بررسی سازگاری کامل با پیاده‌سازی موج ۵ توحید (`tests/tohid/reservation-recovery.test.ts`، `tests/tohid/cyclic-tickets-3-to-8.test.ts`) و موج ۵ امیرعلی (`tests/amirali/reservation-wave5.test.ts`).

## نتایج Smoke Test مسیر دعوت‌نامه و پیوستن چند کاربر

| مرحله / مسیر | ورودی و سناریو | نتیجه |
| --- | --- | --- |
| **`POST /api/rooms`** | ایجاد اتاق ۳ تا ۸ نفره با لیست بازیکنان و دریافت `hostToken`، `sessionToken` صندلی ۱ و آرایهٔ `invitations` (شامل `seatToken` و `invitePath`) | ✅ `200 OK` |
| **`POST /api/rooms/[code]` (Host Recovery)** | بازیابی لیست دعوت‌نامه‌ها و لینک‌های اختصاصی هر صندلی با ارسال `hostToken` پس از رفرش صفحه | ✅ `200 OK` |
| **`POST /api/rooms/[code]/join`** | پیوستن بازیکنان صندلی ۲ و ۳ با `seatToken` اختصاصی و دریافت `sessionToken` مستقل هر صندلی | ✅ `200 OK` |
| **`GET /room/[code]` (بدون توکن دعوت)** | باز کردن مستقیم آدرس اتاق بدون توکن صندلی (`https://escaperoom-orfeo.vercel.app/room/XUCWLD`) | ✅ نمایش گارد `🎟️ لینک دعوت لازم است` |
| **پایداری در Supabase (`public.rooms`)** | بررسی اتاق‌های فعال در Supabase Cloud (`RZ8ASU` نسخه ۱۱۶، `XUCWLD` نسخه ۷۱، `E9XFHG` نسخه ۱۸) | ✅ ثبت پایدار و بدون نشت توکن |

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm test` — ۲۷ فایل، ۲۰۴ تست موفق (شامل ۱۹ تست `reservation-wave5.test.ts`، ۲ تست `reservation-recovery.test.ts` و ۸ تست `cyclic-tickets-3-to-8.test.ts`).
