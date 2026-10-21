import { describe, expect, it, vi } from 'vitest';
import {
  acceptSnapshot,
  canPublishPresence,
  isPresenceSnapshot,
  parsePresenceFrame,
  PRESENCE_OFFLINE_TIMEOUT_MS,
  PRESENCE_SEND_INTERVAL_MS,
  type PresenceSnapshot,
} from '../../src/engine3d/presence/types';
import { PresenceTracker } from '../../src/engine3d/presence/presence-tracker';
import { RemotePlayer } from '../../src/engine3d/presence/RemotePlayer';
import { RemotePlayerManager } from '../../src/engine3d/presence/RemotePlayerManager';
import { createPresenceHttpTransport } from '../../src/engine3d/presence/usePresence';

function snapshot(
  playerId: string,
  updatedAt: number,
  overrides: Partial<PresenceSnapshot['transform']> = {},
): PresenceSnapshot {
  return {
    playerId,
    updatedAt,
    transform: {
      x: 1,
      y: 1.65,
      z: -2,
      yawDeg: 0,
      pitchDeg: 0,
      ...overrides,
    },
  };
}

describe('فاز ۰۴ — حضور بازیکن در کلاینت', () => {
  it('snapshot سالم را اعتبارسنجی و snapshot ناقص یا نامتناهی را رد می‌کند', () => {
    expect(isPresenceSnapshot(snapshot('player-1', 100))).toBe(true);
    expect(isPresenceSnapshot({ ...snapshot('player-1', 100), updatedAt: Number.NaN })).toBe(false);
    expect(isPresenceSnapshot(snapshot('', 100))).toBe(false);
    expect(isPresenceSnapshot({ playerId: 'p', updatedAt: 10, transform: { x: Infinity } })).toBe(false);
    expect(isPresenceSnapshot({ ...snapshot('p', 10), playerName: 7 })).toBe(false);
  });

  it('ارسال را به حداکثر ۱۰ بار در ثانیه محدود می‌کند', () => {
    expect(PRESENCE_SEND_INTERVAL_MS).toBe(100);
    expect(canPublishPresence(1_000, 900)).toBe(true);
    expect(canPublishPresence(1_099, 1_000)).toBe(false);
    expect(canPublishPresence(1_100, 1_000)).toBe(true);
  });

  it('به‌روزرسانی قدیمی‌تر را برای بازیکن نادیده می‌گیرد', () => {
    const latest = snapshot('player-1', 500);
    expect(acceptSnapshot(latest, snapshot('player-1', 499))).toBe(false);
    expect(acceptSnapshot(latest, snapshot('player-1', 500, { x: 3 }))).toBe(true);
  });

  it('بازیکن محلی را پنهان می‌کند و بازیکن بی‌فعالیت را پس از ۳۰ ثانیه حذف می‌کند', () => {
    const tracker = new PresenceTracker();
    tracker.updateMany([
      snapshot('me', 1_000),
      snapshot('teammate', 1_000, { x: 4 }),
      { playerId: 'invalid', updatedAt: 1_000, transform: null },
    ]);
    expect(tracker.getOnline(1_001, 'me').map((player) => player.playerId)).toEqual(['teammate']);
    expect(PRESENCE_OFFLINE_TIMEOUT_MS).toBe(30_000);
    expect(tracker.getOnline(31_000, 'me')).toEqual([]);
  });

  it('RemotePlayer از snapshot پیروی می‌کند و حرکت را نرم می‌کند', () => {
    const remote = new RemotePlayer(snapshot('teammate', 100));
    expect(remote.position.x).toBe(1);
    expect(remote.position.y).toBeCloseTo(0);
    remote.setSnapshot(snapshot('teammate', 200, { x: 5, z: -6, yawDeg: 90 }));
    remote.update(1 / 60);
    expect(remote.position.x).toBeGreaterThan(1);
    expect(remote.position.x).toBeLessThan(5);
    expect(remote.position.z).toBeLessThan(-2);
    expect(remote.rotation.y).toBeGreaterThan(0);
    remote.dispose();
  });

  it('فریم سرور با مختصات و yaw رادیانی را به transform کلاینت تبدیل می‌کند', () => {
    const frame = parsePresenceFrame({
      presences: [{
        playerId: 'seat-2',
        playerName: 'هم‌تیمی',
        seatIndex: 1,
        position: { x: 2, y: 1.65, z: -4 },
        yaw: Math.PI / 2,
        phase: 'alley_puzzle',
        lastUpdate: 1_000,
      }],
      serverNow: 1_001,
    });
    expect(frame).toHaveLength(1);
    expect(frame[0]).toMatchObject({
      playerId: 'seat-2',
      playerName: 'هم‌تیمی',
      seatIndex: 1,
      phase: 'alley_puzzle',
      updatedAt: 1_000,
      transform: { x: 2, y: 1.65, z: -4, yawDeg: 90, pitchDeg: 0 },
    });
    expect(parsePresenceFrame({ presences: [{ playerId: 'bad' }] })).toEqual([]);
  });

  it('ترنسپورت حضور قرارداد سرور را با موقعیت و yaw رادیانی می‌نویسد', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const transport = createPresenceHttpTransport('room/1', 'seat-secret');
      await transport.publish(snapshot('ignored-client-id', 10, { yawDeg: 90 }), 'theater_cutscene');
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/rooms/room%2F1/presence');
      expect(options.headers).toMatchObject({ 'X-Seat-Token': 'seat-secret' });
      expect(JSON.parse(String(options.body))).toEqual({
        position: { x: 1, y: 1.65, z: -2 },
        yaw: Math.PI / 2,
        phase: 'theater_cutscene',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('مدیر بازیکنان چند peer را اضافه، به‌روز و با پایان حضور حذف می‌کند', () => {
    const manager = new RemotePlayerManager();
    const mine = snapshot('me', 1_000);
    const peer = { ...snapshot('peer', 1_000, { x: 3 }), playerName: 'هم‌تیمی اول' };
    const secondPeer = { ...snapshot('peer-two', 1_000, { x: -3 }), playerName: 'هم‌تیمی دوم' };
    expect(manager.sync([mine, peer, secondPeer], 1_001, 'me')).toEqual({ added: 2, updated: 0, removed: 0 });
    expect(manager.size).toBe(2);
    expect(manager.getPlayer('peer')?.userData.displayName).toBe('هم‌تیمی اول');

    const movedPeer = snapshot('peer', 1_100, { x: 5 });
    expect(manager.sync([movedPeer, secondPeer], 1_101, 'me')).toEqual({ added: 0, updated: 2, removed: 0 });
    manager.update(1 / 60);
    expect(manager.getPlayer('peer')?.position.x).toBeGreaterThan(3);

    expect(manager.sync([movedPeer, secondPeer], 31_101, 'me')).toEqual({ added: 0, updated: 0, removed: 2 });
    expect(manager.size).toBe(0);
    manager.dispose();
  });
});
