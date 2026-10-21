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
اگر main سبز بود ← deploy خودکار به Vercel (فقط توسط توحید)

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
فقط توحید می‌تواند deploy کند. فایل .github/workflows/deploy.yml:

yaml
name: Deploy

on:
  push:
    branches: ['main']

jobs:
  deploy:
    if: ${{ github.actor == 'tnix138' }}  # فقط توحید
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
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