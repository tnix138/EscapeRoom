import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { run } from '../../scripts/worklog/lib/cli.mjs';
import {
  checkWorklog,
  composeLogFile,
  normalizeReaderDetails,
  readAllLogs,
  syncWorklog,
  validateLog,
} from '../../scripts/worklog/lib/registry.mjs';

const ROOT = path.resolve(__dirname, '../..');
let sandbox: string;

function makeSandbox() {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'worklog-reader-summary-'));
  fs.copyFileSync(path.join(ROOT, 'WORKLOG.md'), path.join(sandbox, 'WORKLOG.md'));
  fs.mkdirSync(path.join(sandbox, 'logs/pending'), { recursive: true });
  fs.mkdirSync(path.join(sandbox, 'logs/archive'), { recursive: true });
  return sandbox;
}

afterEach(() => {
  vi.restoreAllMocks();
  if (sandbox) fs.rmSync(sandbox, { recursive: true, force: true });
});

const READER_FLAGS = [
  '--what-done', 'فرم رزرو حالا خطای هر فیلد را کنار همان ورودی نشان می‌دهد.',
  '--user-result', 'بازیکن می‌فهمد کدام نام یا تعداد را باید اصلاح کند و فرم را دوباره می‌فرستد.',
  '--verification', 'تست رزرو و بررسی typecheck موفق شدند.',
  '--remaining', 'ورود سه‌بعدی بازیکنان در این تغییر انجام نشد.',
];

describe('خلاصهٔ روشن لاگ برای خواننده', () => {
  it('ساخت لاگ بدون چهار توضیح روشن را هم در new و هم در push متوقف می‌کند', () => {
    const root = makeSandbox();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(run(['new', '--author', 'توحید', '--slug', 'tohid', '--activity', 'Commit'], root)).toBe(1);
    expect(run(['push', '--author', 'توحید', '--slug', 'tohid'], root)).toBe(1);
    expect(fs.readdirSync(path.join(root, 'logs/pending'))).toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(4);
  });

  it('لاگ جدید خلاصهٔ روشن، نتیجه، بررسی و موارد باقی‌مانده را بالای متن فنی نشان می‌دهد', () => {
    const root = makeSandbox();
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = run([
      'new',
      '--author', 'توحید',
      '--slug', 'tohid',
      '--activity', 'Commit',
      '--title', 'اصلاح فرم رزرو',
      '--topic', 'reservation-validation',
      '--ref', 'شاخه آزمایشی',
      '--no-sync',
      ...READER_FLAGS,
    ], root);
    expect(exitCode).toBe(0);

    const logs = readAllLogs(root);
    expect(logs).toHaveLength(1);
    const [log] = logs;
    expect(Number(log.meta.format_version)).toBe(2);
    expect(log.meta.what_done).toBe(READER_FLAGS[1]);
    expect(log.raw).toContain('## 👀 توضیح روشن برای خواننده');
    expect(log.raw).toContain('**چه کاری انجام شد؟**');
    expect(log.raw).toContain('**نتیجه برای کاربر چیست؟**');
    expect(log.raw).toContain('**چطور بررسی شد؟**');
    expect(log.raw).toContain('**چه چیزی باقی مانده؟**');
    expect(log.raw).toContain('تست رزرو و بررسی typecheck موفق شدند.');
    expect(log.raw).toContain('ورود سه‌بعدی بازیکنان در این تغییر انجام نشد.');
    expect(log.raw).not.toContain('<اینجا');
    expect(validateLog(log)).toEqual([]);
    expect(composeLogFile(log.meta, log.body)).toBe(log.raw);
    syncWorklog(root);
    expect(checkWorklog(root).errors).toEqual([]);
  });

  it('گزارش push را با تغییر واقعی فایل‌ها و توضیح خواننده می‌سازد', () => {
    const root = makeSandbox();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    execFileSync('git', ['init', '-b', 'log-test'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Worklog Test'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'worklog@example.test'], { cwd: root });
    fs.writeFileSync(path.join(root, 'feature.txt'), 'before\\n', 'utf8');
    execFileSync('git', ['add', 'feature.txt', 'WORKLOG.md'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'پایهٔ آزمایش'], { cwd: root, stdio: 'ignore' });
    fs.writeFileSync(path.join(root, 'feature.txt'), 'after\\n', 'utf8');
    execFileSync('git', ['add', 'feature.txt'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'تغییر نمونه'], { cwd: root, stdio: 'ignore' });

    const exitCode = run(['push', '--author', 'توحید', '--slug', 'tohid', '--no-sync', ...READER_FLAGS], root);
    expect(exitCode).toBe(0);
    const [log] = readAllLogs(root);
    expect(log.meta.summary).toContain('فرم رزرو');
    expect(log.raw).toContain('بازیکن می‌فهمد کدام نام یا تعداد را باید اصلاح کند');
    expect(log.raw).toContain('## 👀 توضیح روشن برای خواننده');
    expect(log.body).toContain('### 📦 کامیت‌های موجود در این پوش');
    expect(log.body).toContain('| `ریشه پروژه (md/config)` | 1 |');
  });

  it('متن خالی، کوتاه یا جای‌نگهدار را برای توضیحات اصلی رد می‌کند', () => {
    expect(() => normalizeReaderDetails('', 'نتیجهٔ کافی و مشخص برای کاربر نوشته شده است.', 'دوازده تست پاس شد.', 'موردی باقی نمانده است.')).toThrow(/چه کاری انجام شد/);
    expect(() => normalizeReaderDetails('تغییرات انجام شد', 'نتیجهٔ کافی و مشخص برای کاربر نوشته شده است.', 'دوازده تست پاس شد.', 'موردی باقی نمانده است.')).toThrow(/دست‌کم 24 نویسه/);
    expect(() => normalizeReaderDetails('اینجا دقیقاً توضیح بده چه تغییری انجام شده.', 'نتیجهٔ کافی و مشخص برای کاربر نوشته شده است.', 'دوازده تست پاس شد.', 'موردی باقی نمانده است.')).toThrow(/جای‌نگهدار/);
  });
});
