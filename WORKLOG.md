# 📋 دفتر جامع ثبت فعالیت‌های تیم (Commit, PR & Infra Worklog)

> **قوانین الزامی پروژه:**
> 1. **ثبت لاگ برای هر تغییر کد:** هر یک از اعضای تیم (**توحید، امیرعلی، علیرضا و ایجنت چهارم زیرساخت**) به ازای **هر Commit** و **هر Pull Request (PR)** موظف است یک فایل گزارش لاگ شامل **نام شخص، تاریخ شمسی، ساعت انجام و توضیحات دقیق کار** ایجاد کرده و در این فایل فهرست نماید.
> 2. **ثبت لاگ برای عملیات‌های Vercel و Supabase:** از آنجا که **امیرعلی** و **علیرضا** فقط و فقط به ریپازیتوری GitHub دسترسی دارند، هرگونه نیاز به اقدام یا تغییر روی **Vercel** یا **Supabase** باید به شکل یک لاگ استاندارد با نوع `Infra-Supabase`، `Infra-Vercel` یا `Infra-FullDeploy` در بخش **`Pending`** ثبت شود تا **ایجنت چهارم زیرساخت (با مدیریت توحید — [`TASKS-INFRA-AGENT.md`](./TASKS-INFRA-AGENT.md))** آن را اجرا و به **`Archive`** منتقل کند.
>
> **دسته‌بندی وضعیت‌ها:**
> - **⏳ `Pending` (هنوز تأیید / اجرا نشده‌اند):** کامیت‌ها و PRهای منتظر تأیید نهایی + درخواست‌های عملیات Vercel/Supabase منتظر اجرای ایجنت چهارم (`logs/pending/`).
> - **✅ `Archive` (کامل و تأیید شده‌اند):** کامیت‌ها و PRهای تأیید/ادغام‌شده + عملیات‌های زیرساختی انجام‌شده توسط ایجنت چهارم (`logs/archive/`).

---

## ⏳ Pending (هنوز تأیید / اجرا نشده‌اند)

| شناسه لاگ | نام شخص | تاریخ شمسی | ساعت انجام | نوع فعالیت و مرجع | توضیحات کار انجام‌شده / عملیات درخواستی | فایل جزئیات |
|---|---|---|---|---|---|---|
| `1405-07-29_16-39-38_amirali_ui-waves-1-3` | **امیرعلی** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۳۹:۳۸ | `Commit` (شاخه `arena/dbd0f4f3-escaperoom` — موج‌های ۱ تا ۳) | پیاده‌سازی رابط رزرو ۳–۸ نفره، دعوت‌نامهٔ گرافیکی و درگاه بازیکن، کوچهٔ اول‌شخص، بلیط/کوپن، پانچ، قفل برنجی، نجوا و پیش‌نمایش محلی؛ اتصال به APIهای مشترک و افزودن ۶ تست امیرعلی. | [مشاهده فایل](./logs/pending/1405-07-29_16-39-38_amirali_ui-waves-1-3.md) |
| `1405-07-29_16-39-38_amirali_pr-ui-waves-1-3` | **امیرعلی** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۳۹:۳۸ | `PR` (شاخه `arena/dbd0f4f3-escaperoom` ➔ `main`) | درخواست بررسی و ادغام رابط امیرعلی برای موج‌های ۱ تا ۳؛ شمارهٔ PR پس از ایجاد ثبت می‌شود. | [مشاهده فایل](./logs/pending/1405-07-29_16-39-38_amirali_pr-ui-waves-1-3.md) |
| `1405-07-29_16-32-30_infra-agent_wave4-tohid-final-deploy-and-alireza-preview` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۳۲:۳۰ | `Infra-FullDeploy` (شاخه `arena/b6d06c28-escaperoom`) | استقرار Production جدید پس از PR #11 توحید (`dpl_F4ddK4xRwvE8FR4cedNAuwVhmSh2` از `f354b65` با ۳۹ تست پاس) + استقرار Preview شاخه علیرضا (`dpl_7bnxrUqTxnVrWFQCHLXcUoD7t1Ca` از `arena/f2303553-escaperoom`) + تست سلامت `/api/health` و آرشیو لاگ‌های PR #10 و PR #11. | [مشاهده فایل](./logs/pending/1405-07-29_16-32-30_infra-agent_wave4-tohid-final-deploy-and-alireza-preview.md) |

---

## ✅ Archive (کامل و تأیید شده‌اند)

| شناسه لاگ | نام شخص | تاریخ شمسی | ساعت انجام | نوع فعالیت و مرجع | توضیحات کار انجام‌شده | فایل جزئیات |
|---|---|---|---|---|---|---|
| `1405-07-29_16-30-24_tohid_pr-11_contract-conformance` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۳۰:۲۴ | `PR` (`PR #11` — `arena/045041ba-escaperoom` ➔ `main`) | ایجاد و ادغام PR شماره #11 برای تحویل نهایی توحید (تست انطباق ۱۰۰٪ با `API-CONTRACT.md`، مجموع ۳۹ تست پاس و تیک کامل چک‌لیست `TASKS-TOHID.md`). | [مشاهده فایل](./logs/archive/1405-07-29_16-30-24_tohid_pr-11_contract-conformance.md) |
| `1405-07-29_16-29-51_tohid_contract-conformance-and-dod` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۲۹:۵۱ | `Commit` (شاخه `arena/045041ba-escaperoom`) | بستن تحویل نهایی توحید: افزودن `tests/tohid/contract-conformance.test.ts` (۷ تست انطباق کامل با قرارداد برای امیرعلی و علیرضا؛ مجموع ۳۹ تست پاس) و تکمیل چک‌لیست `TASKS-TOHID.md`. | [مشاهده فایل](./logs/archive/1405-07-29_16-29-51_tohid_contract-conformance-and-dod.md) |
| `1405-07-29_16-24-53_infra-agent_pr-10_wave3-fulldeploy` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۲۴:۵۳ | `PR` (`PR #10` — `arena/c9528bce-escaperoom` ➔ `main`) | ادغام PR شماره #10 برای تحویل موج ۳ ایجنت چهارم زیرساخت (تأیید FullDeploy و آرشیو لاگ‌های ادغام‌شده). | [مشاهده فایل](./logs/archive/1405-07-29_16-24-53_infra-agent_pr-10_wave3-fulldeploy.md) |
| `1405-07-29_16-24-00_infra-agent_wave3-fulldeploy-and-archive` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۲۴:۰۰ | `Infra-FullDeploy` (شاخه `arena/c9528bce-escaperoom`) | استقرار مجدد Production از آخرین `main` (`dpl_4jfxZBLatr4Q9gwfTqZAAg3cmUps` با تنظیمات `vercel.json` و سخت‌سازی موج ۲ توحید)، تست سلامت آنلاین `https://escaperoom-orfeo.vercel.app/api/health` و انتقال تمامی لاگ‌های ادغام‌شده از `Pending` به `Archive`. | [مشاهده فایل](./logs/archive/1405-07-29_16-24-00_infra-agent_wave3-fulldeploy-and-archive.md) |
| `1405-07-29_16-21-15_infra-agent_pr-9_wave2-vercel` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۲۱:۱۵ | `PR` (`PR #9` — `arena/c9528bce-escaperoom` ➔ `main`) | ادغام PR شماره #9 برای تحویل موج ۲ ایجنت چهارم زیرساخت (`vercel.json`، استقرار Production روی Vercel و تست سلامت `/api/health`). | [مشاهده فایل](./logs/archive/1405-07-29_16-21-15_infra-agent_pr-9_wave2-vercel.md) |
| `1405-07-29_16-20-30_infra-agent_wave2-vercel-config-and-deploy` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۲۰:۳۰ | `Infra-Vercel` (شاخه `arena/c9528bce-escaperoom`) | ایجاد پروژه Vercel (`escaperoom-orfeo` — `prj_HD4C8ADfEmbBJtIFToqu7GuxyOtI`)، افزودن `vercel.json` با تنظیمات استریم SSE و توابع سرور، اجرای دیپلوی Production (`dpl_5sfQnbAujrEaDsquEr93BjERSw54`) و تأیید `/api/health` با `storageDriver: "supabase"` روی `https://escaperoom-orfeo.vercel.app`. | [مشاهده فایل](./logs/archive/1405-07-29_16-20-30_infra-agent_wave2-vercel-config-and-deploy.md) |
| `1405-07-29_16-20-09_tohid_pr-8_wave2-hardening` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۲۰:۰۹ | `PR` (`PR #8` — `arena/d4e4b986-escaperoom` ➔ `main`) | ایجاد و ادغام PR شماره #8 برای تحویل تکمیل و سخت‌سازی موج ۲ توحید (پانچ همزمان ۸ نفره و ماندگاری گذار فاز). | [مشاهده فایل](./logs/archive/1405-07-29_16-20-09_tohid_pr-8_wave2-hardening.md) |
| `1405-07-29_16-19-40_tohid_wave2-hardening-concurrent-punch` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۱۹:۴۰ | `Commit` (شاخه `arena/d4e4b986-escaperoom`) | تکمیل و سخت‌سازی موج ۲: رفع گم شدن پانچ همزمان ۸ نفره با افزایش سقف OCC به ۱۶، ماندگاری گذار فاز هنگام رد اکشن در کات‌سین و افزودن ۴ تست جدید (مجموع ۳۲ تست پاس). | [مشاهده فایل](./logs/archive/1405-07-29_16-19-40_tohid_wave2-hardening-concurrent-punch.md) |
| `1405-07-29_16-19-00_infra-agent_pr-7_wave1-supabase` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۱۹:۰۰ | `PR` (`PR #7` — `arena/c9528bce-escaperoom` ➔ `main`) | ادغام PR شماره #7 برای تحویل موج ۱ ایجنت چهارم زیرساخت (마이گریشن Supabase، متغیرهای رمزنگاری‌شده Vercel و آرشیو لاگ زیرساخت توحید). | [مشاهده فایل](./logs/archive/1405-07-29_16-19-00_infra-agent_pr-7_wave1-supabase.md) |
| `1405-07-29_16-18-30_infra-agent_wave1-supabase-migration-001` | **ایجنت چهارم زیرساخت (به مدیریت توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۱۸:۳۰ | `Infra-Supabase` (شاخه `arena/c9528bce-escaperoom`) | راه‌اندازی پروژه Supabase (`escaperoom-orfeo` — `yavwoaqxhptzufmjckwz`)، اجرای مایگریشن `001_initial_schema.sql`، تست سلامت جدول `public.rooms` و RLS، ثبت رمزنگاری‌شده کلیدها در Vercel و آرشیو درخواست زیرساخت توحید. | [مشاهده فایل](./logs/archive/1405-07-29_16-18-30_infra-agent_wave1-supabase-migration-001.md) |
| `1405-07-29_15-59-27_tohid_infra-supabase-migration-001` | **توحید (اجرا: ایجنت چهارم زیرساخت)** | ۱۴۰۵/۰۷/۲۹ | ۱۵:۵۹:۲۷ | `Infra-Supabase` (شاخه `arena/32c2d8dd-escaperoom` ➔ `arena/c9528bce-escaperoom`) | تکمیل درخواست زیرساخت توحید توسط ایجنت چهارم: اجرای `supabase/migrations/001_initial_schema.sql` روی پروژه `escaperoom-orfeo` (`yavwoaqxhptzufmjckwz`)، تست سلامت جدول `public.rooms` و ثبت امن متغیرهای محیطی در Vercel. | [مشاهده فایل](./logs/archive/1405-07-29_15-59-27_tohid_infra-supabase-migration-001.md) |
| `1405-07-29_16-07-25_tohid_archive-wave1-3-logs` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۰۷:۲۵ | `Commit` (شاخه `arena/32c2d8dd-escaperoom` — `PR #6`) | انتقال ۶ لاگ مرج‌شده موج‌های ۱ تا ۳ توحید (PRهای #3 و #4 و #5) از `Pending` به `Archive`؛ لاگ Infra-Supabase برای ایجنت چهارم در Pending ماند. | [مشاهده فایل](./logs/archive/1405-07-29_16-07-25_tohid_archive-wave1-3-logs.md) |
| `1405-07-29_15-59-27_tohid_wave1-backend-foundation` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۵:۵۹:۲۷ | `Commit` (شاخه `arena/32c2d8dd-escaperoom`) | اجرای موج ۱ توحید: اسکافولد Next.js + قرارداد منجمد، `createPreviewRoomState` برای امیرعلی/علیرضا، دیتابیس دوگانه SQLite/Supabase با OCC، توکن SHA-256، `POST /api/rooms` رزرو ۳–۸ نفره با لینک دعوت نام‌دار، `GET /api/health` و ۱۴ تست پاس. | [مشاهده فایل](./logs/archive/1405-07-29_15-59-27_tohid_wave1-backend-foundation.md) |
| `1405-07-29_16-01-22_tohid_pr-3_wave1-backend-foundation` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۰۱:۲۲ | `PR` (`PR #3` — `arena/32c2d8dd-escaperoom` ➔ `main`) | ایجاد PR شماره #3 برای تحویل موج ۱ توحید (بک‌اند، دیتابیس دوگانه، رزرو ۳–۸ نفره و فیكسچر پیش‌نمایش) جهت بررسی و ادغام در `main`. | [مشاهده فایل](./logs/archive/1405-07-29_16-01-22_tohid_pr-3_wave1-backend-foundation.md) |
| `1405-07-29_16-04-03_tohid_wave2-cyclic-puzzle-engine` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۰۴:۰۳ | `Commit` (شاخه `arena/32c2d8dd-escaperoom`) | اجرای موج ۲ توحید: موتور کامل معمای حلقوی ۳–۸ نفره، اکشن‌های پانچ/قفل در با Rate-Limit، اندپوینت‌های GET/Action/Chat، قفل `CUTSCENE_LOCKED` و ۲۴ تست پاس. | [مشاهده فایل](./logs/archive/1405-07-29_16-04-03_tohid_wave2-cyclic-puzzle-engine.md) |
| `1405-07-29_16-04-23_tohid_pr-4_wave2-cyclic-puzzle` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۰۴:۲۳ | `PR` (`PR #4` — `arena/32c2d8dd-escaperoom` ➔ `main`) | ایجاد PR شماره #4 برای تحویل موج ۲ توحید (موتور معمای حلقوی، اکشن‌ها و قفل کات‌سین) جهت بررسی و ادغام در `main`. | [مشاهده فایل](./logs/archive/1405-07-29_16-04-23_tohid_pr-4_wave2-cyclic-puzzle.md) |
| `1405-07-29_16-06-37_tohid_wave3-sse-sync` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۰۶:۳۷ | `Commit` (شاخه `arena/32c2d8dd-escaperoom`) | اجرای موج ۳ توحید: استریم SSE بلادرنگ، heartbeat ساعت سرور، هوک کامل `useTheaterSession` با همگام‌سازی ۶۰fps کات‌سین و ۲۸ تست پاس. | [مشاهده فایل](./logs/archive/1405-07-29_16-06-37_tohid_wave3-sse-sync.md) |
| `1405-07-29_16-06-58_tohid_pr-5_wave3-sse-sync` | **توحید** | ۱۴۰۵/۰۷/۲۹ | ۱۶:۰۶:۵۸ | `PR` (`PR #5` — `arena/32c2d8dd-escaperoom` ➔ `main`) | ایجاد PR شماره #5 برای تحویل موج ۳ توحید (SSE بلادرنگ و همگام‌سازی کات‌سین) جهت بررسی و ادغام در `main`. | [مشاهده فایل](./logs/archive/1405-07-29_16-06-58_tohid_pr-5_wave3-sse-sync.md) |
| `1405-07-29_15-47-00_pr-2_theater-docs-and-4-agents` | **معمار تیم (توحید / امیرعلی / علیرضا)** | ۱۴۰۵/۰۷/۲۹ | ۱۵:۴۷:۰۰ | `PR` (`PR #2` — `arena/1d5c8b17-escaperoom` ➔ `main`) | ایجاد Pull Request شماره `#2` برای تحویل نهایی مستندات سناریوی جدید تماشاخانه اُرفه‌ئو، تقسیم کار موازی **توحید، امیرعلی و علیرضا**، پروتکل **ایجنت چهارم زیرساخت (`Supabase` + `Vercel`)** و سیستم لاگ شمسی `Pending`/`Archive`. | [مشاهده فایل](./logs/archive/1405-07-29_15-47-00_pr-2_theater-docs-and-4-agents.md) |
| `1405-07-29_15-43-00_commit_infra-agent-and-github-isolation` | **معمار تیم (به سفارش توحید)** | ۱۴۰۵/۰۷/۲۹ | ۱۵:۴۳:۰۰ | `Commit` (`e49c875`) | افزودن معماری دسترسی فقط-گیت‌هاب برای **امیرعلی** و **علیرضا** + تعریف کامل و خودکفای **ایجنت چهارم زیرساخت (`TASKS-INFRA-AGENT.md`) با مدیریت توحید** برای پردازش لاگ‌های `Vercel` و `Supabase` از صف `Pending` و انتقال به `Archive`. | [مشاهده فایل](./logs/archive/1405-07-29_15-43-00_commit_infra-agent-and-github-isolation.md) |
| `1405-07-29_15-38-00_commit_theater-docs-team-split` | **معمار تیم (توحید / امیرعلی / علیرضا)** | ۱۴۰۵/۰۷/۲۹ | ۱۵:۳۸:۰۰ | `Commit` (`6bf6f38`) | حذف کامل سناریوی قبلی و بازنویسی کامل مستندات برای سناریوی فصل اول **«پرده سرخ: تماشاخانه اُرفه‌ئو»** (۳ تا ۸ نفر، لینک نام‌دار، ویدیوی کارت دعوت، معمای بلیط‌ها، کات‌سین کامل `POV` سالن ۲۰ نفره و شروع مجدد داخل سالن تاریک) + تقسیم کار موازی بدون بیکاری بین **توحید، امیرعلی و علیرضا** در ۳ موج همگام + راه‌اندازی سیستم لاگ شمسی `Pending`/`Archive`. | [مشاهده فایل](./logs/archive/1405-07-29_15-38-00_commit_theater-docs-team-split.md) |
| `1405-07-29_15-02-12_pr-1_initial-docs` | **معمار مستندات تیم** | ۱۴۰۵/۰۷/۲۹ | ۱۵:۰۲:۱۲ | `Commit & PR` (`f59c495` / `PR #1` -> `abd4b2d`) | طراحی نسخه اولیه ساختار مستندات مرحله ۱، معماری دیتابیس دوگانه و چارچوب تقسیم وظایف تیمی و ادغام PR شماره `#1` در `main`. | [مشاهده فایل](./logs/archive/1405-07-29_15-02-12_pr-1_initial-docs.md) |

---

## 📐 قالب استاندارد ثبت لاگ جدید (کد / PR / درخواست زیرساخت Vercel و Supabase)

هنگام زدن هر `Commit`، ساخت هر `PR`، یا ثبت درخواست عملیات روی `Vercel` / `Supabase`، یک فایل در مسیر `logs/pending/<YYYY-MM-DD>_<HH-MM-SS>_<author>_<topic>.md` با قالب زیر بسازید و ردیف آن را به جدول **Pending** بالا اضافه کنید:

```markdown
# گزارش فعالیت تیمی — <شناسه-فایل>

- **نام شخص:** <توحید | امیرعلی | علیرضا | ایجنت چهارم زیرساخت — توحید>
- **تاریخ شمسی:** <مثلاً ۱۴۰۵/۰۷/۲۹>
- **ساعت انجام:** <مثلاً ۱۶:۲۰:۰۰>
- **نوع فعالیت:** <Commit | PR | Infra-Supabase | Infra-Vercel | Infra-FullDeploy>
- **شناسه مرجع (Commit / PR):** <کد کوتاه کامیت، شاخه یا شماره PR>
- **وضعیت:** Pending (هنوز تأیید / اجرا نشده)
- **زمان دقیق سیستمی:** <ISO Timestamp>

### شرح دقیق فعالیت انجام‌شده / عملیات درخواستی
<شرح دقیق بخش ساخته‌شده یا دستورالعمل دقیق موردنیاز روی Vercel / Supabase>
```
