# 📜 تغییرات — تماشاخانه اُرفه‌ئو

> همهٔ تاریخ‌ها میلادی‌اند · مرجع فازها: `docs/PHASE.md`

## [منتشرنشده] — در حال آماده‌سازی انتشار

### افزوده شد

**فاز ۰۳ — مدل حضور بازیکن (توحید، #76)**
- قرارداد `PresenceSnapshot` در `src/contracts/presence.ts` با محدودهٔ کوچه و سالن
- `src/server/presence/` — نگه‌داری آخرین snapshot، انقضای ۳۰ ثانیه، هم‌جوشی ارسال ۵۰ms
- `POST|GET /api/rooms/[code]/presence` با احراز توکن صندلی و سقف ۵۰ درخواست در ثانیه
- رویداد `presence_update` در استریم SSE (تأخیر اندازه‌گیری‌شده ۵۱ms)
- ۲۱ تست در `tests/tohid/presence-*.test.ts`

**فاز ۰۹ — احراز هویت پنل ادمین (امیر، #94 / #82)**
- `src/server/admin/session.ts` — JWT HS256 بدون وابستگی، بررسی رمز scrypt (ثابت‌زمان)، کوکی `httpOnly` با `SameSite=Lax` و `Secure` در production
- `POST /api/admin/login` و `POST /api/admin/logout` — ورود با `username`/`password` از env، سقف ۵ تلاش در دقیقه، ۴۰۳ برای غیر ادمین
- `src/components/admin/LoginForm.tsx` و `src/app/admin/guard.ts`
- ۱۶ تست در `tests/amir/admin-auth.test.ts`

**فاز ۱۰ — داشبورد آمار و مشاهده (امیر، #83)**
- `GET /api/admin/stats|rooms|players` با آمار هم‌خوان دیتابیس (شامل تعداد خطا و نرخ خطا)
- صفحات `/admin`، `/admin/rooms`، `/admin/players` و کامپوننت‌های `StatsCard`، `RoomsTable`، `PlayersTable`، `AdminSidebar`
- `countAdminEvents` در هر دو درایور (SQLite و Supabase)
- ۷ تست در `tests/amir/admin-stats.test.ts`

**فاز ۱۳ — ابزارهای مدیریتی (امیر، #86)**
- `DELETE /api/admin/players/[id]` — اخراج بازیکن با باطل‌کردن توکن صندلی و ثبت رویداد `player_removed`
- `GET /api/admin/errors` و صفحهٔ `/admin/errors` با زمان و کد خطا
- ۶ تست در `tests/amir/admin-players.test.ts`

**فاز ۰۷ — قرارداد ترس (توحید، پایهٔ کار #90 و #91)**
- `src/contracts/horror.ts` — `HorrorIntensity`، `HorrorSignal`، تبدیل تهدید/فاصله به سطح، اعتبارسنجی zod
- ۹ تست در `tests/tohid/horror-contract.test.ts`

**فاز ۱۰ و ۱۳ — مدل دادهٔ پنل ادمین (توحید، پایهٔ کار امیر)**
- `src/contracts/admin.ts` — `AdminSession` (قرارداد ۵)، `RoomSummary`، `AdminEvent` (قرارداد ۶)
- متدهای `listRooms`، `recordAdminEvent`، `listAdminEvents`، `deleteSeat` در هر دو درایور SQLite و Supabase
- `src/server/admin/room-summary.ts` — خلاصهٔ امن اتاق و آمار داشبورد (بدون توکن یا جواب معما)
- `supabase/migrations/002_admin_events.sql` با ایندکس‌ها و RLS
- ۱۹ تست در `tests/tohid/admin-*.test.ts`

**فاز ۰۲ — اتوماسیون CI/CD (توحید، #75)**
- `.github/workflows/ci.yml`، `auto-merge.yml`، `deploy.yml` مطابق `docs/AUTO.md`
- `scripts/auto-merge.mjs` — سیاست merge با محافظ شاخه، تشخیص merge تکراری و تعارض
- `scripts/lint.mjs` — لینتر بدون وابستگی جدید (console.log، debugger، TODO، any، it.only)
- `.github/workflows/issue-sync.yml` — همگام‌سازی Issueهای تیم با `scripts/issue-plan.json`

**فاز ۱۵ — ابزارهای انتشار (توحید، #88)**
- `scripts/smoke-test.mjs` — ۸ مرحله آزمون مسیر اصلی (سلامت، ساخت اتاق، توکن، حضور، SSE)
- `scripts/hash-admin-password.mjs` — ساخت هش scrypt برای رمز ادمین
- اسمک‌تست به‌صورت خودکار بعد از deploy روی `PRODUCTION_URL` اجرا می‌شود

### رفع شد
- `package.json` با BOM ذخیره شده بود و `next build` (و هر deploy روی Vercel) با `SyntaxError` می‌شکست.
- اسکریپت `lint` که مستندات CI الزام کرده بود وجود نداشت.
- انتشار خودکار به اتصال Git پروژهٔ Vercel منتقل شد (هر merge روی `main` خودش روی production می‌رود)؛ ورک‌فلوی `Deploy` گیت‌هاب فقط‌-دستی شد تا به‌خاطر secretهای تنظیم‌نشده روی هر push شکست نخورد و دیپلوی دوبل ساخته نشود.

### تست
- `npm run typecheck`، `npm run lint`، `npm test` و `npm run build` سبز
- اسمک‌تست روی سرور تولیدی محلی: ۸ از ۸ مرحله سبز

### باقی‌مانده برای انتشار
- [ ] ادغام شاخهٔ کار به `main` تا زنجیرهٔ CI → Auto-merge → Deploy فعال شود
- [ ] تنظیم `VERCEL_TOKEN`، `VERCEL_ORG_ID`، `VERCEL_PROJECT_ID`، `PRODUCTION_URL`
- [ ] تنظیم `STORAGE_DRIVER=supabase` و کلیدهای Supabase روی production
- [ ] اجرای `002_admin_events.sql` روی Supabase
- [ ] ثبت `ADMIN_USERNAME` و `ADMIN_PASSWORD_HASH` (تولید با `npm run hash:admin`)
