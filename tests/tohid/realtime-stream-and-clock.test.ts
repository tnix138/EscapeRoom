// تست موج ۳: ساعت کالیبره‌شده سرور، انتشار بلادرنگ room-hub و استریم SSE
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  computeClockOffset,
  computeCutsceneElapsedMs,
} from '../../src/client-sdk/cutscene-clock';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { roomListenerCount, subscribeRoom } from '../../src/server/realtime/room-hub';
import {
  performGameAction,
  reserveRoom,
} from '../../src/server/services/room-service';
import { resetRateLimits } from '../../src/server/auth/rate-limit';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'escaperoom-wave3-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

describe('موج ۳ — همگام‌سازی میلی‌ثانیه‌ای کات‌سین با ساعت سرور', () => {
  it('با clockOffset، همه کلاینت‌ها با ساعت‌های محلی متفاوت به یک elapsed واحد می‌رسند', () => {
    const serverStart = 1_700_000_000_000;
    const serverNow = serverStart + 45_300; // ثانیه ۴۵٫۳ کات‌سین
    // دو کلاینت با ساعت محلی عقب/جلو نسبت به سرور
    for (const skew of [-5_000, -250, 0, 900, 12_000]) {
      const clientNow = serverNow - skew; // ساعت کلاینت skew میلی‌ثانیه از سرور عقب است
      const offset = computeClockOffset(serverNow, clientNow);
      expect(computeCutsceneElapsedMs(serverStart, offset, clientNow)).toBe(45_300);
    }
  });

  it('elapsed قبل از شروع صفر و بعد از ۷۴ ثانیه روی سقف قفل می‌شود (رفرش وسط کات‌سین)', () => {
    const start = 1_000_000;
    expect(computeCutsceneElapsedMs(null, 0, start)).toBe(0);
    expect(computeCutsceneElapsedMs(start, 0, start - 500)).toBe(0);
    expect(computeCutsceneElapsedMs(start, 0, start + 45_300)).toBe(45_300);
    expect(computeCutsceneElapsedMs(start, 0, start + 999_999)).toBe(74_000);
  });
});

describe('موج ۳ — انتشار بلادرنگ و استریم SSE', () => {
  it('هر اکشن موفق بلافاصله به شنونده‌های اتاق منتشر می‌شود و پس از unsubscribe قطع می‌شود', async () => {
    resetRateLimits();
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'hub.db'));
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
      repo,
    );
    const seenVersions: number[] = [];
    const unsubscribe = subscribeRoom(reservation.roomCode, (s) => seenVersions.push(s.version));
    expect(roomListenerCount(reservation.roomCode)).toBe(1);

    const state = await repo.getRoom(reservation.roomCode);
    const t = state!.targets[0]!;
    await performGameAction(
      reservation.roomCode,
      reservation.invites[0]!.seatToken,
      { type: 'PUNCH_MY_TICKET', emblem: t.targetEmblem, actNumber: t.targetAct, rowCode: t.targetRowCode },
      repo,
    );
    expect(seenVersions.length).toBeGreaterThanOrEqual(1);
    unsubscribe();
    expect(roomListenerCount(reservation.roomCode)).toBe(0);
    repo.close();
  });

  it('اندپوینت SSE بلافاصله room_update با نمای امن همان صندلی می‌فرستد', async () => {
    process.env.ESCAPEROOM_DB_PATH = path.join(tmpDir, 'sse.db');
    const { GET } = await import('../../src/app/api/rooms/[code]/stream/route');
    const { getRoomRepository } = await import('../../src/server/db/repository');
    const repo = getRoomRepository();
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
      repo,
    );
    const token = reservation.invites[1]!.seatToken;
    const res = await GET(
      new Request(
        `http://localhost/api/rooms/${reservation.roomCode}/stream?token=${encodeURIComponent(token)}`,
      ),
      { params: Promise.resolve({ code: reservation.roomCode }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    expect(chunk).toContain('event: room_update');
    const payload = JSON.parse(chunk.split('data: ')[1]!.trim()) as {
      roomView: { me: { playerName: string }; myHeldTickets: { mainTicket: { revealedGoldenDigit: number | null } } };
    };
    // نمای استریم متعلق به صندلی دوم است و جواب مخفی نشت نمی‌کند
    expect(payload.roomView.me.playerName).toBe('امیرعلی ۲');
    expect(payload.roomView.myHeldTickets.mainTicket.revealedGoldenDigit).toBeNull();
    await reader.cancel();
  });
});
