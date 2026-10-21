#!/usr/bin/env node
// scripts/lint.mjs — لینتر پروژهٔ تماشاخانه اُرفه‌ئو (فاز ۰۲ — توحید)
//
// چرا لینتر بدون وابستگی؟ مستند docs/checklists/before-merge.md چند قاعدهٔ مشخص
// می‌خواهد (بدون console.log اضافی، بدون TODO/FIXME رهاشده) و CI هم باید سریع بماند.
// این اسکریپت همان قاعده‌ها را به‌همراه چند محافظ پروژه‌ای اجرا می‌کند و هیچ
// وابستگی بیرونی ندارد، پس روی هر runner و هر ماشینی بدون نصب اجرا می‌شود.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// LINT_ROOT برای تست خودِ لینتر روی یک درخت موقت
const ROOT = process.env.LINT_ROOT ?? process.cwd();

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'out',
  'dist',
  'coverage',
  '.data',
  'test-results',
  'playwright-report',
]);

const SOURCE_DIRS = ['src', 'scripts', 'tests'];
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

// خودِ لینتر الگوهایش را به‌صورت متن نگه می‌دارد؛ اسکن آن خودش را false-positive می‌کند.
const SELF_FILE = 'scripts/lint.mjs';

/**
 * قاعده‌ها: هر کدام یک شناسه، توضیح فارسی، محدودهٔ اعمال و منبع اسکن.
 * scan: 'code' یعنی روی کدِ بدون رشته و کامنت (تا نام تابع یا متن تست false-positive نشود)
 *       'raw'  یعنی روی خط خام (برای پیدا کردن TODO/FIXME رهاشده در کامنت‌ها)
 */
const RULES = [
  {
    id: 'no-console-log',
    message: 'console.log اضافی؛ از console.error/warn استفاده کن یا حذفش کن (قرارداد لاگ فارسی).',
    appliesTo: (relative) => relative.startsWith('src/'),
    scan: 'code',
    pattern: /(^|[^.\w])console\.log\s*\(/,
  },
  {
    id: 'no-debugger',
    message: 'debugger در کد مانده است؛ قبل از push حذفش کن.',
    appliesTo: () => true,
    scan: 'code',
    pattern: /(^|[^.\w])debugger\s*(;|$)/,
  },
  {
    id: 'no-todo',
    message: 'TODO/FIXME رهاشده بدون کامیت؛ یا حلش کن یا در فاز مستندش کن.',
    appliesTo: (relative) => relative.startsWith('src/'),
    scan: 'raw',
    pattern: /\b(TODO|FIXME)\b/,
  },
  {
    id: 'no-explicit-any',
    message: 'نوع any صریح؛ از unknown یا تایپ دقیق استفاده کن.',
    appliesTo: (relative) => relative.startsWith('src/') && /\.tsx?$/.test(relative),
    scan: 'code',
    pattern: /(:\s*any\b|as\s+any\b)/,
  },
  {
    id: 'no-test-only',
    message: 'it.only/describe.only تست‌های دیگر را در CI خاموش می‌کند.',
    appliesTo: (relative) => relative.startsWith('tests/'),
    scan: 'code',
    pattern: /\b(it|test|describe)\.only\s*\(/,
  },
];

/**
 * جایگزین کردن محتوای رشته‌ها و کامنت‌ها با فاصله، بدون تغییر شمارهٔ خطوط.
 * یک اسکنر ساده و قابل‌اعتماد برای تشخیص الگوهای کد کافی است.
 */
function maskStringsAndComments(source) {
  const chars = [...source];
  const masked = source.split('');
  let state = 'code';
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const next = chars[i + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line-comment';
        masked[i] = ' ';
        masked[i + 1] = ' ';
        i++;
      } else if (char === '/' && next === '*') {
        state = 'block-comment';
        masked[i] = ' ';
        masked[i + 1] = ' ';
        i++;
      } else if (char === "'" || char === '"' || char === '`') {
        state = char === "'" ? 'single' : char === '"' ? 'double' : 'template';
        masked[i] = ' ';
      }
      continue;
    }

    if (state === 'line-comment') {
      if (char === '\n') {
        state = 'code';
      } else {
        masked[i] = ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        masked[i] = ' ';
        masked[i + 1] = ' ';
        i++;
        state = 'code';
      } else if (char !== '\n') {
        masked[i] = ' ';
      }
      continue;
    }

    // داخل رشته
    if (char === '\\') {
      masked[i] = ' ';
      if (i + 1 < masked.length && chars[i + 1] !== '\n') {
        masked[i + 1] = ' ';
        i++;
      }
      continue;
    }
    const closing = state === 'single' ? "'" : state === 'double' ? '"' : '`';
    if (char === closing) {
      masked[i] = ' ';
      state = 'code';
      continue;
    }
    if (char !== '\n') masked[i] = ' ';
  }
  return masked.join('');
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, files);
    else if (CODE_EXTENSIONS.has(path.extname(name))) files.push(full);
  }
  return files;
}

function exists(target) {
  try {
    statSync(target);
    return true;
  } catch {
    return false;
  }
}

const violations = [];

for (const dirName of SOURCE_DIRS) {
  const dir = path.join(ROOT, dirName);
  if (!exists(dir)) continue;

  for (const file of walk(dir)) {
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    if (relative === SELF_FILE) continue;

    const activeRules = RULES.filter((rule) => rule.appliesTo(relative));
    if (activeRules.length === 0) continue;

    const raw = readFileSync(file, 'utf8');
    const rawLines = raw.split('\n');
    const codeLines = maskStringsAndComments(raw).split('\n');

    rawLines.forEach((rawLine, index) => {
      const codeLine = codeLines[index] ?? '';
      for (const rule of activeRules) {
        const line = rule.scan === 'raw' ? rawLine : codeLine;
        if (rule.pattern.test(line)) {
          violations.push({
            file: relative,
            line: index + 1,
            rule: rule.id,
            message: rule.message,
            snippet: rawLine.trim().slice(0, 120),
          });
        }
      }
    });
  }
}

if (violations.length === 0) {
  console.log('✅ lint پاک است: هیچ تخلفی در src/، scripts/ و tests/ پیدا نشد.');
  process.exit(0);
}

console.error(`❌ lint ${violations.length} تخلف پیدا کرد:`);
for (const violation of violations) {
  console.error(`  ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  console.error(`      ${violation.snippet}`);
}
process.exit(1);
