import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  activeSharedStreamCount,
  canonicalRoomStreamKey,
  openSharedRoomStream,
  postRoomWhisper,
} from '../../src/client-sdk/index';
import { THEATER_EMBLEMS, emblemLabelFa } from '../../src/engine/ticket-puzzle';
import { resetRateLimits } from '../../src/server/auth/rate-limit';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import {
  reserveRoom,
  sanitizeChatMessage,
  sendChatMessage,
} from '../../src/server/services/room-service';

const ROOT = path.resolve(__dirname, '../..');
const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-whisper-fix-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

describe('نجوای گروهی — رفع گیر کردن ارسال پیام و اشتراک معماهای هم‌تیمی‌ها', () => {
  it('اشتراک یک EventSource واحد بین هوک اتاق و هوک حضور برای جلوگیری از اشباع ۶ سوکت مرورگر', async () => {
    let createdCount = 0;
    let closedCount = 0;
    const handlers = new Map<string, EventListener>();

    class FakeEventSource {
      url: string;
      constructor(url: string) {
        createdCount += 1;
        this.url = url;
      }
      addEventListener(type: string, fn: EventListener) {
        handlers.set(type, fn);
      }
      removeEventListener(type: string) {
        handlers.delete(type);
      }
      close() {
        closedCount += 1;
      }
    }

    const urlSession = '/api/rooms/AB12CD/stream?token=tok_1234567890123456&sinceVersion=0';
    const urlPresence = '/api/rooms/AB12CD/stream?token=tok_1234567890123456';
    expect(canonicalRoomStreamKey(urlSession)).toBe(canonicalRoomStreamKey(urlPresence));

    const handleA = openSharedRoomStream(
      urlSession,
      FakeEventSource as unknown as typeof EventSource,
    );
    const handleB = openSharedRoomStream(
      urlPresence,
      FakeEventSource as unknown as typeof EventSource,
    );

    expect(createdCount).toBe(1);
    expect(activeSharedStreamCount()).toBe(1);

    const receivedRoomUpdates: string[] = [];
    handleA?.addEventListener('room_update', (e) => {
      receivedRoomUpdates.push((e as MessageEvent<string>).data);
    });

    handlers.get('room_update')?.(
      new MessageEvent('room_update', { data: '{"version":3}' }),
    );
    expect(receivedRoomUpdates).toEqual(['{"version":3}']);

    // مشترک دیرهنگام آخرین فریم کش‌شده را فوراً می‌گیرد
    const lateReceived: string[] = [];
    handleB?.addEventListener('room_update', (e) => {
      lateReceived.push((e as MessageEvent<string>).data);
    });
    await Promise.resolve();
    expect(lateReceived).toEqual(['{"version":3}']);

    // بستن یکی از دو مشترک نباید اتصال مشترک را قطع کند
    handleA?.close();
    expect(closedCount).toBe(0);
    expect(activeSharedStreamCount()).toBe(1);

    // بستن آخرین مشترک اتصال را کامل آزاد می‌کند
    handleB?.close();
    expect(closedCount).toBe(1);
    expect(activeSharedStreamCount()).toBe(0);
  });

  it('ارسال کوپن معما (shareStub) نام فارسی نماد را می‌فرستد، تکراری نمی‌شود و با نام‌های بلند هم خطا نمی‌دهد', async () => {
    resetRateLimits();
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'coupon-share.db'));
    try {
      const reservation = await reserveRoom(
        {
          playerCount: 3,
          playerNames: [
            'امیرعلی محمدی طباطبایی',
            'علیرضا سلیمانی راد',
            'توحید حسینی نژاد',
          ],
        },
        repo,
      );
      const token0 = reservation.invites[0]!.seatToken;

      // همهٔ نمادها برچسب فارسی معتبر دارند (هیچ شناسهٔ انگلیسی خام در چت نمی‌رود)
      for (const emblem of THEATER_EMBLEMS) {
        expect(emblemLabelFa(emblem)).not.toBe(emblem);
        expect(emblemLabelFa(emblem)).toMatch(/[\u0600-\u06FF]/);
      }

      // ۱) اشتراک کوپن با متن خودکار بلند کلاینت -> فقط یک پیام کوپن تمیز با نماد فارسی ثبت می‌شود
      const afterAutoCoupon = await sendChatMessage(
        reservation.roomCode,
        token0,
        {
          text: 'کوپن من برای «علیرضا سلیمانی راد»: نماد «شمعدان»، پردهٔ «ورود نقاب‌داران به تالار آینه‌ها»',
          shareStub: true,
        },
        repo,
      );
      expect(afterAutoCoupon.messages).toHaveLength(1);
      expect(afterAutoCoupon.messages[0]?.type).toBe('ticket_share');
      expect(afterAutoCoupon.messages[0]?.text).toContain('علیرضا سلیمانی راد');
      for (const rawId of THEATER_EMBLEMS) {
        expect(afterAutoCoupon.messages[0]?.text).not.toContain(`«${rawId}»`);
      }

      // ۲) اشتراک کوپن با رشتهٔ خالی هم بدون خطای Zod پذیرفته می‌شود
      const afterEmptyStub = await sendChatMessage(
        reservation.roomCode,
        token0,
        { text: '', shareStub: true },
        repo,
      );
      expect(afterEmptyStub.messages).toHaveLength(2);
      expect(afterEmptyStub.messages[1]?.type).toBe('ticket_share');
    } finally {
      repo.close();
    }
  });

  it('پاک‌سازی متن نجوا سرنخ‌های معما (اعداد، گیومه و علامت‌ها) را حفظ و تگ‌های XSS را حذف می‌کند', async () => {
    expect(sanitizeChatMessage('  <شمعدان> — پردهٔ "۲" · ردیف III · رقم ۷  ')).toBe(
      '<شمعدان> — پردهٔ "۲" · ردیف III · رقم ۷',
    );
    expect(sanitizeChatMessage('<script>alert(1)</script>نماد نقاب')).toBe('alert(1)نماد نقاب');

    resetRateLimits();
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'clue-text.db'));
    try {
      const reservation = await reserveRoom(
        { playerCount: 3, playerNames: ['بازیکن الف', 'بازیکن ب', 'بازیکن ج'] },
        repo,
      );
      const token = reservation.invites[1]!.seatToken;
      const view = await sendChatMessage(
        reservation.roomCode,
        token,
        { text: '<ویولن> - پرده ۲ - کد ردیف IV - عدد طلایی من: ۹' },
        repo,
      );
      expect(view.messages.at(-1)?.text).toBe(
        '<ویولن> - پرده ۲ - کد ردیف IV - عدد طلایی من: ۹',
      );
    } finally {
      repo.close();
    }
  });

  it('postRoomWhisper روی خطای سرور خطا پرتاب می‌کند، روی خطای ۵۰۳ یک‌بار تلاش مجدد می‌کند و روی timeout هرگز آویزان نمی‌ماند', async () => {
    // ۱) خطای ۴۲۹ سرور دیگر بی‌صدا خورده نمی‌شود
    const fail429 = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'RATE_LIMITED', message: 'چند لحظه صبر کنید.' },
        }),
        { status: 429 },
      ),
    );
    await expect(
      postRoomWhisper('ABC123', 'tok_1234567890123456', 'سلام', false, {
        fetchImpl: fail429 as unknown as typeof fetch,
        timeoutMs: 200,
      }),
    ).rejects.toThrow('چند لحظه صبر کنید.');
    expect(fail429).toHaveBeenCalledTimes(1);

    // ۲) خطای گذرای ۵۰۳ در تلاش اول -> تلاش دوم موفق می‌شود
    let calls = 0;
    const transientThenOk = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('Bad Gateway', { status: 502 });
      }
      return new Response(
        JSON.stringify({ ok: true, data: { roomView: { roomCode: 'ABC123', version: 4 } } }),
        { status: 200 },
      );
    });
    const recovered = await postRoomWhisper('ABC123', 'tok_1234567890123456', 'سرنخ', false, {
      fetchImpl: transientThenOk as unknown as typeof fetch,
      timeoutMs: 200,
    });
    expect(calls).toBe(2);
    expect(recovered.version).toBe(4);

    // ۳) درخواست آویزان (بدون پاسخ) با timeout متوقف می‌شود و هرگز بی‌نهایت گیر نمی‌کند
    const hangingFetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortErr = new Error('The operation was aborted.');
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        }),
    );
    await expect(
      postRoomWhisper('ABC123', 'tok_1234567890123456', 'تست', false, {
        fetchImpl: hangingFetch as unknown as typeof fetch,
        timeoutMs: 40,
      }),
    ).rejects.toThrow('پاسخ سرور دیر شد');
    expect(hangingFetch).toHaveBeenCalledTimes(2);
  });

  it('نگهبان‌های ضدگیر در کامپوننت‌های چت، کوچه سه‌بعدی و حضور متصل‌اند', () => {
    const panel = readFileSync(path.join(ROOT, 'src/components/hud/WhisperChatPanel.tsx'), 'utf8');
    const alley3d = readFileSync(
      path.join(ROOT, 'src/components/alley/AlleyRoomThreeIntegration.tsx'),
      'utf8',
    );
    const presenceFeed = readFileSync(
      path.join(ROOT, 'src/components/hud/presence/use-presence-feed.ts'),
      'utf8',
    );

    expect(panel).toContain('WHISPER_SEND_WATCHDOG_MS');
    expect(alley3d).toContain('companionEmblemLabel');
    expect(alley3d).toContain('exitPointerLock');
    expect(presenceFeed).toContain('openSharedRoomStream');
    expect(presenceFeed).toContain('publishInFlight');
  });
});
