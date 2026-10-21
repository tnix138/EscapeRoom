// تست اتصال حضور به آواتارهای سه‌بعدی (فاز ۰۴ / قرارداد #104)
// معیار: قاب حضور HUD به snapshot موتور تبدیل می‌شود، بازیکن محلی حذف می‌شود،
// موقعیت نامعتبر آواتار نمی‌سازد، آواتار آفلاین بعد از ۳۰ ثانیه از صحنه حذف
// می‌شود، و صحنهٔ کوچه واقعاً مدیر آواتارها را mount می‌کند.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  toPresenceSnapshot,
  toPresenceSnapshots,
  type PresenceAvatarInput,
} from '../../src/client-sdk/presence-avatars';
import { RemotePlayerManager } from '../../src/engine3d/presence/RemotePlayerManager';
import { PRESENCE_OFFLINE_TIMEOUT_MS } from '../../src/engine3d/presence/types';

const NOW = 1_700_000_000_000;

const teammate = (overrides: Partial<PresenceAvatarInput> = {}): PresenceAvatarInput => ({
  playerId: 'seat-2',
  name: 'مریم',
  seatIndex: 1,
  position: { x: 1.5, y: 1.65, z: -3 },
  yawDeg: 42,
  phase: 'alley_puzzle',
  updatedAt: NOW - 200,
  ...overrides,
});

describe('toPresenceSnapshot — تبدیل قاب HUD به snapshot موتور', () => {
  it('موقعیت و چرخش را بدون تغییر واحد منتقل می‌کند', () => {
    expect(toPresenceSnapshot(teammate(), NOW)).toEqual({
      playerId: 'seat-2',
      transform: { x: 1.5, y: 1.65, z: -3, yawDeg: 42, pitchDeg: 0 },
      updatedAt: NOW - 200,
      playerName: 'مریم',
      seatIndex: 1,
      phase: 'alley_puzzle',
    });
  });

  it('موقعیت یا شناسهٔ نامعتبر را رد می‌کند (آواتار در مبدأ صحنه گیر نکند)', () => {
    expect(toPresenceSnapshot(teammate({ position: null }), NOW)).toBeNull();
    expect(toPresenceSnapshot(teammate({ position: { x: Number.NaN, y: 1, z: 0 } }), NOW)).toBeNull();
    expect(
      toPresenceSnapshot(teammate({ position: { x: 1, y: Number.POSITIVE_INFINITY, z: 0 } }), NOW),
    ).toBeNull();
    expect(toPresenceSnapshot(teammate({ playerId: '' }), NOW)).toBeNull();
  });

  it('چرخش و زمان نامعتبر را با مقدار امن جایگزین می‌کند', () => {
    const snapshot = toPresenceSnapshot(
      teammate({ yawDeg: Number.NaN, updatedAt: null, phase: null, name: null }),
      NOW,
    );
    expect(snapshot?.transform.yawDeg).toBe(0);
    expect(snapshot?.updatedAt).toBe(NOW);
    expect(snapshot?.playerName).toBeNull();
    expect(snapshot?.phase).toBeUndefined();
  });
});

describe('toPresenceSnapshots — قاب کامل حضور', () => {
  it('بازیکن محلی و ورودی‌های ناقص را حذف می‌کند', () => {
    const snapshots = toPresenceSnapshots(
      [teammate({ playerId: 'me' }), teammate(), teammate({ position: null })],
      'me',
      NOW,
    );
    expect(snapshots.map((snapshot) => snapshot.playerId)).toEqual(['seat-2']);
  });

  it('شناسهٔ تکراری را یکتا می‌کند (آخرین نسخه برنده است)', () => {
    const snapshots = toPresenceSnapshots(
      [teammate({ position: { x: 1, y: 1, z: 1 } }), teammate({ position: { x: 9, y: 1, z: 9 } })],
      null,
      NOW,
    );
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.transform.x).toBe(9);
  });
});

describe('RemotePlayerManager — چرخهٔ عمر آواتارها', () => {
  it('هم‌تیمی‌ها را می‌سازد، به‌روز می‌کند و بازیکن محلی را نادیده می‌گیرد', () => {
    const manager = new RemotePlayerManager();
    const first = manager.sync(
      toPresenceSnapshots([teammate({ playerId: 'seat-2' }), teammate({ playerId: 'seat-3' })], 'seat-0', NOW),
      NOW,
      'seat-0',
    );
    expect(first).toEqual({ added: 2, updated: 0, removed: 0 });
    expect(manager.size).toBe(2);

    const second = manager.sync(
      toPresenceSnapshots([teammate({ playerId: 'seat-2', position: { x: 4, y: 1, z: 4 } })], 'seat-0', NOW + 100),
      NOW + 100,
      'seat-0',
    );
    expect(second).toEqual({ added: 0, updated: 1, removed: 1 });
    expect(manager.size).toBe(1);
    manager.dispose();
  });

  it('بازیکن آفلاین بعد از ۳۰ ثانیه از صحنه حذف می‌شود', () => {
    expect(PRESENCE_OFFLINE_TIMEOUT_MS).toBe(30_000);
    const manager = new RemotePlayerManager();
    const frame = [teammate({ updatedAt: NOW })];
    manager.sync(toPresenceSnapshots(frame, null, NOW), NOW);
    expect(manager.size).toBe(1);

    // قاب تکراری هنوز تازه است: مهلت ۳۰ ثانیه هنوز تمام نشده
    manager.sync(toPresenceSnapshots(frame, null, NOW + PRESENCE_OFFLINE_TIMEOUT_MS - 1), NOW + PRESENCE_OFFLINE_TIMEOUT_MS - 1);
    expect(manager.size).toBe(1);

    // همان snapshot کهنه: ۳۰ ثانیه بی‌خبری → حذف
    manager.sync(
      toPresenceSnapshots(frame, null, NOW + PRESENCE_OFFLINE_TIMEOUT_MS),
      NOW + PRESENCE_OFFLINE_TIMEOUT_MS,
    );
    expect(manager.size).toBe(0);
    manager.dispose();
  });

  it('پس از dispose هیچ آواتاری ساخته یا به‌روز نمی‌شود', () => {
    const manager = new RemotePlayerManager();
    manager.dispose();
    expect(manager.sync(toPresenceSnapshots([teammate()], null, NOW), NOW)).toEqual({
      added: 0,
      updated: 0,
      removed: 0,
    });
    expect(manager.children).toHaveLength(0);
  });
});

describe('اتصال واقعی در صحنهٔ کوچه', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/components/alley/AlleyRoomThreeIntegration.tsx'),
    'utf8',
  );

  it('مدیر آواتارها ساخته، به صحنه اضافه و در هر فریم به‌روز می‌شود', () => {
    expect(source).toContain("import { RemotePlayerManager } from '@/engine3d/presence/RemotePlayerManager'");
    expect(source).toContain('new RemotePlayerManager()');
    expect(source).toContain('engine.scene.add(manager)');
    expect(source).toContain('remotePlayersRef.current?.update(delta)');
  });

  it('قاب حضور HUD با تبدیل درست به مدیر آواتارها داده می‌شود', () => {
    expect(source).toContain('toPresenceSnapshots(presence.presences, room.me.playerId)');
    expect(source).toContain('engine.setTick(');
  });
});
