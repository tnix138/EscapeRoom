#!/usr/bin/env node
// scripts/auto-merge.mjs — merge خودکار شاخهٔ ایجنت به main بعد از CI سبز (فاز ۰۲ — توحید)
// منبع: docs/AUTO.md و docs/RULES.md قانون ۵
//
// ورودی از محیط (workflow):
//   MERGE_BRANCH   شاخهٔ سرشاخه‌ای که CI برایش اجرا شده (مثلاً agent/tohid/wave-03)
//   CI_CONCLUSION  نتیجهٔ CI: success | failure | cancelled | ...
//   BASE_BRANCH    پیش‌فرض main
//   DRY_RUN=1      فقط تصمیم را گزارش می‌دهد، merge نمی‌کند
//
// خروجی: یک خط JSON با پیشوند AUTO_MERGE_RESULT
// کدهای خروج: ۰ = merge شد یا طبق سیاست رد شد، ۱ = ورودی نامعتبر/خطای git، ۲ = تعارض merge
import { execFileSync } from 'node:child_process';

const ALLOWED_PREFIXES = ['agent/', 'arena/', 'phase/'];
const BASE_BRANCH = (process.env.BASE_BRANCH ?? 'main').trim();
const BRANCH = (process.env.MERGE_BRANCH ?? '').trim();
const CONCLUSION = (process.env.CI_CONCLUSION ?? '').trim();
const DRY_RUN = process.env.DRY_RUN === '1';

const GIT_IDENTITY = [
  '-c',
  'user.name=ایجنت اُرفه‌ئو',
  '-c',
  'user.email=agent@orfeo.local',
];

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function report(merged, reason, exitCode = 0) {
  console.log(
    `AUTO_MERGE_RESULT ${JSON.stringify({
      merged,
      reason,
      branch: BRANCH,
      base: BASE_BRANCH,
      dryRun: DRY_RUN,
    })}`,
  );
  process.exit(exitCode);
}

function main() {
  if (!BRANCH) report(false, 'نام شاخه در MERGE_BRANCH مشخص نیست.', 1);
  if (BRANCH === BASE_BRANCH) {
    report(false, 'شاخهٔ اصلی هیچ‌وقت به خودش merge نمی‌شود.');
  }
  if (!ALLOWED_PREFIXES.some((prefix) => BRANCH.startsWith(prefix))) {
    report(false, `شاخهٔ «${BRANCH}» در الگوی مجاز (agent/، arena/، phase/) نیست.`);
  }
  if (CONCLUSION !== 'success') {
    report(false, 'CI سبز نبود؛ merge انجام نشد.');
  }

  try {
    git(['fetch', 'origin', '--prune']);
  } catch {
    report(false, 'دریافت شاخه‌های origin ناموفق بود.', 1);
  }

  // اگر شاخه از قبل در main هست، کاری لازم نیست
  try {
    git(['merge-base', '--is-ancestor', `origin/${BRANCH}`, `origin/${BASE_BRANCH}`]);
    report(false, 'این شاخه از قبل در شاخهٔ اصلی ادغام شده است.');
  } catch {
    // هنوز ادغام نشده؛ ادامه بده
  }

  if (DRY_RUN) {
    report(false, `آمادهٔ merge است (اجرای آزمایشی): ${BRANCH} → ${BASE_BRANCH}`);
  }

  try {
    git([...GIT_IDENTITY, 'checkout', '-B', BASE_BRANCH, `origin/${BASE_BRANCH}`]);
  } catch {
    report(false, `checkout شاخهٔ ${BASE_BRANCH} ناموفق بود.`, 1);
  }

  const mergeMessage = `merge: ادغام خودکار ${BRANCH} پس از CI سبز`;
  try {
    git([
      ...GIT_IDENTITY,
      'merge',
      '--no-ff',
      '-m',
      mergeMessage,
      `origin/${BRANCH}`,
    ]);
  } catch {
    try {
      git(['merge', '--abort']);
    } catch {
      // merge در وضعیت conflict نیست
    }
    report(
      false,
      'تعارض merge: شاخهٔ اصلی سبز ماند. main را در شاخهٔ خودت pull کن و دوباره push کن.',
      2,
    );
  }

  try {
    git(['push', 'origin', `HEAD:${BASE_BRANCH}`]);
  } catch {
    report(false, 'push به شاخهٔ اصلی ناموفق بود (دسترسی نوشتن را بررسی کن).', 1);
  }

  report(true, `«${BRANCH}» با موفقیت به «${BASE_BRANCH}» ادغام شد.`);
}

main();
