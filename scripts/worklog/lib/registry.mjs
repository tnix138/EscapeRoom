/**
 * Worklog registry: the single source of truth for team activity logs.
 *
 * Every report is a Markdown file with YAML front matter:
 *   - `logs/pending/<id>.md`  → created, waiting for review/merge/deploy
 *   - `logs/archive/<id>.md`  → reviewed & merged (or executed by infra agent)
 *
 * The front matter is authoritative; `WORKLOG.md` and the visible "lifecycle"
 * block inside each report are generated from it.  This module contains all
 * rendering + validation logic so that the CLI, the tests and the CI check
 * behave identically.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  jalaliDisplay,
  jalaliStamp,
  jalaliTehranToIso,
  toIsoUtc,
  toPersianDigits,
} from './jalali.mjs';
import {
  parseFrontMatter,
  quoteYaml,
  serializeFrontMatter,
} from './frontmatter.mjs';

export const LOG_ID_RE =
  /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})_([a-z0-9-]+)_([a-z0-9][a-z0-9._-]*)$/;

export const ACTIVITIES = [
  'Commit',
  'Push',
  'PR',
  'Commit & PR',
  'Infra-Supabase',
  'Infra-Vercel',
  'Infra-FullDeploy',
];

export const ACTIVITY_ALIASES = {
  commit: 'Commit',
  push: 'Push',
  pr: 'PR',
  'commit & pr': 'Commit & PR',
  'commit-and-pr': 'Commit & PR',
  'infra-supabase': 'Infra-Supabase',
  'infra-vercel': 'Infra-Vercel',
  'infra-fulldeploy': 'Infra-FullDeploy',
};

export const KNOWN_AUTHORS = [
  { slug: 'tohid', name: 'توحید' },
  { slug: 'amirali', name: 'امیرعلی' },
  { slug: 'alireza', name: 'علیرضا' },
  {
    slug: 'infra-agent',
    name: 'ایجنت چهارم زیرساخت (به مدیریت توحید)',
  },
  { slug: 'architect', name: 'معمار مستندات تیم' },
  { slug: 'arena-agent', name: 'ایجنت Arena' },
];

export const META_KEY_ORDER = [
  'id',
  'title',
  'summary',
  'author',
  'author_slug',
  'activity',
  'ref',
  'branch',
  'status',
  'created_by',
  'created_at_jalali',
  'created_at_time',
  'created_at_utc',
  'archived_by',
  'archived_at_jalali',
  'archived_at_time',
  'archived_at_utc',
  'archive_note',
  'commits',
  'tags',
];

export const HEADER_START = '<!-- WORKLOG:LOG-HEADER:START -->';
export const HEADER_END = '<!-- WORKLOG:LOG-HEADER:END -->';

export const WORKLOG_BLOCKS = ['STATS', 'EVENTS', 'PENDING', 'ARCHIVE'];

const PENDING_DIR = 'pending';
const ARCHIVE_DIR = 'archive';

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

export function toAsciiSlug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('_', '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveAuthor({ author, slug } = {}) {
  const wantedSlug = toAsciiSlug(slug);
  const wantedName = String(author ?? '').trim();

  let known = null;
  if (wantedSlug) {
    known = KNOWN_AUTHORS.find((item) => item.slug === wantedSlug);
  }
  if (!known && wantedName) {
    known = KNOWN_AUTHORS.find(
      (item) =>
        item.name === wantedName ||
        item.slug === wantedName.toLowerCase() ||
        item.name.startsWith(wantedName),
    );
  }

  if (known) {
    return { slug: known.slug, name: author?.trim() ? author.trim() : known.name };
  }

  if (!wantedSlug) {
    throw new Error(
      [
        `نویسنده «${wantedName || '?'}» شناخته نشد.`,
        'یکی از نام‌های رسمی تیم را بده یا با --slug یک شناسه لاتین مشخص کن:',
        ...KNOWN_AUTHORS.map((item) => `  • ${item.name} → --slug ${item.slug}`),
      ].join('\n'),
    );
  }

  return { slug: wantedSlug, name: wantedName || wantedSlug };
}

export function normalizeActivity(value) {
  const raw = String(value ?? '').trim();
  const exact = ACTIVITIES.find(
    (activity) => activity.toLowerCase() === raw.toLowerCase(),
  );
  if (exact) return exact;
  const alias = ACTIVITY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  throw new Error(
    `نوع فعالیت «${raw}» مجاز نیست. مقادیر مجاز: ${ACTIVITIES.join(' | ')}`,
  );
}

export function ensureTopic(topic) {
  const value = toAsciiSlug(topic);
  if (!value) {
    throw new Error(
      'شناسه موضوع (--topic) لازم است و باید فقط شامل حروف لاتین، رقم، خط تیره و نقطه باشد.',
    );
  }
  return value;
}

/**
 * Log instants are always whole seconds: the log id only encodes seconds, and
 * the Jalali/Tehran fields must round-trip exactly to the UTC field.
 */
export function floorToSecond(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

export function buildLogId({ at = new Date(), authorSlug, topic }) {
  const stamp = jalaliStamp(at);
  const slug = toAsciiSlug(authorSlug);
  if (!slug) throw new Error('author-slug نامعتبر است.');
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`author-slug نامعتبر: ${slug}`);
  return `${stamp.jalali}_${stamp.time.replaceAll(':', '-')}_${slug}_${ensureTopic(topic)}`;
}

const escapeCell = (value) =>
  String(value ?? '—')
    .replaceAll('|', '\\|')
    .replaceAll('\n', '<br>')
    .trim() || '—';

const code = (value) => (value ? `\`${String(value).replaceAll('`', '')}\`` : '—');

export function persianDate(jalali) {
  return jalali ? jalaliDisplay(jalali) : '—';
}

export function persianTime(time) {
  return time ? toPersianDigits(time) : '—';
}

export function persianDateTime(meta) {
  if (!meta?.created_at_jalali) return '—';
  return `${persianDate(meta.created_at_jalali)} — ${persianTime(meta.created_at_time)}`;
}

export function archiveDateTime(meta) {
  if (!meta?.archived_at_jalali) return '—';
  return `${persianDate(meta.archived_at_jalali)} — ${persianTime(meta.archived_at_time)}`;
}

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

export function logsRoot(root) {
  return path.join(root, 'logs');
}

export function logDir(root, status) {
  return path.join(logsRoot(root), status === 'archive' ? ARCHIVE_DIR : PENDING_DIR);
}

export function worklogPath(root) {
  return path.join(root, 'WORKLOG.md');
}

/* -------------------------------------------------------------------------- */
/* Rendering a single log                                                     */
/* -------------------------------------------------------------------------- */

function renderSpecTable(meta) {
  const rows = [
    ['شناسه لاگ', code(meta.id)],
    ['عنوان', escapeCell(meta.title)],
    ['خلاصه', escapeCell(meta.summary)],
    ['نوع فعالیت', code(meta.activity)],
    ['مرجع', escapeCell(meta.ref)],
    ['شاخه', code(meta.branch)],
    ['ساخته‌شده توسط', `**${escapeCell(meta.created_by || meta.author)}**`],
    ['زمان ایجاد (ایران / شمسی)', `**${persianDateTime(meta)}**`],
    ['زمان ایجاد (UTC)', code(meta.created_at_utc)],
    [
      'وضعیت فعلی',
      meta.status === 'archive'
        ? '✅ **Archive** (تأیید/ادغام یا اجراشده)'
        : '🟡 **Pending** (در انتظار تأیید، ادغام یا اجرا)',
    ],
  ];

  if (meta.status === 'archive') {
    rows.push(
      ['آرشیو شده توسط', `**${escapeCell(meta.archived_by || 'ثبت‌نشده')}**`],
      ['زمان آرشیو (ایران / شمسی)', `**${archiveDateTime(meta)}**`],
      ['زمان آرشیو (UTC)', code(meta.archived_at_utc)],
      ['یادداشت آرشیو', escapeCell(meta.archive_note)],
    );
  }

  if (Array.isArray(meta.commits) && meta.commits.length) {
    rows.push(['کامیت‌های مرتبط', meta.commits.map(code).join(' , ')]);
  }

  return [
    '| فیلد | مقدار |',
    '| --- | --- |',
    ...rows.map(([key, value]) => `| **${key}** | ${value} |`),
  ].join('\n');
}

function renderLifecycleTable(meta) {
  const createdAt = `${persianDateTime(meta)}`;
  const createdRow = `| 🟡 ایجاد و ثبت در \`Pending\` | **${escapeCell(meta.created_by || meta.author)}** | ${persianDate(meta.created_at_jalali)} | ${persianTime(meta.created_at_time)} | ${code(meta.created_at_utc)} | ثبت اولیه گزارش |`;

  const archiveRow =
    meta.status === 'archive'
      ? `| 🟢 تبدیل به \`Archive\` | **${escapeCell(meta.archived_by || 'ثبت‌نشده')}** | ${persianDate(meta.archived_at_jalali)} | ${persianTime(meta.archived_at_time)} | ${code(meta.archived_at_utc)} | ${escapeCell(meta.archive_note)} |`
      : '| 🟢 تبدیل به `Archive` | ⏳ در انتظار | — | — | — | هنوز آرشیو نشده است |';

  const timeline =
    meta.status === 'archive'
      ? `> 🧾 **خط زمان:** این لاگ در **${createdAt}** توسط **${meta.created_by || meta.author}** ساخته شد و در **${archiveDateTime(meta)}** توسط **${meta.archived_by || 'ثبت‌نشده'}** به **\`Archive\`** منتقل شد.`
      : `> 🧾 **خط زمان:** این لاگ در **${createdAt}** توسط **${meta.created_by || meta.author}** ساخته شد و در حال حاضر در وضعیت **\`Pending\`** (در انتظار تأیید، ادغام یا اجرا) قرار دارد.`;

  return [
    '| رویداد | توسط | تاریخ شمسی | ساعت (ایران) | زمان UTC | یادداشت |',
    '| --- | --- | --- | --- | --- | --- |',
    createdRow,
    archiveRow,
    '',
    timeline,
  ].join('\n');
}

export function renderLogHeader(meta) {
  return [
    HEADER_START,
    '## 📌 مشخصات فعالیت',
    '',
    renderSpecTable(meta),
    '',
    '## 🔁 چرخه عمر لاگ',
    '',
    renderLifecycleTable(meta),
    HEADER_END,
  ].join('\n');
}

export function logTitle(meta) {
  return meta.title || meta.id || 'گزارش فعالیت';
}

/**
 * Remove the generated scaffolding (title, note, lifecycle block, separators)
 * so that composing a file twice is idempotent and safe.
 */
export function stripGeneratedScaffold(body) {
  const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let text = String(body ?? '').replaceAll('\r\n', '\n');

  text = text.replace(
    new RegExp(`${escapeRe(HEADER_START)}[\\s\\S]*?${escapeRe(HEADER_END)}`, 'g'),
    '',
  );

  text = text
    .split('\n')
    .filter((line) => {
      const value = line.trim();
      if (/^#\s+گزارش فعالیت (تیمی|\/ درخواست زیرساخت)\s*—/.test(value)) return false;
      if (value.startsWith('> ⚙️')) return false;
      if (value.startsWith('> `npm run worklog:sync`')) return false;
      return true;
    })
    .join('\n');

  text = text.replace(/^(?:\s*---\s*\n)+/, '').replace(/^\n+/, '');

  return text.trim();
}

export function composeLogFile(meta, body) {
  const cleanBody = stripGeneratedScaffold(body);

  return [
    serializeFrontMatter(meta, META_KEY_ORDER).trimEnd(),
    '',
    `# گزارش فعالیت تیمی — ${meta.id}`,
    '',
    '> ⚙️ جدول مشخصات و چرخه عمر این فایل به‌صورت خودکار از فراداده (YAML) بالای فایل توسط',
    '> `npm run worklog:sync` ساخته می‌شود؛ برای تغییر وضعیت از `npm run worklog:archive` استفاده کنید.',
    '',
    renderLogHeader(meta),
    '',
    '---',
    '',
    cleanBody,
    '',
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/* Reading / writing logs                                                     */
/* -------------------------------------------------------------------------- */

export function readLogFile(root, filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { meta, body, hasFrontMatter } = parseFrontMatter(raw);
  const dir = path.dirname(filePath).split(path.sep).pop();
  return {
    file: filePath,
    relPath: path.relative(root, filePath).split(path.sep).join('/'),
    id: meta.id || path.basename(filePath, '.md'),
    dir,
    meta,
    body,
    raw,
    hasFrontMatter,
  };
}

export function readAllLogs(root) {
  const logs = [];

  for (const status of [PENDING_DIR, ARCHIVE_DIR]) {
    const dir = path.join(logsRoot(root), status);
    if (!fs.existsSync(dir)) continue;

    for (const entry of fs.readdirSync(dir).sort()) {
      if (!entry.endsWith('.md')) continue;
      logs.push(readLogFile(root, path.join(dir, entry)));
    }
  }

  return logs.sort((a, b) =>
    String(b.meta.created_at_utc ?? '').localeCompare(
      String(a.meta.created_at_utc ?? ''),
    ),
  );
}

function ensureLogsDirs(root) {
  fs.mkdirSync(path.join(logsRoot(root), PENDING_DIR), { recursive: true });
  fs.mkdirSync(path.join(logsRoot(root), ARCHIVE_DIR), { recursive: true });
}

/**
 * Create a new pending log file.
 */
export function createLog(root, options) {
  ensureLogsDirs(root);

  const rawAt = options.at ? new Date(options.at) : new Date();
  if (Number.isNaN(rawAt.getTime())) throw new Error(`Invalid --at: ${options.at}`);
  const at = floorToSecond(rawAt);

  const author = resolveAuthor(options);
  const activity = normalizeActivity(options.activity);
  const topic = ensureTopic(options.topic);
  const stamp = jalaliStamp(at);

  let id = buildLogId({ at, authorSlug: author.slug, topic });
  let filePath = path.join(logDir(root, 'pending'), `${id}.md`);
  let offset = 0;

  // Keep ids unique even when two logs are created within the same second.
  while (fs.existsSync(filePath) || fs.existsSync(path.join(logDir(root, 'archive'), `${id}.md`))) {
    offset += 1;
    const shifted = new Date(at.getTime() + offset * 1000);
    id = buildLogId({ at: shifted, authorSlug: author.slug, topic });
    filePath = path.join(logDir(root, 'pending'), `${id}.md`);
  }

  const shiftedStamp = jalaliStamp(
    offset === 0 ? at : new Date(at.getTime() + offset * 1000),
  );

  const meta = {
    id,
    title: options.title || `گزارش ${activity} — ${topic}`,
    summary: options.summary || options.title || `گزارش ${activity}`,
    author: author.name,
    author_slug: author.slug,
    activity,
    ref: options.ref || '—',
    branch: options.branch || '',
    status: 'pending',
    created_by: author.name,
    created_at_jalali: shiftedStamp.jalali,
    created_at_time: shiftedStamp.time,
    created_at_utc: toIsoUtc(new Date(at.getTime() + offset * 1000)),
    archived_by: null,
    archived_at_jalali: null,
    archived_at_time: null,
    archived_at_utc: null,
    archive_note: null,
    commits: Array.isArray(options.commits) && options.commits.length
      ? options.commits.map((sha) => String(sha).trim()).filter(Boolean)
      : null,
    tags: Array.isArray(options.tags) && options.tags.length ? options.tags : null,
  };

  // Defensive: the id must always encode the same time as the metadata.
  if (stamp.jalali && offset === 0) {
    meta.created_at_jalali = stamp.jalali;
    meta.created_at_time = stamp.time;
  }

  const body =
    options.body?.trim() ||
    [
      '## 📝 شرح دقیق فعالیت انجام‌شده',
      '',
      `- **موضوع:** ${meta.title}`,
      `- **مرجع:** ${meta.ref}`,
      '- **جزئیات:** <اینجا دقیقاً توضیح بده چه کاری انجام شد، کدام فایل‌ها تغییر کردند و نتیجه تست‌ها چه بود.>',
      '',
      '## ✅ نتیجه بررسی‌ها و تست‌ها',
      '',
      '- `<دستور>` → `<نتیجه>`',
    ].join('\n');

  fs.writeFileSync(filePath, composeLogFile(meta, body), 'utf8');
  return { id, file: filePath, meta };
}

/**
 * Rewrite the generated header of an existing log from its front matter.
 */
export function refreshLogHeader(log) {
  const { raw, meta } = log;
  const start = raw.indexOf(HEADER_START);
  const end = raw.indexOf(HEADER_END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `${log.relPath}: بلوک چرخه عمر (${HEADER_START}) پیدا نشد. فایل را با قالب جدید بازسازی کنید.`,
    );
  }

  const updated =
    raw.slice(0, start) + renderLogHeader(meta) + raw.slice(end + HEADER_END.length);

  const changed = updated !== raw;
  if (changed) fs.writeFileSync(log.file, updated, 'utf8');
  return changed;
}

export function writeMeta(root, meta, body) {
  const target = path.join(logDir(root, meta.status), `${meta.id}.md`);
  fs.writeFileSync(target, composeLogFile(meta, body), 'utf8');
  return target;
}

/**
 * Move a pending log to `archive` and record *who* archived it and *when*.
 */
export function archiveLog(root, options) {
  const id = String(options.id ?? '').trim();
  if (!id) throw new Error('شناسه لاگ لازم است.');

  const source = path.join(logDir(root, 'pending'), `${id}.md`);
  const target = path.join(logDir(root, 'archive'), `${id}.md`);

  if (!fs.existsSync(source)) {
    if (fs.existsSync(target)) {
      throw new Error(`لاگ ${id} از قبل در Archive است.`);
    }
    throw new Error(`لاگ ${id} در logs/pending پیدا نشد.`);
  }

  const log = readLogFile(root, source);
  if (log.meta.status !== 'pending') {
    throw new Error(`وضعیت لاگ ${id} برابر «${log.meta.status}» است، نه pending.`);
  }

  const rawAt = options.at ? new Date(options.at) : new Date();
  if (Number.isNaN(rawAt.getTime())) throw new Error(`Invalid --at: ${options.at}`);
  const at = floorToSecond(rawAt);

  const stamp = jalaliStamp(at);
  const archivedBy = options.by || 'نامشخص';

  const meta = {
    ...log.meta,
    status: 'archive',
    archived_by: archivedBy,
    archived_at_jalali: stamp.jalali,
    archived_at_time: stamp.time,
    archived_at_utc: toIsoUtc(at),
    archive_note: options.note || 'تأیید و ادغام شد.',
  };

  let body = log.body;
  if (options.append) {
    body = `${body.trim()}\n\n${String(options.append).trim()}\n`;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, composeLogFile(meta, body), 'utf8');
  fs.unlinkSync(source);

  return { id, file: target, meta };
}

/**
 * Ensure every log's generated header matches its front matter.
 */
export function syncLogHeaders(root) {
  const changed = [];
  for (const log of readAllLogs(root)) {
    if (refreshLogHeader(log)) changed.push(log.relPath);
  }
  return changed;
}

/* -------------------------------------------------------------------------- */
/* WORKLOG.md rendering                                                       */
/* -------------------------------------------------------------------------- */

function sourceLink(log) {
  return `[${code(log.meta.id)}](./${log.relPath})`;
}

function createdCell(meta) {
  return `${persianDateTime(meta)}<br>${code(meta.created_at_utc)}`;
}

function archivedCell(meta) {
  return `${archiveDateTime(meta)}<br>${code(meta.archived_at_utc)}`;
}

export function renderPendingTable(logs) {
  return [
    '| شناسه لاگ (لینک) | عنوان | نوع | ساخته‌شده توسط | زمان ایجاد (ایران / UTC) | مرجع |',
    '| --- | --- | --- | --- | --- | --- |',
    ...logs.map(
      (log) =>
        `| ${sourceLink(log)} | ${escapeCell(log.meta.title)} | ${code(log.meta.activity)} | **${escapeCell(log.meta.created_by || log.meta.author)}** | ${createdCell(log.meta)} | ${escapeCell(log.meta.ref)} |`,
    ),
  ].join('\n');
}

export function renderArchiveTable(logs) {
  return [
    '| شناسه لاگ (لینک) | عنوان | نوع | ساخته‌شده توسط | زمان ایجاد (ایران / UTC) | آرشیو شده توسط | زمان آرشیو (ایران / UTC) | مرجع |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...logs.map(
      (log) =>
        `| ${sourceLink(log)} | ${escapeCell(log.meta.title)} | ${code(log.meta.activity)} | **${escapeCell(log.meta.created_by || log.meta.author)}** | ${createdCell(log.meta)} | **${escapeCell(log.meta.archived_by)}** | ${archivedCell(log.meta)} | ${escapeCell(log.meta.ref)} |`,
    ),
  ].join('\n');
}

export function buildEvents(logs, limit = 12) {
  const events = [];

  for (const log of logs) {
    if (log.meta.created_at_utc) {
      events.push({
        at: log.meta.created_at_utc,
        kind: 'created',
        by: log.meta.created_by || log.meta.author,
        meta: log.meta,
        relPath: log.relPath,
      });
    }
    if (log.meta.status === 'archive' && log.meta.archived_at_utc) {
      events.push({
        at: log.meta.archived_at_utc,
        kind: 'archived',
        by: log.meta.archived_by,
        meta: log.meta,
        relPath: log.relPath,
      });
    }
  }

  return events
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}

export function renderEventsTable(logs, limit = 12) {
  const rows = buildEvents(logs, limit).map((event) => {
    const stamp = jalaliStamp(event.at);
    const when = `${persianDate(stamp.jalali)} — ${persianTime(stamp.time)}<br>${code(event.at)}`;
    const kind =
      event.kind === 'created'
        ? '🟡 ایجاد و ثبت در `Pending`'
        : '🟢 تبدیل به `Archive`';
    return `| ${when} | ${kind} | [\`${event.meta.id}\`](./${event.relPath}) | **${escapeCell(event.by)}** |`;
  });

  return [
    '| 🕒 زمان (ایران / UTC) | رویداد | شناسه لاگ | توسط |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

export function latestEventIso(logs) {
  const events = buildEvents(logs, Number.POSITIVE_INFINITY);
  return events.length ? events[0].at : null;
}

export function renderStats(logs) {
  const pending = logs.filter((log) => log.meta.status === 'pending');
  const archive = logs.filter((log) => log.meta.status === 'archive');
  const latest = latestEventIso(logs);
  const stamp = latest ? jalaliStamp(latest) : null;

  const latestText = latest
    ? `${persianDate(stamp.jalali)} — ${persianTime(stamp.time)} (${code(latest)})`
    : '—';

  return [
    `> 🔢 **آمار زنده:** ⏳ Pending: **${toPersianDigits(pending.length)}** — ✅ Archive: **${toPersianDigits(archive.length)}** — 🧾 مجموع: **${toPersianDigits(logs.length)}** — 🕒 آخرین رویداد ثبت‌شده: ${latestText}`,
  ].join('\n');
}

export function renderWorklogBlocks(logs) {
  const pending = logs
    .filter((log) => log.meta.status === 'pending')
    .sort((a, b) =>
      String(b.meta.created_at_utc).localeCompare(String(a.meta.created_at_utc)),
    );

  const archive = logs
    .filter((log) => log.meta.status === 'archive')
    .sort((a, b) => {
      const byArchive = String(b.meta.archived_at_utc ?? '').localeCompare(
        String(a.meta.archived_at_utc ?? ''),
      );
      return byArchive !== 0
        ? byArchive
        : String(b.meta.created_at_utc).localeCompare(
            String(a.meta.created_at_utc),
          );
    });

  return {
    STATS: renderStats(logs),
    EVENTS: renderEventsTable(logs),
    PENDING: pending.length
      ? renderPendingTable(pending)
      : '_هیچ لاگی در صف `Pending` نیست._',
    ARCHIVE: archive.length
      ? renderArchiveTable(archive)
      : '_هنوز هیچ لاگی آرشیو نشده است._',
  };
}

export function markerPair(name) {
  return {
    start: `<!-- WORKLOG:${name}:START -->`,
    end: `<!-- WORKLOG:${name}:END -->`,
  };
}

export function replaceBlock(text, name, content) {
  const { start, end } = markerPair(name);
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      `بلوک «${name}» در WORKLOG.md پیدا نشد (نشانه‌های ${start} و ${end}).`,
    );
  }

  return (
    text.slice(0, startIndex + start.length) +
    '\n' +
    String(content).trim() +
    '\n' +
    text.slice(endIndex)
  );
}

/**
 * Regenerate the generated blocks of WORKLOG.md from the log files.
 */
export function syncWorklog(root) {
  const file = worklogPath(root);
  if (!fs.existsSync(file)) {
    throw new Error('WORKLOG.md پیدا نشد.');
  }

  const logs = readAllLogs(root);
  const blocks = renderWorklogBlocks(logs);
  const original = fs.readFileSync(file, 'utf8');

  let updated = original;
  for (const name of WORKLOG_BLOCKS) {
    updated = replaceBlock(updated, name, blocks[name]);
  }

  const changed = updated !== original;
  if (changed) fs.writeFileSync(file, updated, 'utf8');

  return { changed, total: logs.length, blocks };
}

export function syncAll(root) {
  const headers = syncLogHeaders(root);
  const worklog = syncWorklog(root);
  return { headers, worklog };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const JALALI_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}:\d{2}$/;

export function validateLog(log) {
  const errors = [];
  const { meta, dir, relPath } = log;
  const filename = path.basename(relPath, '.md');
  const push = (message) => errors.push(`${relPath}: ${message}`);

  if (!log.hasFrontMatter) {
    push('فراداده YAML (front matter) ندارد؛ با دستور worklog:new بازسازی کنید.');
    return errors;
  }

  for (const field of [
    'id',
    'title',
    'summary',
    'author',
    'activity',
    'ref',
    'status',
    'created_by',
    'created_at_jalali',
    'created_at_time',
    'created_at_utc',
  ]) {
    if (meta[field] === null || meta[field] === undefined || meta[field] === '') {
      push(`فیلد «${field}» خالی است.`);
    }
  }

  if (meta.id !== filename) {
    push(`شناسه داخل فایل (${meta.id}) با نام فایل (${filename}) یکی نیست.`);
  }

  const match = LOG_ID_RE.exec(String(meta.id ?? ''));
  if (!match) {
    push('شناسه لاگ با الگوی <YYYY-MM-DD>_<HH-MM-SS>_<author>_<topic> نمی‌خواند.');
  } else if (KNOWN_AUTHORS.some((item) => item.slug === match[7])) {
    // The author segment is only meaningful when it is a known team slug.
    if (meta.author_slug && match[7] !== meta.author_slug) {
      push(`شناسه نویسنده در نام فایل (${match[7]}) با author_slug (${meta.author_slug}) یکی نیست.`);
    }
  }

  if (meta.status !== 'pending' && meta.status !== 'archive') {
    push(`وضعیت «${meta.status}» نامعتبر است (pending | archive).`);
  } else if ((meta.status === 'archive' ? 'archive' : 'pending') !== dir) {
    push(
      `وضعیت داخل فایل (${meta.status}) با پوشه (${dir}) هم‌خوان نیست؛ فایل یا باید در logs/${meta.status === 'archive' ? 'archive' : 'pending'} باشد یا وضعیت اصلاح شود.`,
    );
  }

  if (!ACTIVITIES.includes(meta.activity)) {
    push(`نوع فعالیت «${meta.activity}» مجاز نیست.`);
  }

  if (!JALALI_RE.test(String(meta.created_at_jalali ?? ''))) {
    push('created_at_jalali باید به شکل YYYY-MM-DD (شمسی) باشد.');
  }
  if (!TIME_RE.test(String(meta.created_at_time ?? ''))) {
    push('created_at_time باید به شکل HH:MM:SS (به وقت ایران) باشد.');
  }
  if (!ISO_UTC_RE.test(String(meta.created_at_utc ?? ''))) {
    push('created_at_utc باید ISO-8601 UTC با میلی‌ثانیه و Z باشد.');
  }

  if (
    JALALI_RE.test(String(meta.created_at_jalali ?? '')) &&
    TIME_RE.test(String(meta.created_at_time ?? '')) &&
    ISO_UTC_RE.test(String(meta.created_at_utc ?? ''))
  ) {
    try {
      const expected = jalaliTehranToIso(meta.created_at_jalali, meta.created_at_time);
      if (expected !== meta.created_at_utc) {
        push(
          `زمان UTC (${meta.created_at_utc}) با تاریخ/ساعت شمسی (${meta.created_at_jalali} ${meta.created_at_time} → ${expected}) هم‌خوان نیست.`,
        );
      }
    } catch (error) {
      push(String(error.message));
    }

    if (match) {
      const expectedIdPrefix = `${meta.created_at_jalali}_${meta.created_at_time.replaceAll(':', '-')}`;
      if (!String(meta.id).startsWith(expectedIdPrefix)) {
        push(`بخش زمان در شناسه لاگ با created_at هم‌خوان نیست (انتظار: ${expectedIdPrefix}).`);
      }
    }
  }

  if (meta.status === 'archive') {
    for (const field of [
      'archived_by',
      'archived_at_jalali',
      'archived_at_time',
      'archived_at_utc',
    ]) {
      if (!meta[field]) push(`وضعیت Archive است ولی «${field}» ثبت نشده است.`);
    }
    if (
      ISO_UTC_RE.test(String(meta.archived_at_utc ?? '')) &&
      ISO_UTC_RE.test(String(meta.created_at_utc ?? '')) &&
      String(meta.archived_at_utc) < String(meta.created_at_utc)
    ) {
      push('زمان آرشیو نمی‌تواند پیش از زمان ایجاد لاگ باشد.');
    }
    if (
      JALALI_RE.test(String(meta.archived_at_jalali ?? '')) &&
      TIME_RE.test(String(meta.archived_at_time ?? '')) &&
      ISO_UTC_RE.test(String(meta.archived_at_utc ?? ''))
    ) {
      try {
        const expected = jalaliTehranToIso(meta.archived_at_jalali, meta.archived_at_time);
        if (expected !== meta.archived_at_utc) {
          push(
            `زمان UTC آرشیو (${meta.archived_at_utc}) با تاریخ/ساعت شمسی آرشیو (${expected}) هم‌خوان نیست.`,
          );
        }
      } catch (error) {
        push(String(error.message));
      }
    }
  } else if (meta.archived_by || meta.archived_at_utc) {
    push('لاگ Pending نباید فراداده آرشیو (archived_*) داشته باشد.');
  }

  if (Array.isArray(meta.commits)) {
    for (const sha of meta.commits) {
      if (!/^[0-9a-f]{7,40}$/.test(sha)) {
        push(`کامیت «${sha}» با الگوی SHA هم‌خوان نیست.`);
      }
    }
  }

  if (!log.body || log.body.trim().length < 60) {
    push('متن شرح فعالیت (body) خیلی کوتاه یا خالی است.');
  }

  const start = log.raw.indexOf(HEADER_START);
  const end = log.raw.indexOf(HEADER_END);
  if (start === -1 || end === -1 || end < start) {
    push('بلوک تولیدشده «مشخصات فعالیت / چرخه عمر» وجود ندارد؛ npm run worklog:sync را اجرا کنید.');
  } else {
    const expected = renderLogHeader(meta);
    const actual = log.raw.slice(start, end + HEADER_END.length);
    if (expected !== actual) {
      push('جدول مشخصات/چرخه عمر با فراداده هم‌خوان نیست؛ npm run worklog:sync را اجرا کنید.');
    }
  }

  return errors;
}

export function checkWorklog(root, options = {}) {
  const errors = [];
  const warnings = [];
  const logs = readAllLogs(root);

  if (!logs.length) {
    errors.push('هیچ فایل لاگی در logs/ پیدا نشد.');
  }

  const seen = new Map();
  for (const log of logs) {
    if (seen.has(log.meta.id)) {
      errors.push(`شناسه تکراری «${log.meta.id}» در ${log.relPath} و ${seen.get(log.meta.id)}.`);
    } else {
      seen.set(log.meta.id, log.relPath);
    }
    errors.push(...validateLog(log));
  }

  const worklogFile = worklogPath(root);
  if (!fs.existsSync(worklogFile)) {
    errors.push('WORKLOG.md پیدا نشد.');
  } else {
    const text = fs.readFileSync(worklogFile, 'utf8');
    for (const name of WORKLOG_BLOCKS) {
      const { start, end } = markerPair(name);
      if (!text.includes(start) || !text.includes(end)) {
        errors.push(`نشانه بلوک ${name} در WORKLOG.md موجود نیست.`);
      }
    }

    if (!errors.length) {
      const blocks = renderWorklogBlocks(logs);
      let expected = text;
      for (const name of WORKLOG_BLOCKS) {
        expected = replaceBlock(expected, name, blocks[name]);
      }
      if (expected !== text) {
        errors.push('جدول‌های WORKLOG.md با فایل‌های logs/ هم‌خوان نیستند؛ npm run worklog:sync را اجرا کنید.');
      }
    }
  }

  const stale = logs.filter(
    (log) => log.meta.status === 'pending' && ageInDays(log.meta.created_at_utc) > 7,
  );
  for (const log of stale) {
    warnings.push(
      `${log.relPath}: بیش از ۷ روز در Pending مانده است؛ وضعیت آن را بررسی کنید.`,
    );
  }

  if (options.quiet) return { errors, warnings, logs };

  return { errors, warnings, logs };
}

function ageInDays(iso) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export { quoteYaml };
