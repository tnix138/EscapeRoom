🚀 **شاخه به `main` ادغام شد — تنها مسدودکنندهٔ باقی‌مانده، secretهای Vercel است**

PR #116 با CI سبز merge شد (کامیت ادغام `e4c027e`). حالا روی `main`:

- `.github/workflows/{ci,auto-merge,deploy,issue-sync}.yml` وجود دارند (قبلاً هیچ‌کدام روی `main` نبودند).
- کد فازهای ۰۲/۰۴/۰۷/۰۹/۱۰/۱۱/۱۲/۱۳/۱۴ روی `main` است.

**اولین اجرای Deploy روی `main`:** [run 39676125132](https://github.com/tnix138/EscapeRoom/actions/runs/39676125132) در همان گام «بررسی secretهای انتشار» متوقف شد:

```
❌ secret «VERCEL_TOKEN» تنظیم نشده است.
```

نتیجه: `deploy.yml` درست fail-fast می‌کند و هیچ انتشار نیمه‌کاره‌ای انجام نشد. برای بستن #88 فقط این‌ها لازم است (دسترسی ادمین/وریسل، خارج از دسترس ایجنت):

1. `VERCEL_TOKEN`، `VERCEL_ORG_ID` (`prj_…`/`team_…`)، `VERCEL_PROJECT_ID` در Secrets مخزن،
2. `PRODUCTION_URL` برای گام اسمک‌تست،
3. `ADMIN_USERNAME`، `ADMIN_PASSWORD_HASH` (`scrypt$…` از `npm run hash:admin`)، `ADMIN_SESSION_SECRET` در Environment «production» وریسل،
4. اجرای دوبارهٔ Deploy؛ پس از آن `node scripts/smoke-test.mjs` با `SMOKE_FULL_PATH=1` روی دامنه اجرا می‌شود.
