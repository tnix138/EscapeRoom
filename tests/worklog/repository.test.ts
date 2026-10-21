import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkWorklog, readAllLogs } from '../../scripts/worklog/lib/registry.mjs';

const ROOT = path.resolve(__dirname, '../..');

describe('لاگ واقعی مخزن', () => {
  const { errors, logs } = checkWorklog(ROOT);

  it('همه فایل‌های logs/ معتبر و هم‌خوان با WORKLOG.md هستند', () => {
    expect(errors).toEqual([]);
  });

  it('دست‌کم یک لاگ Pending و یک لاگ Archive موجود است', () => {
    expect(logs.some((log) => log.meta.status === 'pending')).toBe(true);
    expect(logs.some((log) => log.meta.status === 'archive')).toBe(true);
  });

  it('هر لاگ Archive هم «آرشیو شده توسط» و هم زمان آرشیو دارد', () => {
    for (const log of logs.filter((item) => item.meta.status === 'archive')) {
      expect(log.meta.archived_by, log.relPath).toBeTruthy();
      expect(log.meta.archived_at_jalali, log.relPath).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(log.meta.archived_at_time, log.relPath).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(log.meta.archived_at_utc, log.relPath).toMatch(/Z$/);
    }
  });

  it('هر لاگ Pending و Archive «ساخته‌شده توسط» و زمان ساخت دارد', () => {
    for (const log of logs) {
      expect(log.meta.created_by, log.relPath).toBeTruthy();
      expect(log.meta.created_at_utc, log.relPath).toMatch(/Z$/);
      expect(log.meta.created_at_jalali, log.relPath).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('بلوک چرخه عمر در همه فایل‌ها وجود دارد', () => {
    for (const log of logs) {
      expect(log.raw, log.relPath).toContain('🔁 چرخه عمر لاگ');
    }
  });

  it('هوک‌های گیت و ورک‌فلو CI برای سیستم لاگ وجود دارند', () => {
    expect(fs.existsSync(path.join(ROOT, '.githooks/pre-push'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, '.githooks/commit-msg'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, '.github/workflows/worklog.yml'))).toBe(true);
  });

  it('هوک commit-msg پیام فارسی را الزام می‌کند', () => {
    const hook = fs.readFileSync(path.join(ROOT, '.githooks/commit-msg'), 'utf8');
    expect(hook).toContain('پیام کامیت باید فارسی باشد');
    expect(hook).toContain('u0600');
  });
});
