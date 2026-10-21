// تست پوشش اسمک‌تست انتشار (Issue #87 / #88)
// اسمک‌تست باید کل مسیر بازی را بپیماید، نه فقط /api/health. هر مرحله‌ای که
// حذف شود، این تست قرمز می‌شود تا پوشش QA بی‌صدا آب نرود.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(path.join(process.cwd(), 'scripts/smoke-test.mjs'), 'utf8');

describe('اسمک‌تست انتشار — پوشش مسیر کامل', () => {
  it('سلامت، ساخت اتاق و خواندن وضعیت را می‌سنجد', () => {
    expect(source).toContain("'/api/health'");
    expect(source).toContain("'/api/rooms'");
    expect(source).toContain('رویداد room_update');
  });

  it('قرارداد حضور بعد از ادغام را با شکل درست می‌سنجد', () => {
    // پاسخ `{ presences, serverNow }` است؛ assert روی `accepted` دیگر معتبر نیست
    expect(source).not.toContain('accepted === true,\n    \'ثبت حضور بازیکن\'');
    expect(source).toContain('Array.isArray(presenceFrame?.presences)');
    expect(source).toContain('typeof presenceFrame?.serverNow === \'number\'');
  });

  it('معمای بلیط و باز شدن در را با هم‌کاری سه بازیکن انجام می‌دهد', () => {
    expect(source).toContain('PUNCH_MY_TICKET');
    expect(source).toContain('companionStub');
    expect(source).toContain('UNLOCK_THEATER_DOOR');
    expect(source).toContain("phase === 'door_cutscene'");
  });

  it('قفل تعامل در کات‌سین و مسیر کامل تا سالن تاریک را می‌سنجد', () => {
    expect(source).toContain("assert(locked.status === 409");
    expect(source).toContain('SMOKE_FULL_PATH');
    expect(source).toContain("phase === 'in_theater'");
  });

  it('صفحه‌های پیش‌نمایش و نگهبان پنل ادمین را چک می‌کند', () => {
    expect(source).toContain("'/preview/alley'");
    expect(source).toContain("'/preview/auditorium'");
    expect(source).toContain("'/admin/login'");
    expect(source).toContain("'/admin'");
    expect(source).toContain('redirect: \'manual\'');
  });
});
