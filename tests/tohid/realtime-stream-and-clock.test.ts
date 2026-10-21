// تست موج ۳: ساعت کالیبره‌شده سرور، انتشار بلادرنگ room-hub و استریم SSE
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  computeClockOffset,
  computeCutsceneElapsedMs,
} from '../../src/client-sdk/cutscene-clock';
import { ONLINE_WINDOW_MS, projectRoomView } from '../../src/engine/view-projector';
import { SqliteRoomRepository } from '../../src/server/db/sqlite-repository';
import { roomListenerCount, subscribeRoom } from '../../src/server/realtime/room-hub';
import { shouldSendRoomViewUpdate } from '../../src/server/realtime/presence';
import {
  performGameAction,
  PRESENCE_REFRESH_INTERVAL_MS,
  reserveRoom,
  touchSeatPresence,
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

describe('موج ۳ — حضور و اتصال مجدد بدون همگام‌سازی transform', () => {
  it('تغییر presence را حتی با نسخه برابر منتشر می‌کند و snapshot قدیمی را رد می‌کند', () => {
    expect(shouldSendRoomViewUpdate(8, 8, '110', '111')).toBe(true);
    expect(shouldSendRoomViewUpdate(8, 8, '110', '110')).toBe(false);
    expect(shouldSendRoomViewUpdate(7, 8, '110', '111')).toBe(false);
    expect(shouldSendRoomViewUpdate(9, 8, '110', '110')).toBe(true);
  });

  it('حضور را با cadence محدود تازه می‌کند، reconnect را آنلاین می‌کند و آخرین کلاینت آنلاین شدن هم‌تیمی را می‌بیند', async () => {
    const repo = new SqliteRoomRepository(path.join(tmpDir, 'presence.db'));
    const createdAt = 1_700_000_000_000;
    const reservation = await reserveRoom(
      { playerCount: 3, playerNames: ['توحید ۱', 'امیرعلی ۲', 'علیرضا ۳'] },
      repo,
      createdAt,
    );
    const token = reservation.invites[0]!.seatToken;
    const initial = await repo.getRoom(reservation.roomCode);
    expect(initial?.seats[0]?.joined).toBe(false);

    const publishedVersions: number[] = [];
    const teammateVersions: number[] = [];
    const unsubscribe = subscribeRoom(reservation.roomCode, (state) => {
      publishedVersions.push(state.version);
    });
    const unsubscribeTeammate = subscribeRoom(reservation.roomCode, (state) => {
      teammateVersions.push(state.version);
    });

    const firstTouchAt = createdAt + 5_000;
    const firstView = await touchSeatPresence(reservation.roomCode, token, repo, firstTouchAt);
    expect(firstView.me.joined).toBe(true);
    expect(firstView.me.isOnline).toBe(true);
    expect(firstView.me.lastSeenAt).toBe(firstTouchAt);
    const afterFirstTouch = await repo.getRoom(reservation.roomCode);
    expect(afterFirstTouch?.version).toBe((initial?.version ?? 0) + 1);

    // Duplicate tabs/requests within the lease don't write or publish a room version each tick.
    await touchSeatPresence(
      reservation.roomCode,
      token,
      repo,
      firstTouchAt + PRESENCE_REFRESH_INTERVAL_MS - 1,
    );
    expect((await repo.getRoom(reservation.roomCode))?.version).toBe(afterFirstTouch?.version);

    // Concurrent reconnect/heartbeat attempts converge to one OCC write.
    const refreshAt = firstTouchAt + PRESENCE_REFRESH_INTERVAL_MS;
    const [reconnectedView, duplicateView] = await Promise.all([
      touchSeatPresence(reservation.roomCode, token, repo, refreshAt),
      touchSeatPresence(reservation.roomCode, token, repo, refreshAt),
    ]);
    expect(reconnectedView.me.isOnline).toBe(true);
    expect(duplicateView.me.lastSeenAt).toBe(refreshAt);
    const afterReconnect = await repo.getRoom(reservation.roomCode);
    expect(afterReconnect?.version).toBe((afterFirstTouch?.version ?? 0) + 1);
    expect(afterReconnect?.seats[0]?.lastSeenAt).toBe(refreshAt);
    expect(publishedVersions).toEqual([afterFirstTouch!.version, afterReconnect!.version]);
    expect(teammateVersions).toEqual(publishedVersions);

    // Online status expires from its lease even though no movement/world state was persisted.
    const expiredView = projectRoomView(afterReconnect!, 0, refreshAt + ONLINE_WINDOW_MS + 1);
    expect(expiredView.me.isOnline).toBe(false);
    expect(JSON.stringify(afterReconnect)).not.toMatch(/position|transform|movement/i);

    unsubscribe();
    unsubscribeTeammate();
    repo.close();
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
    expect(roomListenerCount(reservation.roomCode)).toBe(0);
  });
});
