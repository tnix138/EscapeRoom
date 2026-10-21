import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ACTIVITIES,
  archiveLog,
  checkWorklog,
  composeLogFile,
  createLog,
  readAllLogs,
  renderLogHeader,
  syncAll,
  syncWorklog,
  validateLog,
  buildLogId,
  normalizeActivity,
  resolveAuthor,
} from '../../scripts/worklog/lib/registry.mjs';
import { jalaliStamp } from '../../scripts/worklog/lib/jalali.mjs';

const ROOT = path.resolve(__dirname, '../..');

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'worklog-'));
  const src = fs.readFileSync(path.join(ROOT, 'WORKLOG.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'WORKLOG.md'), src, 'utf8');
  fs.mkdirSync(path.join(dir, 'logs/pending'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'logs/archive'), { recursive: true });
  return dir;
}

let sandbox: string;

beforeEach(() => {
  sandbox = makeSandbox();
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('ساخت لاگ و چرخه عمر', () => {
  it('لاگ جدید با نام، تاریخ شمسی و زمان UTC هم‌خوان ساخته می‌شود', () => {
    const at = new Date('2026-10-21T13:05:38.000Z');
    const { file, meta } = createLog(sandbox, {
      author: 'علیرضا',
      activity: 'Commit',
      title: 'موج ۳ — سالن تاریک',
      topic: 'wave3-dark-auditorium',
      ref: 'شاخه arena/test',
      at,
      body: 'شرح کامل کار انجام‌شده: ساخت صحنه تاریک و اتصال صدا. نتیجه تست‌ها: ۳۷ تست پاس شد و بیلد موفق بود.',
    });

    expect(meta.id).toBe('1405-07-29_16-35-38_alireza_wave3-dark-auditorium');
    expect(fs.existsSync(file)).toBe(true);
    expect(meta.created_at_jalali).toBe('1405-07-29');
    expect(meta.created_at_time).toBe('16:35:38');
    expect(meta.created_at_utc).toBe('2026-10-21T13:05:38.000Z');
    expect(meta.status).toBe('pending');

    const raw = fs.readFileSync(file, 'utf8');
    expect(raw).toContain('ساخته‌شده توسط');
    expect(raw).toContain('🧾 **خط زمان:**');
    expect(raw).toContain('در انتظار');
    expect(raw).not.toContain('آرشیو شده توسط');
  });

  it('دو لاگ در یک ثانیه، شناسه یکتا می‌گیرند', () => {
    const at = new Date('2026-10-21T13:05:38.000Z');
    const options = {
      author: 'علیرضا',
      activity: 'Commit',
      title: 'تست',
      topic: 'same-second',
      at,
      body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن: این متن باید بیش از شصت کاراکتر باشد تا اعتبارسنجی قبول کند.',
    };
    const first = createLog(sandbox, options);
    const second = createLog(sandbox, options);
    expect(second.id).not.toBe(first.id);
    expect(second.meta.created_at_utc).toBe('2026-10-21T13:05:39.000Z');
  });

  it('آرشیو کردن، «آرشیو شده توسط» و زمان آرشیو را ثبت می‌کند', () => {
    const created = createLog(sandbox, {
      author: 'علیرضا',
      activity: 'PR',
      title: 'PR #13',
      topic: 'pr-13',
      ref: 'PR #13',
      at: new Date('2026-10-21T13:05:38.000Z'),
      body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن: این متن باید بیش از شصت کاراکتر باشد تا اعتبارسنجی قبول کند.',
    });

    const archived = archiveLog(sandbox, {
      id: created.id,
      by: 'توحید',
      note: 'PR #13 بررسی و ادغام شد',
      at: new Date('2026-10-22T06:42:00.000Z'),
    });

    expect(archived.meta.status).toBe('archive');
    expect(archived.meta.archived_by).toBe('توحید');
    expect(archived.meta.archived_at_jalali).toBe('1405-07-30');
    expect(archived.meta.archived_at_time).toBe('10:12:00');
    expect(archived.meta.archived_at_utc).toBe('2026-10-22T06:42:00.000Z');

    expect(
      fs.existsSync(path.join(sandbox, `logs/pending/${created.id}.md`)),
    ).toBe(false);
    const raw = fs.readFileSync(
      path.join(sandbox, `logs/archive/${created.id}.md`),
      'utf8',
    );
    expect(raw).toContain('آرشیو شده توسط');
    expect(raw).toContain('توحید');
    expect(raw).toContain('۱۴۰۵/۰۷/۳۰');
    expect(raw).toContain('PR #13 بررسی و ادغام شد');
  });

  it('آرشیو کردن لاگ ناموجود یا تکراری خطا می‌دهد', () => {
    expect(() => archiveLog(sandbox, { id: 'nope', by: 'توحید' })).toThrow(/پیدا نشد/);
  });

  it('نام نویسنده ناشناخته با راهنمای نویسندگان مجاز رد می‌شود', () => {
    expect(() =>
      createLog(sandbox, {
        author: 'کسی دیگر',
        activity: 'Commit',
        title: 'تست',
        topic: 'x',
        body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن و تست اعتبارسنجی نام نویسنده.',
      }),
    ).toThrow(/شناخته نشد/);

    expect(resolveAuthor({ author: 'توحید' })).toEqual({ slug: 'tohid', name: 'توحید' });
    expect(resolveAuthor({ author: 'Unknown', slug: 'custom-bot' })).toEqual({
      slug: 'custom-bot',
      name: 'Unknown',
    });
  });

  it('نوع فعالیت‌ها به شکل رسمی نرمال می‌شوند', () => {
    expect(normalizeActivity('commit')).toBe('Commit');
    expect(normalizeActivity('Infra-Supabase')).toBe('Infra-Supabase');
    expect(() => normalizeActivity('Deploy')).toThrow(/مجاز نیست/);
    expect(ACTIVITIES).toContain('Push');
  });

  it('شناسه لاگ از تاریخ شمسی و ساعت ایران ساخته می‌شود', () => {
    expect(
      buildLogId({
        at: new Date('2026-10-21T13:05:38.000Z'),
        authorSlug: 'tohid',
        topic: 'Wave 3 SSE',
      }),
    ).toBe('1405-07-29_16-35-38_tohid_wave-3-sse');
  });
});

describe('اعتبارسنجی و همگام‌سازی', () => {
  it('لاگ معتبر بدون خطا پذیرفته می‌شود', () => {
    const { file } = createLog(sandbox, {
      author: 'توحید',
      activity: 'Commit',
      title: 'تست اعتبارسنجی',
      topic: 'validation',
      body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن: این متن باید بیش از شصت کاراکتر باشد تا اعتبارسنجی قبول کند.',
    });
    const log = readAllLogs(sandbox).find((item) => item.file === file);
    expect(validateLog(log)).toEqual([]);
  });

  it('تاریخ ناهم‌خوان با UTC، وضعیت ناهم‌خوان با پوشه و فراداده ناقص را می‌گیرد', () => {
    const { file } = createLog(sandbox, {
      author: 'توحید',
      activity: 'Commit',
      title: 'تست',
      topic: 'broken',
      body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن: این متن باید بیش از شصت کاراکتر باشد تا اعتبارسنجی قبول کند.',
    });

    const raw = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, raw.replace("created_at_utc: '", "created_at_utc: '1999-01-01T00:00:00.000Z"), 'utf8');

    const log = readAllLogs(sandbox).find((item) => item.file === file);
    const errors = validateLog(log).join('\n');
    expect(errors).toContain('هم‌خوان نیست');
  });

  it('جدول‌های WORKLOG با فایل‌ها هم‌خوان می‌شوند', () => {
    createLog(sandbox, {
      author: 'علیرضا',
      activity: 'Push',
      title: 'پوش شاخه تست',
      topic: 'push-test',
      body: 'شرح کامل پوش: سه کامیت شامل تغییرات لاگ و مستندات، تست‌ها پاس و بیلد موفق بود.',
      at: new Date('2026-10-21T13:00:00.000Z'),
    });

    const before = checkWorklog(sandbox);
    expect(before.errors.some((error) => error.includes('هم‌خوان نیستند'))).toBe(true);

    syncAll(sandbox);
    const after = checkWorklog(sandbox);
    expect(after.errors).toEqual([]);

    const worklog = fs.readFileSync(path.join(sandbox, 'WORKLOG.md'), 'utf8');
    expect(worklog).toContain('logs/pending/1405-07-29_16-30-00_alireza_push-test.md');
    expect(worklog).toContain('⏳ Pending: **۱**');
  });

  it('سربرگ تولیدشده با فراداده ناهم‌خوان باشد تشخیص داده می‌شود', () => {
    const { file } = createLog(sandbox, {
      author: 'توحید',
      activity: 'Commit',
      title: 'تست',
      topic: 'header',
      body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن: این متن باید بیش از شصت کاراکتر باشد تا اعتبارسنجی قبول کند.',
    });
    const raw = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, raw.replace('| **وضعیت فعلی** |', '| **وضعیت فعلی** (دستی تغییر کرد) |'), 'utf8');

    const log = readAllLogs(sandbox).find((item) => item.file === file);
    expect(log).toBeTruthy();
    expect(validateLog(log!).join('\n')).toContain('worklog:sync');
    expect(renderLogHeader(log!.meta)).not.toContain('دستی تغییر کرد');
  });

  it('پوشه‌ای که با وضعیت نمی‌خواند خطا می‌دهد', () => {
    const { file, id } = createLog(sandbox, {
      author: 'توحید',
      activity: 'Commit',
      title: 'تست',
      topic: 'move',
      body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن: این متن باید بیش از شصت کاراکتر باشد تا اعتبارسنجی قبول کند.',
    });
    fs.renameSync(file, path.join(sandbox, `logs/archive/${id}.md`));

    const log = readAllLogs(sandbox).find((item) => item.meta.id === id);
    expect(validateLog(log).join('\n')).toContain('با پوشه');
  });

  it('ساخت دوباره فایل، بلوک چرخه عمر را تکراری نمی‌کند (idempotent)', () => {
    const { file, meta } = createLog(sandbox, {
      author: 'توحید',
      activity: 'Commit',
      title: 'تست تکرار',
      topic: 'idempotent',
      body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن: این متن باید بیش از شصت کاراکتر باشد تا اعتبارسنجی قبول کند.',
    });

    const first = fs.readFileSync(file, 'utf8');
    const log = readAllLogs(sandbox).find((item) => item.file === file);
    fs.writeFileSync(file, composeLogFile(log!.meta, log!.body), 'utf8');
    const second = fs.readFileSync(file, 'utf8');

    expect(second).toBe(first);
    expect(second.match(/گزارش فعالیت تیمی — /g)).toHaveLength(1);
    expect(second.match(/WORKLOG:LOG-HEADER:START/g)).toHaveLength(1);
    expect(meta.id).toBe(log!.meta.id);
  });

  it('شناسه تکراری در دو پوشه گزارش می‌شود', () => {
    const { file, id } = createLog(sandbox, {
      author: 'توحید',
      activity: 'Commit',
      title: 'تست',
      topic: 'dup',
      body: 'شرح کامل کار انجام‌شده برای عبور از حداقل طول متن: این متن باید بیش از شصت کاراکتر باشد تا اعتبارسنجی قبول کند.',
    });
    fs.copyFileSync(file, path.join(sandbox, `logs/archive/${id}.md`));
    const { errors } = checkWorklog(sandbox);
    expect(errors.join('\n')).toContain('شناسه تکراری');
  });
});
