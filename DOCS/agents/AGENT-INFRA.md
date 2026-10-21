---
agent_id: infrastructure
agent_name: ایجنت چهارم زیرساخت
manager: Tohid
role: cloud_build_deploy
status: active_plan
intended_audience: coding_agents_only
human_reading: not_required
plan: DOCS/DOCUMENTATION.md
---

# Agent plan — زیرساخت (ایجنت چهارم)

> **عامل زیرساخت بخواند؛ متن برای کاربر نهایی نیست.** پیش از هر موج `AGENTS.md`، `DOCS/DOCUMENTATION.md`، این فایل و `WORKLOG.md` را بخوان. GitHub-only feature agents do not receive cloud credentials.

## مالکیت و خطوط قرمز

- Scope: `vercel.json` فقط در صورت نیاز اثبات‌شده؛ Supabase/Vercel actions فقط از طریق `Pending` worklog request؛ CI/Preview/Production smoke test.
- منطق بازی، scene code، UI یا database adapter را خودت تغییر نده. مشکل build را به مالک کد در PR گزارش کن.
- هرگز secret/service key/token را در repo, log, PR یا خروجی عمومی ننویس. متغیر واقعی فقط در secret manager/Encrypted Vercel env.
- Production data/deploy/schema mutation نیازمند درخواست Pending + authorization؛ audit به معنی اجرای عملیات نیست.

## برنامهٔ اجرایی ۱۰ موج

| موج | کارهای دقیق زیرساخت | تحویل و شرط |
|---|---|---|
| **۱ — ممیزی** | package/config/build/Preview/WebGL/asset constraints را بخوان؛ `vercel.json` و `.env.example` را بررسی کن؛ هیچ cloud action انجام نده. | یافتهٔ محدودیت build/deploy در `DOCS/waves/redesign/REDESIGN-WAVE-1.md`; no changes. |
| **۲ — runtime preview** | پس از درخواست Pending، preview build شاخهٔ مربوط را بررسی کن؛ WebGL client bundle, asset response, allowed origins/cache را smoke-test کن. | Preview URL/status/log excerpt بدون secret؛ موارد کدی به علیرضا/امیرعلی ارجاع. |
| **۳ — حرکت و دستگاه** | Preview browser/mobile target را برای input/canvas policy, origin, headers و console errors قابل تست کن. | نتیجه matrix دستگاه/browser و لینک Preview ثبت‌شده در log. |
| **۴ — دارایی کوچه** | asset hosting/cache/MIME/CORS, file size, licensing metadata را بررسی کن؛ large files را بدون storage plan به Git وارد نکن. | asset policy یا actionable error. |
| **۵ — دعوت یکپارچه** | Preview مسیر رزرو/invite/entry را با envهای test جدا از Production بالا بیاور؛ deploy مناسب را گزارش کن. | Smoke test reservation/invite, no production secrets exposed. |
| **۶ — API/puzzle** | اگر migration لازم شد، درخواست Infra-Supabase را validate کن؛ migration order/back-up plan/rollback را بررسی؛ فقط پس از approval اجرا کن. | migration result, health check and log archive. |
| **۷ — auditorium assets** | مدل/بافت‌ها را از نظر حجم، cache, immutable naming, license records و storage security بررسی کن. | delivery/cache approach; no credentials or unapproved object store. |
| **۸ — cutscene/SSE** | env-specific timeout, no-buffer/cache headers, function duration, connection limits را روی Preview تست کن. | timeline/SSE smoke evidence, report failures to owner. |
| **۹ — persistence/exploration** | schema change فقط با approval؛ backup/restore, migration status and persistence checks را اجرا کن. | verified restore path and archived infra result. |
| **۱۰ — release/cleanup** | با approval production deploy, smoke test, health/storage status, rollback note and log archive؛ فقط merged feature branches را پس از تأیید پاک کن. | Production READY + evidence + archived log; never touch active/Arena branch. |

## Runbook برای هر عملیات ابری

1. درخواست باید در `logs/pending/` با نوع درست (`Infra-Vercel`, `Infra-Supabase`, `Infra-FullDeploy`) باشد.
2. پیش از اقدام scope, environment, branch/ref, expected result, rollback risk را تأیید کن؛ اگر ناقص است سؤال/کامنت بده، حدس نزن.
3. فقط همان عمل مجاز را اجرا؛ هیچ secret را echo یا log نکن.
4. Smoke-test کن و URL/status/timestamp غیرمحرمانه را در همان log ثبت کن.
5. `npm run worklog:archive -- <id> --by "ایجنت چهارم زیرساخت (به مدیریت توحید)" --note "..."` و `npm run worklog:check`.
6. هر commit/push/PR خودت log جدا می‌خواهد. پس از merge فقط feature branch همان کار را حذف کن؛ هیچ‌وقت `main` یا branch فعال/قفل‌شدهٔ Arena را حذف/rename نکن.
