// تست کاوش پایدار سالن تاریک (موج ۹) و امنیت چت/نام/نرخ درخواست (موج ۱۰)
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { AuditoriumHotspotId } from '../../src/contracts/types';
import { projectRoomView } from '../../src/engine/view-projector';
import { checkAndRecord, isRateLimited, resetRateLimits } from '../../src/server/auth/rate-limit';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  CHAT_RATE_LIMIT_MAX,
  CHAT_RATE_LIMIT_WINDOW_MS,
  performGameAction,
  reserveRoom,
  sanitizePlayerName,
  sendChatMessage,
} from '../../src/server/services/room-service';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-wave9-10-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const ALL_HOTSPOTS: readonly AuditoriumHotspotId[] = [
  'shattered-chandelier',
  'crooked-paintings',
  'three-dark-stages',
  'locked-exit-doors',
];

describe('موج ۹ — کاوش پایدار چندنفره، idempotency و مصونیت وضعیت داخلی', () => {
  it('بررسی همزمان همهٔ هات‌اسپات‌ها توسط ۸ بازیکن بدون تکرار نام، پایدار در ری‌استارت و مصون از دستکاری نمای خروجی است', async () => {
    resetRateLimits();
    const dbPath = path.join(tmpDir, 'hotspots-8p.db');
    let repo = new SqliteRoomRepository(dbPath);
    const names = ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳', 'سارا ۴', 'مریم ۵', 'نیما ۶', 'لیلا ۷', 'کیان ۸'];

    try {
      const reservation = await reserveRoom({ playerCount: 8, playerNames: names }, repo);

      // پیش از ورود به سالن تاریک، بررسی هات‌اسپات با INVALID_PHASE رد می‌شود
      await expect(
        performGameAction(
          reservation.roomCode,
          reservation.invites[0]!.seatToken,
          { type: 'INSPECT_AUDITORIUM_HOTSPOT', hotspotId: 'shattered-chandelier' },
          repo,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_PHASE', status: 409 });

      // انتقال اتاق به سالن تاریک پس از پایان کات‌سین
      const stored = await repo.getRoom(reservation.roomCode);
      const startedAt = Date.now() - 80_000;
      stored!.phase = 'in_theater';
      stored!.cutsceneStartedAt = startedAt;
      stored!.restartedInTheaterAt = startedAt + 74_000;
      await repo.saveRoomIfVersion(stored!, stored!.version);

      // بررسی همزمان هر ۸ نفر + تکرار idempotent صندلی اول
      await Promise.all([
        ...reservation.invites.map((invite, idx) =>
          performGameAction(
            reservation.roomCode,
            invite.seatToken,
            {
              type: 'INSPECT_AUDITORIUM_HOTSPOT',
              hotspotId: ALL_HOTSPOTS[idx % ALL_HOTSPOTS.length]!,
            },
            repo,
          ),
        ),
        performGameAction(
          reservation.roomCode,
          reservation.invites[0]!.seatToken,
          { type: 'INSPECT_AUDITORIUM_HOTSPOT', hotspotId: 'shattered-chandelier' },
          repo,
        ),
      ]);

      // بستن و باز کردن مجدد SQLite برای اثبات ماندگاری کامل پیشرفت اکتشاف
      repo.close();
      repo = new SqliteRoomRepository(dbPath);
      const reloaded = await repo.getRoom(reservation.roomCode);
      expect(reloaded).not.toBeNull();
      expect(reloaded!.inspectedHotspots['shattered-chandelier']).toEqual(['توحید ۱', 'مریم ۵']);
      expect(reloaded!.inspectedHotspots['crooked-paintings']).toEqual(['امیرعلی ۲', 'نیما ۶']);
      expect(reloaded!.inspectedHotspots['three-dark-stages']).toEqual(['علیرضا ۳', 'لیلا ۷']);
      expect(reloaded!.inspectedHotspots['locked-exit-doors']).toEqual(['سارا ۴', 'کیان ۸']);

      // دستکاری آرایه‌های خروجی ClientRoomView هرگز وضعیت داخلی سرور را آلوده نمی‌کند
      const projected = projectRoomView(reloaded!, 0, Date.now());
      projected.auditorium!.inspectedHotspots['shattered-chandelier'].push('بازیکن جعلی');
      expect(reloaded!.inspectedHotspots['shattered-chandelier']).not.toContain('بازیکن جعلی');
    } finally {
      repo.close();
    }
  });
});

describe('موج ۱۰ — امنیت چت، شناسه‌های یکتا، نرخ درخواست و ضدجعل نام فارسی', () => {
  it('نیم‌فاصله فارسی حفظ می‌شود اما کاراکترهای مخفی جعل نام و تغییر جهت حذف می‌شوند', async () => {
    expect(sanitizePlayerName('امیر\u200Cعلی')).toBe('امیر\u200Cعلی');
    expect(sanitizePlayerName('\u202Eسارا\u200B')).toBe('سارا');

    const repo = new SqliteRoomRepository(path.join(tmpDir, 'spoof-names.db'));
    try {
      await expect(
        reserveRoom(
          { playerCount: 3, playerNames: ['سارا الف', 'سارا الف\u200B', 'کیان ب'] },
          repo,
        ),
      ).rejects.toThrow();
    } finally {
      repo.close();
    }
  });

  it('پیام‌های هم‌میلی‌ثانیه شناسه یکتا دارند، joined را فعال می‌کنند و سیل پیام با 429 مهار می‌شود', async () => {
    resetRateLimits();
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'chat-security.db'));
    const fixedNow = 1_700_500_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    try {
      const reservation = await reserveRoom(
        { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
        repo,
        fixedNow,
      );
      const token0 = reservation.invites[0]!.seatToken;

      // ارسال دو پیام در یک میلی‌ثانیه واحد + اشتراک کوپن
      await sendChatMessage(reservation.roomCode, token0, { text: 'پیام اول', shareStub: true }, repo);
      const viewAfterSecond = await sendChatMessage(
        reservation.roomCode,
        token0,
        { text: 'پیام دوم' },
        repo,
      );
      expect(viewAfterSecond.me.joined).toBe(true);
      expect(viewAfterSecond.me.isOnline).toBe(true);
      const ids = viewAfterSecond.messages.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);

      // پر کردن سقف نرخ پیام صندلی در پنجره ۱۰ ثانیه‌ای
      for (let i = 2; i < CHAT_RATE_LIMIT_MAX; i++) {
        await sendChatMessage(reservation.roomCode, token0, { text: `نجوا ${i}` }, repo);
      }
      await expect(
        sendChatMessage(reservation.roomCode, token0, { text: 'سیل پیام اضافی' }, repo),
      ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });

      // پس از عبور از پنجره زمانی، ارسال پیام دوباره آزاد و باکت منقضی پاک‌سازی می‌شود
      nowSpy.mockReturnValue(fixedNow + CHAT_RATE_LIMIT_WINDOW_MS + 1);
      const recovered = await sendChatMessage(
        reservation.roomCode,
        token0,
        { text: 'پیام پس از پنجره' },
        repo,
      );
      expect(recovered.messages.at(-1)?.text).toBe('پیام پس از پنجره');

      resetRateLimits();
      expect(checkAndRecord('ephemeral:key', 1, 1_000, 100)).toBe(true);
      expect(isRateLimited('ephemeral:key', 1, 1_000, 2_000)).toBe(false);
    } finally {
      repo.close();
      nowSpy.mockRestore();
    }
  });
});
