#!/usr/bin/env node
/**
 * docs:collect — آینه‌کردن همهٔ فایل‌های Markdown مخزن در پوشهٔ DOCS/
 *
 * - ساختار پوشه‌ها عیناً حفظ می‌شود (مثلاً logs/archive/x.md → DOCS/logs/archive/x.md).
 * - فایل‌های اصلی حذف یا جابه‌جا نمی‌شوند؛ DOCS فقط یک نمای یک‌جا و قابل مرور است.
 * - DOCS/INDEX.md به‌صورت خودکار ساخته می‌شود و همهٔ اسناد را فهرست می‌کند.
 * - DOCS/.docs-manifest.json فهرست فایل‌های تولیدشده را نگه می‌دارد تا اجرای دوباره
 *   فقط فایل‌های قدیمیِ همین ابزار را پاک کند و به فایل‌های دست‌نویس دست نزند.
 *
 * استفاده:
 *   npm run docs:collect          # ساخت/به‌روزرسانی DOCS
 *   npm run docs:collect -- --check   # فقط بررسی هم‌خوانی (برای CI)، بدون نوشتن
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'DOCS');
const INDEX_FILE = path.join(OUT_DIR, 'INDEX.md');
const MANIFEST_FILE = path.join(OUT_DIR, '.docs-manifest.json');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'out',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  '.data',
  '.vercel',
]);

const CHECK_ONLY = process.argv.includes('--check');
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** همهٔ فایل‌های .md مخزن، به‌جز خود DOCS/ */
function collectMarkdownFiles(dir = ROOT) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (abs === OUT_DIR || SKIP_DIRS.has(entry.name)) continue;
      found.push(...collectMarkdownFiles(abs));
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      found.push(abs);
    }
  }
  return found;
}

const toPosix = (value) => value.split(path.sep).join('/');

function groupLabel(dir) {
  return dir === '' ? 'ریشهٔ مخزن' : dir;
}

function buildIndex(files) {
  const groups = new Map();
  for (const rel of files) {
    const dir = path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(rel);
  }

  const orderedDirs = [...groups.keys()].sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return collator.compare(a, b);
  });

  const lines = [
    '# 🗂 فهرست اسناد پروژه (DOCS)',
    '',
    '> این پوشه آینهٔ خودکار همهٔ فایل‌های Markdown مخزن است و **ساختار پوشه‌ها را عیناً** حفظ می‌کند.',
    '> نسخهٔ اصلی هر سند همان مسیر در ریشهٔ مخزن است (مثلاً `DOCS/logs/archive/x.md` ← `logs/archive/x.md`)؛',
    '> این نسخه‌ها فقط برای مرور یک‌جا ساخته می‌شوند. برای ویرایش، همیشه فایل اصلی را تغییر دهید.',
    '>',
    '> بازسازی: `npm run docs:collect` — بررسی هم‌خوانی: `npm run docs:collect -- --check`',
    '',
    `**مجموع: ${files.length} سند در ${orderedDirs.length} گروه**`,
    '',
    '| گروه | تعداد |',
    '| --- | ---: |',
    ...orderedDirs.map((dir) => `| ${groupLabel(dir)} | ${groups.get(dir).length} |`),
    '',
    '---',
    '',
  ];

  for (const dir of orderedDirs) {
    const list = groups.get(dir).slice().sort((a, b) => collator.compare(a, b));
    lines.push(`## ${groupLabel(dir)} (${list.length} سند)`, '');
    for (const rel of list) {
      const name = path.posix.basename(rel);
      lines.push(`- [\`${name}\`](${encodeURI(rel)})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function pruneEmptyDirs(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(path.join(dir, entry.name));
  }
  if (dir !== OUT_DIR && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
}

function readManifest() {
  if (!existsSync(MANIFEST_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
    return Array.isArray(parsed.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

function main() {
  const files = collectMarkdownFiles()
    .map((abs) => toPosix(path.relative(ROOT, abs)))
    .sort((a, b) => collator.compare(a, b));

  const index = buildIndex(files);

  if (CHECK_ONLY) {
    const drift = [];
    for (const rel of files) {
      const target = path.join(OUT_DIR, rel);
      if (!existsSync(target)) {
        drift.push(`غایب: DOCS/${rel}`);
      } else if (readFileSync(target, 'utf8') !== readFileSync(path.join(ROOT, rel), 'utf8')) {
        drift.push(`ناهم‌خوان: DOCS/${rel}`);
      }
    }
    const manifest = readManifest();
    for (const rel of manifest) {
      if (!files.includes(rel)) drift.push(`اضافی: DOCS/${rel}`);
    }
    if (!existsSync(INDEX_FILE) || readFileSync(INDEX_FILE, 'utf8') !== index) {
      drift.push('ناهم‌خوان: DOCS/INDEX.md');
    }
    if (drift.length > 0) {
      console.error(`✖ DOCS با مخزن هم‌خوان نیست (${drift.length} مورد):`);
      for (const item of drift.slice(0, 20)) console.error(`  - ${item}`);
      if (drift.length > 20) console.error(`  … و ${drift.length - 20} مورد دیگر`);
      console.error('  اجرا کنید: npm run docs:collect');
      process.exit(1);
    }
    console.log(`✅ DOCS با ${files.length} سند کاملاً هم‌خوان است.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  // پاک‌کردن فایل‌هایی که اجرای قبلیِ همین ابزار ساخته و حالا منبعشان حذف شده است.
  const previous = readManifest();
  const current = new Set(files);
  for (const rel of previous) {
    if (!current.has(rel)) rmSync(path.join(OUT_DIR, rel), { force: true });
  }

  for (const rel of files) {
    const target = path.join(OUT_DIR, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(ROOT, rel), target);
  }

  writeFileSync(INDEX_FILE, index, 'utf8');
  writeFileSync(
    MANIFEST_FILE,
    `${JSON.stringify({ generated_by: 'scripts/collect-docs.mjs', count: files.length, files }, null, 2)}\n`,
    'utf8',
  );

  pruneEmptyDirs(OUT_DIR);

  console.log(`✅ ${files.length} سند در DOCS/ جمع شد (ساختار پوشه‌ها حفظ شد).`);
  console.log('   فهرست: DOCS/INDEX.md');
}

main();
