import { describe, expect, it } from 'vitest';
import {
  acceptSnapshot,
  canPublishPresence,
  isPresenceSnapshot,
  PRESENCE_OFFLINE_TIMEOUT_MS,
  PRESENCE_SEND_INTERVAL_MS,
  type PresenceSnapshot,
} from '../../src/engine3d/presence/types';
import { PresenceTracker } from '../../src/engine3d/presence/presence-tracker';
import { RemotePlayer } from '../../src/engine3d/presence/RemotePlayer';

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
});
