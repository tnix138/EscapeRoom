# 🤖 اتوماسیون CI/CD

> این فایل قوانین push، CI و merge را تعریف می‌کند.

## جریان کار
ایجنت کد می‌نویسد
↓
git push به شاخهٔ خودش (مثلاً agent/tohid/wave-03)
↓
GitHub Actions اجرا می‌شود:

npm run typecheck

npm test

npm run lint
↓
اگر همه سبز بود ← merge خودکار به main
↓
اگر main سبز بود ← deploy خودکار به Vercel (اتصال Git؛ شاخهٔ production برابر main)

text

## شاخه‌ها

| شاخه | مالک | توضیح |
|---|---|---|
| `main` | — | شاخهٔ اصلی. فقط merge خودکار از ایجنت‌ها. |
| `agent/tohid/*` | توحید | شاخهٔ ایجنت توحید |
| `agent/alireza/*` | علیرضا | شاخهٔ ایجنت علیرضا |
| `agent/amirali/*` | امیرعلی | شاخهٔ ایجنت امیرعلی |
| `agent/amir/*` | امیر | شاخهٔ ایجنت امیر |
| `agent/nazanin/*` | نازنین | شاخهٔ ایجنت نازنین |

**هیچ ایجنتی مستقیم به `main` push نمی‌کند.** فقط از طریق شاخهٔ خودش.

## CI (GitHub Actions)

فایل `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: ['agent/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run lint
Merge خودکار
فایل .github/workflows/auto-merge.yml:

yaml
name: Auto-merge

on:
  workflow_run:
    workflows: ['CI']
    types: [completed]

jobs:
  merge:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          git fetch origin
          git checkout main
          git merge --no-ff origin/${{ github.event.workflow_run.head_branch }}
          git push origin main
Deploy خودکار
پروژهٔ Vercel (escaperoom-orfeo) با اتصال Git به همین ریپو وصل است و شاخهٔ production آن main است؛ هر merge روی main به‌صورت خودکار بیلد و روی production منتشر می‌شود و push به شاخه‌های ایجنت‌ها Preview می‌سازد. اتصال و تنظیمات Vercel فقط دست توحید است.

فایل .github/workflows/deploy.yml فقط مسیر دستیِ پشتیبان است (workflow_dispatch، فقط با اجرای tnix138) و trigger خودکار ندارد تا دیپلوی دوبل ساخته نشود؛ برای استفاده از آن باید secretهای VERCEL_TOKEN و VERCEL_ORG_ID و VERCEL_PROJECT_ID در گیت‌هاب تنظیم شده باشند.
اگر CI قرمز شد
ایجنت نباید merge را مجبور کند. باید:

خطا را بخواند.

کد را اصلاح کند.

دوباره push کند.

اگر تعارض merge شد
اگر دو ایجنت هم‌زمان به main merge کنند و تعارض ایجاد شود:

main سبز می‌ماند (merge خودکار رد می‌شود).

ایجنت دوم باید main را در شاخهٔ خودش pull کند، تعارض را حل کند، دوباره push کند.

اگر deploy شکست خورد
توحید مسئول است. باید:

لاگ Vercel را بخواند.

به ایجنت مسئول فاز پیام دهد.

منتظر اصلاح بماند.

دوباره deploy کند.