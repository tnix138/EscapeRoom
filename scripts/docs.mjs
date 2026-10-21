#!/usr/bin/env node
/**
 * ابزار نگه‌داری پوشهٔ DOCS
 *
 *   node scripts/docs.mjs index   → ساخت دوبارهٔ DOCS/INDEX.md از روی فایل‌های واقعی
 *   node scripts/docs.mjs check   → بررسی سالم بودن همهٔ پیوندهای .md و هم‌خوانی INDEX
 *
 * دامنهٔ بررسی: همهٔ فایل‌های Markdown ریشهٔ مخزن و DOCS/ (بدون logs/ که تاریخچهٔ خام است).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'DOCS');
const INDEX_FILE = path.join(DOCS, 'INDEX.md');

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'out', 'dist', 'logs']);

const SECTIONS = [
  {
    dir: '',
    title: 'نقطهٔ ورود و قوانین اجرا',
    note: 'این سه فایل در ریشهٔ مخزن می‌مانند چون ابزار worklog، هوک‌های گیت و ارجاع‌های تاریخی به آن‌ها وابسته‌اند.',
  },
  {
    dir: '.',
    title: 'مشخصات فعال محصول',
    note: 'مرجع اصلی: محصول، معماری، مالکیت و نقشهٔ ۱۰ موج.',
  },
  {
    dir: 'agents',
    title: 'نقشهٔ عامل‌ها',
    note: 'هر عامل فقط فایل نقش خودش را مبنا می‌گیرد.',
  },
  {
    dir: 'waves/redesign',
    title: 'موج‌های بازطراحی (REDESIGN-WAVE)',
    note: 'سند برنامه‌ریزی هر موج بازطراحی.',
  },
  {
    dir: 'waves/cards',
    title: 'کارت‌های وظیفهٔ موج (WAVE-N-OWNER)',
    note: 'دامنه، تحویل‌دادنی و معیار پذیرش هر عامل در هر موج.',
  },
  {
    dir: 'adr',
    title: 'تصمیم‌های معماری (ADR)',
    note: 'تصمیم‌های فنی ثبت‌شده، مثل انتخاب رندرر سه‌بعدی.',
  },
  {
    dir: 'legacy',
    title: 'اسناد قدیمی (فقط حفظ پیوند تاریخی)',
    note: 'مرجع فعال نیستند؛ اگر با DOCUMENTATION.md تضاد داشتند، DOCUMENTATION.md ملاک است.',
  },
];

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const toPosix = (p) => p.split(path.sep).join('/');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), acc);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(toPosix(path.relative(ROOT, path.join(dir, entry.name))));
    }
  }
  return acc;
}

const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

function sectionFiles(dir) {
  if (dir === '') {
    return ['README.md', 'AGENTS.md', 'WORKLOG.md'].filter(exists);
  }
  if (dir === '.') {
    return fs
      .readdirSync(DOCS, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'INDEX.md')
      .map((e) => `DOCS/${e.name}`)
      .sort(collator.compare);
  }
  const abs = path.join(DOCS, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => `DOCS/${dir}/${e.name}`)
    .sort(collator.compare);
}

function renderIndex() {
  const lines = [
    '# 🗂 نقشهٔ مستندات پروژه',
    '',
    '> این فایل فهرست رسمی اسناد است. برای بازسازی: `npm run docs:index` — برای بررسی پیوندها: `npm run docs:check`.',
    '>',
    '> - `README.md`، `AGENTS.md` و `WORKLOG.md` در ریشه می‌مانند (ابزار worklog، هوک‌های گیت و ارجاع‌های تاریخی).',
    '> - بقیهٔ اسناد در `DOCS/` گروه‌بندی شده‌اند؛ تاریخچهٔ خام لاگ‌ها در `logs/` است.',
    '',
  ];

  const rows = SECTIONS.map((s) => {
    const files = sectionFiles(s.dir);
    return { ...s, files };
  }).filter((s) => s.files.length > 0);

  lines.push('| بخش | مسیر | تعداد |', '| --- | --- | ---: |');
  for (const s of rows) {
    const where = s.dir === '' ? 'ریشه' : s.dir === '.' ? '`DOCS/`' : `\`DOCS/${s.dir}/\``;
    lines.push(`| ${s.title} | ${where} | ${s.files.length} |`);
  }
  lines.push('', '---', '');

  for (const s of rows) {
    const where = s.dir === '' ? 'ریشهٔ مخزن' : s.dir === '.' ? 'DOCS' : `DOCS/${s.dir}`;
    lines.push(`## ${s.title}`, '', `> ${s.note}`, '');
    for (const file of s.files) {
      const rel = toPosix(path.relative(DOCS, file));
      const href = file.startsWith('DOCS/') ? rel : `../${file}`;
      lines.push(`- [\`${path.posix.basename(file)}\`](${href})`);
    }
    lines.push('', `<sub>مسیر: \`${where}\`</sub>`, '');
  }

  return lines.join('\n');
}

function checkLinks() {
  const files = [...walk(DOCS), ...['README.md', 'AGENTS.md', 'WORKLOG.md'].filter(exists)].sort();
  const problems = [];

  for (const file of files) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const dest = match[1];
      if (/^(https?:|mailto:|#|\/)/.test(dest)) continue;
      const [pure] = dest.split('#');
      if (!pure || !/\.mdx?$/i.test(pure)) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURI(pure)));
      if (!exists(target)) problems.push(`${file}: پیوند شکسته → ${dest}`);
    }
  }

  if (!fs.existsSync(INDEX_FILE)) {
    problems.push('DOCS/INDEX.md وجود ندارد.');
  } else {
    const current = fs.readFileSync(INDEX_FILE, 'utf8').trimEnd();
    if (current !== renderIndex().trimEnd()) {
      problems.push('DOCS/INDEX.md با فایل‌های واقعی هم‌خوان نیست؛ `npm run docs:index` را اجرا کنید.');
    }
  }

  return problems;
}

const command = process.argv[2] ?? 'check';

if (command === 'index') {
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(INDEX_FILE, renderIndex(), 'utf8');
  console.log('✅ DOCS/INDEX.md بازسازی شد.');
} else if (command === 'check') {
  const problems = checkLinks();
  if (problems.length > 0) {
    console.error(`✖ ${problems.length} مشکل در مستندات:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('✅ همهٔ پیوندهای مستندات سالم‌اند و INDEX هم‌خوان است.');
} else {
  console.error(`دستور ناشناخته: ${command}\nاستفاده: node scripts/docs.mjs [index|check]`);
  process.exit(1);
}
