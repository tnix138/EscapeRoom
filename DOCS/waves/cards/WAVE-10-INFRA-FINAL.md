# گزارش نهایی تکمیل ۱۰ موج — ایجنت چهارم زیرساخت (به مدیریت توحید)

**تاریخ:** ۱۴۰۵/۰۷/۲۹ (۲۰۲۶-۱۰-۲۱)
**شاخه کاری:** `arena/3cf79cfd-escaperoom`
**وضعیت کلی:** تمام ۱۰ موج تعریف‌شده در `DOCS/agents/AGENT-INFRA.md` و `DOCS/DOCUMENTATION.md` به‌صورت تک‌به‌تک در فایل‌های مستقل `DOCS/waves/cards/WAVE-1-INFRA.md` تا `DOCS/waves/cards/WAVE-10-INFRA.md` با رعایت کامل سه قانون سخت `AGENTS.md`، جداسازی کامل کلیدهای محرمانه (Zero-Secret Exposure) و تست‌های زنده روی محیط محلی (`SQLite`)، محیط پیش‌نمایش (`Vercel Preview`) و محیط عملیاتی (`Vercel Production` + `Supabase PostgreSQL`) تکمیل و پس از ادغام موج‌های ۱ تا ۱۰ توحید (`PR #60`) و موج ۵ امیرعلی (`PR #58`) روی Production مستقر و تأیید شد.

---

## خلاصه تحویل ۱۰ موج زیرساخت (`DOCS/agents/AGENT-INFRA.md`)

| موج | موضوع طبق `DOCS/agents/AGENT-INFRA.md` | شواهد، فایل‌ها و شناسه‌های عملیاتی | وضعیت |
| --- | --- | --- | --- |
| **موج ۱** | ممیزی محدودیت‌های بیلد، دیپلوی، باندل WebGL و تنظیمات محیطی | ثبت در `DOCS/waves/redesign/REDESIGN-WAVE-1.md` (PR #40 — `ca375fc`): بررسی `package.json`، `next.config.mjs` (`allowedDevOrigins: ['*.e2b.app']`)، `vercel.json` (`maxDuration: 60` + هدرهای SSE) و `.env.example` بدون تغییر ابری در فاز ممیزی | ✅ کامل |
| **موج ۲** | بررسی Runtime Preview، باندل کلاینت WebGL، پاسخ دارایی‌ها و Origin/Cache | دیپلوی Preview `dpl_kQYaCHXKijotMZRifboVkHxG5s9e` (`READY` / `STAGED` در ۴۲.۲ ثانیه) روی `escaperoom-orfeo-iaslbqy6g-tnix138.vercel.app`؛ بررسی بیلد ۱۵ مسیر (`First Load JS` پایه `103 kB` و `/room/[code]` برابر `139 kB`) | ✅ کامل |
| **موج ۳** | ماتریس مرورگر/موبایل، سیاست ورودی/بوم (Canvas/Pointer Lock) و هدرها | تأیید سیاست ورودی در `/preview/alley` و `/room/[code]`: Pointer Lock دسکتاپ + جایگزین Drag ماوس، کلیدهای `W/A/S/D`، `Shift`، `E`، `Esc`، `H` و راهنمای لمس/کیبورد (`ControlsHelpOverlay` موج ۳ امیرعلی در PR #39 و PR #44) + Fallback فارسی WebGL | ✅ کامل |
| **موج ۴** | ممیزی دارایی‌های کوچه (حجم، MIME/Cache/CORS و متادیتای لایسنس) | تأیید صفر بودن فایل‌های باینری حجیم (`.glb`/`.gltf`/تکسچر/صوت خام) در مخزن؛ هندسه کاملاً رویه‌ای کوچه (`src/engine3d/alley-scene.ts`) با `three@^0.186.1` (MIT) و فونت `@fontsource-variable/vazirmatn@^5.3.0` (OFL) | ✅ کامل |
| **موج ۵** | پیش‌نمایش و Smoke Test جریان یکپارچه رزرو، دعوت‌نامه و ورود به اتاق با محیط ایزوله | اجرای تست سرتاسری با `STORAGE_DRIVER=sqlite` (جدا از کلیدهای Production): `POST /api/rooms` (اتاق ۳ نفره)، `GET /invite/[code]/[seatToken]` (`200 OK`)، `GET /api/rooms/[code]` و `COMPLETE_INVITATION_VIDEO` برای هر ۳ صندلی | ✅ کامل |
| **موج ۶** | اعتبارسنجی API/معمای حلقوی و وضعیت مایگریشن Supabase | تطابق کامل `supabase/migrations/001_initial_schema.sql` با مایگریشن فعال `20261021124510` (`initial_schema_rooms`) در پروژه `yavwoaqxhptzufmjckwz`؛ تأیید شاخص‌های `rooms_pkey`، `rooms_phase_idx`، `rooms_updated_at_idx` و کنترل هم‌زمانی خوش‌بینانه (`version` / OCC) | ✅ کامل |
| **موج ۷** | ممیزی دارایی‌های تئاتر ۲۰ نفره و سالن تاریک (حجم، کش، نام‌گذاری Immutable و امنیت) | بررسی `src/engine3d/auditorium-scene.ts` و `src/components/cinema/DarkenedAuditoriumScene.tsx`: هندسه و صدای رویه‌ای (Web Audio API)، باندل‌های استاتیک هَش‌شدهٔ Next.js (`/_next/static/chunks/*`) با کش Immutable و بدون نیاز به Object Store خارجی | ✅ کامل |
| **موج ۸** | تست کات‌سین، استریم SSE، هدرهای بدون بافر، مهلت اجرا و قفل سرور | تأیید زندهٔ `GET /api/rooms/[code]/stream?token=...`: وضعیت `200 OK`، هدرهای `Content-Type: text/event-stream; charset=utf-8`، `Cache-Control: no-cache, no-transform`، `X-Accel-Buffering: no`، رویداد اولیه `event: room_update`، `maxDuration: 60` در `vercel.json` و قفل `409 CUTSCENE_LOCKED` | ✅ کامل |
| **موج ۹** | بررسی ماندگاری (Persistence)، اکتشاف سالن تاریک، امنیت RLS و مسیر بازیابی | تأیید فعال بودن `relrowsecurity = true` با `public_policy_count = 0` روی `public.rooms` (دسترسی انحصاری سرور؛ بدون افشای کلید در کلاینت)؛ تأیید ماندگاری ۵ اتاق زنده از جمله اتاق `XUCWLD` در فاز `in_theater` با `version: 71` (`4870` بایت) | ✅ کامل |
| **موج ۱۰** | انتشار نهایی Production، Smoke Test زنده، برنامه Rollback و آرشیو لاگ‌ها | دیپلوی‌های Production `dpl_w6wdyEKqCrGJpasSK81vXgQy4seV` (PR #43) و `dpl_C7VNbP8N1zJCLMLuK3jzyUo1VZHJ` (پس از PR #44) روی `https://escaperoom-orfeo.vercel.app`؛ ثبت برنامه Rollback و آرشیو لاگ‌ها در `WORKLOG.md` | ✅ کامل |

---

## ۱. ماتریس مرورگر، دستگاه و سیاست ورودی/WebGL (موج ۲ و ۳)

| بستر هدف | وضعیت رندر سه‌بعدی | سیاست ورودی و کنترل | رفتار جایگزین (Fallback) |
| --- | --- | --- | --- |
| **دسکتاپ (Chrome / Edge / Firefox / Safari — Zoom 100%)** | `WebGL2` / `WebGL1` با `devicePixelRatio` محدودشده به حداکثر `2` و `powerPreference: 'high-performance'` | حرکت واقعی `W/A/S/D` و کلیدهای جهت‌نما، دویدن با `Shift`، تعامل با `E`، راهنما با `H`، چرخش دید با Pointer Lock یا Drag ماوس | در صورت رد شدن Pointer Lock، چرخش با Drag ماوس و کلیدهای `←` / `→` بدون خطا فعال می‌ماند |
| **موبایل و تبلت (نمایشگرهای لمسی)** | رندر بوم سه‌بعدی واکنش‌گرا + چیدمان ستونی پنل بلیط/کوپن در عرض‌های باریک | راهنمای لمس در `ControlsHelpOverlay` (`DOCS/waves/redesign/REDESIGN-WAVE-3.md`)، دکمه‌های تعاملی حداقل `44px` و قابلیت جابه‌جایی به نمای کلاسیک | دکمه تغییر حالت به «🎨 نمای کلاسیک CSS» در نوار بالای صحنه همیشه در دسترس است |
| **مرورگر بدون WebGL یا Context Loss** | تشخیص خودکار با `detectWebGLSupport()` و مدیریت `webglcontextlost` / `webglcontextrestored` | نمایش پیام راهنمای فارسی در `WebGLErrorBoundary` بدون کرش صفحه | سوئیچ خودکار/دستی به نمای کلاسیک CSS با حفظ کامل وضعیت معما و اتاق روی سرور |

---

## ۲. سیاست دارایی‌ها، باندل‌ها و لایسنس‌ها (موج ۴ و ۷)

1. **ممیزی فایل‌های مخزن:**
   - هیچ فایل مدل باینری (`.glb`، `.gltf`، `.obj`، `.fbx`)، تکسچر حجیم یا فایل صوتی خام (`.mp3`، `.wav`، `.ogg`) در مخزن Git وجود ندارد.
   - تمام هندسه‌های کوچه، سردر تئاتر، گیشه، دربان («سینیور مَتِئو»)، سالن ۲۰ نفره، ۳ سِن، لوستر کریستالی و شخصیت‌های بزرگسال (با تناسبات واقعی ۱.۷۲m و ۱.۹۵m) به‌صورت کاملاً رویه‌ای (`Procedural Three.js Geometry & Materials`) در `src/engine3d/**` تولید می‌شوند.
   - تمام قطعات صوتی و افکت‌های فضایی به‌صورت رویه‌ای با `Web Audio API` در `src/audio/theater-audio-engine.ts` تولید می‌شوند.
2. **فهرست لایسنس وابستگی‌های زمان اجرا:**
   - `next@^15.5.28` و `react@^19.1.0`: لایسنس **MIT**
   - `three@^0.186.1` و `@types/three@^0.186.0`: لایسنس **MIT**
   - `@fontsource-variable/vazirmatn@^5.3.0`: لایسنس **SIL Open Font License 1.1 (OFL)**
   - `zod@^3.24.0`: لایسنس **MIT**
3. **اندازه باندل‌های تولیدی (Next.js 15 Production Build):**
   - باندل مشترک پایه (`First Load JS shared by all`): `103 kB`
   - مسیر `/` (تالار رزرو): `3.4 kB` (`106 kB` First Load JS)
   - مسیر `/invite/[code]/[seatToken]`: `1.88 kB` (`107 kB` First Load JS)
   - مسیر `/room/[code]` (اتاق کامل سه‌بعدی + SSE + معما): `2.3 kB` (`139 kB` First Load JS)
   - مسیر `/preview/alley`: `3.37 kB` (`114 kB` First Load JS)
   - مسیر `/preview/cinema`: `3.66 kB` (`128 kB` First Load JS)
   - مسیر `/preview/auditorium`: `3.67 kB` (`121 kB` First Load JS)
   - مسیر `/preview/performance`: `3.24 kB` (`110 kB` First Load JS)

---

## ۳. وضعیت دیتابیس ابری، امنیت و مسیر بازیابی (موج ۶ و ۹)

- **پروژه Supabase:** `escaperoom-orfeo` (شناسه مرجع: `yavwoaqxhptzufmjckwz`، منطقه `eu-central-1`، موتور PostgreSQL `17.11.0.003`)
- **وضعیت سلامت سرویس‌ها (`get_project_health`):**
  - `db`: `ACTIVE_HEALTHY`
  - `rest`: `ACTIVE_HEALTHY`
  - `auth` (`GoTrue v2.197.0`): `ACTIVE_HEALTHY`
  - `realtime`: `ACTIVE_HEALTHY`
  - `pooler`: `ACTIVE_HEALTHY`
- **ممیزی اسکیما و امنیت (`public.rooms`):**
  - مایگریشن فعال: `20261021124510` (`initial_schema_rooms`) منطبق با `supabase/migrations/001_initial_schema.sql`.
  - شاخص‌ها: `rooms_pkey`، `rooms_phase_idx`، `rooms_updated_at_idx`.
  - امنیت سطح ردیف (RLS): `rls_enabled = true` و `public_policy_count = 0` (هیچ دسترسی مستقیم کلاینتی وجود ندارد؛ تمام تراکنش‌ها صرفاً از طریق سرور Next.js و متغیر محیطی رمزنگاری‌شده در Vercel انجام می‌شوند).
- **مسیر بازیابی و Rollback (Restore & Rollback Plan):**
  1. **لایه اپلیکیشن (Vercel):** دیپلوی قبلی کاملاً پایدار (`dpl_w6wdyEKqCrGJpasSK81vXgQy4seV` و پیش از آن `dpl_4c76AhbvtbXi4SAHf3cYFYTWMPre`) روی Vercel حفظ شده‌اند و در صورت بروز هرگونه خطای رگرسیون، در کمتر از چند ثانیه قابل بازگردانی (Instant Rollback / Alias Reassign) به دامنه `escaperoom-orfeo.vercel.app` هستند.
  2. **لایه دیتابیس (Supabase / SQLite):** از آنجا که در موج‌های ۱ تا ۱۰ بازطراحی سه‌بعدی هیچ تغییر مخربی در اسکیما (`public.rooms`) رخ نداده و قرارداد سرور (`ClientRoomView` و `InternalRoomState`) سازگار با عقب نگه داشته شده است (`DOCS/waves/cards/WAVE-2-TOHID.md`)، ریسک مایگریشن صفر (`Zero Schema Drift`) است. در صورت نیاز به بازنشانی محیط تست، فایل `supabase/migrations/001_initial_schema.sql` به‌صورت Idempotent (`create table if not exists` / `create index if not exists`) آمادهٔ اجراست.

---

## ۴. خلاصه استقرارهای ابری ثبت‌شده در این چرخه (موج ۲، ۵، ۸ و ۱۰)

| محیط | شناسه دیپلوی (Vercel) | کامیت مرجع (`main`) | وضعیت | دامنه / آدرس |
| --- | --- | --- | --- | --- |
| **Production (موج‌های سه‌بعدی + موج ۲/۳ رابط)** | `dpl_w6wdyEKqCrGJpasSK81vXgQy4seV` | `beaad6e` (پس از PR #41) | `READY` / `PROMOTED` (`32.5s`) | `https://escaperoom-orfeo.vercel.app` |
| **Preview / Staging (موج ۲، ۳، ۵ و ۸)** | `dpl_kQYaCHXKijotMZRifboVkHxG5s9e` | `23e66f4` (پس از PR #43) | `READY` / `STAGED` (`42.2s`) | `https://escaperoom-orfeo-iaslbqy6g-tnix138.vercel.app` |
| **Production (پس از PR #44 امیرعلی)** | `dpl_C7VNbP8N1zJCLMLuK3jzyUo1VZHJ` | `39e16a6` (پس از PR #44) | `READY` / `PROMOTED` (`32.2s`) | `https://escaperoom-orfeo.vercel.app` |
| **Production نهایی (پس از PR #46 و PR #47 توحید — موج ۳ و ۴ حضور SSE و پایداری Refresh)** | `dpl_BWq27G9267uGzCNKL7ENjLXH7sQ2` | `04e8928` / `31168df` | `READY` / `PROMOTED` (`28.3s`) | `https://escaperoom-orfeo.vercel.app` |
| **Preview / Staging (موج ۲ تا ۶ زیرساخت پس از PR #51)** | `dpl_Baehq1tTn1KPLrGwjaqrPJGMmUZ6` | `ddde895` | `READY` / `STAGED` (`33.7s`) | `https://escaperoom-orfeo-eem9jbg06-tnix138.vercel.app` |
| **Production نهایی (موج ۱۰ زیرساخت پس از PR #60 توحید و PR #58 امیرعلی)** | `dpl_AcVtEAPxUJs71pczn5chv4ycTzJ6` | `37e11ac` | `READY` / `PROMOTED` (`32.0s`) | `https://escaperoom-orfeo.vercel.app` |
| **Production (پس از PR #65 — موج ۶ و ۷ امیرعلی و قالب جدید Worklog)** | `dpl_CGJM9AoYPVbNPQ21yXoacXhQDTXf` | `fc166ee` | `READY` / `PROMOTED` (`45.8s`) | `https://escaperoom-orfeo.vercel.app` |
| **Production (پس از PR #68 — موج ۸ امیرعلی: زیرنویس، صدا و اعلان حرکت)** | `dpl_2HTchzK9wjGkaSKsLzuBXyupxDFL` | `44859b3` | `READY` / `PROMOTED` (`30.2s`) | `https://escaperoom-orfeo.vercel.app` |
| **Production (پس از PR #69 — موج ۹ امیرعلی: HUD کاوش سالن تاریک و تخته تیمی)** | `dpl_92YBE2abGq9ebZLzNcixLBzzchrc` | `b7dcb50` | `READY` / `PROMOTED` (`49.5s`) | `https://escaperoom-orfeo.vercel.app` |
| **Production نهایی تمام ۴ ایجنت (پس از PR #71 — موج ۱۰ نهایی امیرعلی: QA تجربه ۳۲۰px و زوم ۲۰۰٪)** | `dpl_DqNszUJSo1f9P9Qfva2stEMgofGh` | `21f6771` | `READY` / `PROMOTED` (`49.5s`) | `https://escaperoom-orfeo.vercel.app` |

