import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildPresencePublishBody,
  clockOffsetFromFrame,
  mergePresenceFrames,
  normalizeRadians,
  presenceEndpoint,
  presenceStreamUrl,
  readPresenceFrame,
  serverClockNow,
  shouldPublishTransform,
  yawDegToRadians,
  yawRadiansToDegrees,
} from '../../src/components/hud/presence/presence-contract';
import {
  PRESENCE_COALESCE_MS,
  PRESENCE_KEEPALIVE_MS,
  PRESENCE_MAX_FAILURES,
  PRESENCE_PROBE_TIMEOUT_MS,
  readStoredSeatToken,
} from '../../src/components/hud/presence/use-presence-feed';
import { normalizeRemotePlayer } from '../../src/components/hud/presence/presence-hud';

/**
 * فاز ۱۲ — قرارداد حضور (Issue #104)
 * -------------------------------------------------------------------------
 * این فایل دقیقاً همان شکل سیمی را قفل می‌کند که سرور فاز ۰۳ می‌فرستد و
 * می‌گیرد: `yaw` رادیان، هویت از توکن، رویداد `presence_update` با
 * `{ presences, serverNow }` و پاک‌سازی ۳۰ ثانیه‌ای.
 */

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const feedSource = read('../../src/components/hud/presence/use-presence-feed.ts');
const contractSource = read('../../src/components/hud/presence/presence-contract.ts');
const integration = read('../../src/components/alley/AlleyRoomThreeIntegration.tsx');

const SERVER_NOW = 1_792_610_264_622;

const frame = {
  presences: [
    {
      playerId: 'seat-2',
      seatIndex: 1,
      playerName: 'علیرضا ب',
      position: { x: -3, y: 1.65, z: 2 },
      yaw: 1.2,
      phase: 'alley_puzzle',
      lastUpdate: 1_792_610_264_571,
      receivedAt: 1_792_610_264_571,
    },
  ],
  serverNow: SERVER_NOW,
};

describe('فاز ۱۲ — مسیرهای قرارداد', () => {
  it('آدرس POST/GET حضور و استریم مطابق Issue #104 است', () => {
    expect(presenceEndpoint('ABC123')).toBe('/api/rooms/ABC123/presence');
    expect(presenceEndpoint('a/b')).toBe('/api/rooms/a%2Fb/presence');
    expect(presenceStreamUrl('ABC123', 'tok')).toBe('/api/rooms/ABC123/stream?token=tok');
  });

  it('yaw درجه به رادیان و برعکس، نرمال‌شده در بازهٔ [-π, π)', () => {
    expect(yawDegToRadians(180)).toBeCloseTo(Math.PI, 6);
    expect(yawDegToRadians(-180)).toBeCloseTo(Math.PI, 6);
    expect(yawDegToRadians(90)).toBeCloseTo(Math.PI / 2, 6);
    expect(yawRadiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 6);
    for (const value of [-10, -3.5, -Math.PI, 0, Math.PI, 7.2]) {
      const normalized = normalizeRadians(value);
      expect(normalized).toBeGreaterThanOrEqual(-Math.PI);
      expect(normalized).toBeLessThanOrEqual(Math.PI);
    }
    expect(normalizeRadians(Number.NaN)).toBe(0);
  });
});

describe('فاز ۱۲ — بدنهٔ ارسال (فقط position/yaw/phase)', () => {
  it('بدنه دقیقاً کلیدهای مجاز را دارد و yaw رادیان است', () => {
    const body = buildPresencePublishBody({ x: 1.5, y: 1.65, z: -3, yawDeg: 90 }, 'alley_puzzle');
    expect(body).toEqual({
      position: { x: 1.5, y: 1.65, z: -3 },
      yaw: Math.PI / 2,
      phase: 'alley_puzzle',
    });
    expect(Object.keys(body ?? {})).toEqual(['position', 'yaw', 'phase']);
    expect(body).not.toHaveProperty('playerId');
    expect(body).not.toHaveProperty('seatIndex');
  });

  it('ورودی ناقص یا غیرمتناهی بدنه نمی‌سازد (جلوگیری از ۴۰۰ سرور)', () => {
    expect(buildPresencePublishBody(null, 'alley_puzzle')).toBeNull();
    expect(buildPresencePublishBody({ x: Number.NaN, y: 1, z: 1, yawDeg: 0 }, 'alley_puzzle')).toBeNull();
    expect(buildPresencePublishBody({ x: 1, y: 1, z: 1, yawDeg: Number.POSITIVE_INFINITY }, 'x')).toBeNull();
  });

  it('فاز خالی به فاز پیش‌فرض تبدیل می‌شود', () => {
    expect(buildPresencePublishBody({ x: 0, y: 0, z: 0, yawDeg: 0 }, '  ')?.phase).toBe('alley_puzzle');
  });

  it('ارسال فقط با حرکت معنادار یا چرخش کافی انجام می‌شود', () => {
    const start = { x: 0, y: 1.65, z: 0, yawDeg: 0 };
    expect(shouldPublishTransform(null, start)).toBe(true);
    expect(shouldPublishTransform(start, { ...start, x: 0.001 })).toBe(false);
    expect(shouldPublishTransform(start, { ...start, x: 0.05 })).toBe(true);
    expect(shouldPublishTransform(start, { ...start, yawDeg: 0.2 })).toBe(false);
    expect(shouldPublishTransform(start, { ...start, yawDeg: 2 })).toBe(true);
    expect(shouldPublishTransform(start, null)).toBe(false);
  });
});

describe('فاز ۱۲ — خواندن رویداد SSE', () => {
  it('قاب استاندارد {presences, serverNow} را می‌خواند', () => {
    const parsed = readPresenceFrame(frame);
    expect(parsed.serverNow).toBe(SERVER_NOW);
    expect(parsed.presences).toHaveLength(1);
    const [player] = parsed.presences;
    expect(player.playerId).toBe('seat-2');
    expect(player.name).toBe('علیرضا ب');
    expect(player.seatIndex).toBe(1);
    expect(player.position).toEqual({ x: -3, y: 1.65, z: 2 });
    expect(player.phase).toBe('alley_puzzle');
    expect(player.updatedAt).toBe(1_792_610_264_571);
    // yaw رادیان سرور به درجه برای هندسه تبدیل می‌شود.
    expect(player.yawDeg).toBeCloseTo((1.2 * 180) / Math.PI, 4);
  });

  it('پوشش data، شکل قدیمی snapshots و آرایهٔ خالی را می‌پذیرد', () => {
    expect(readPresenceFrame({ data: { presences: frame.presences } }).presences).toHaveLength(1);
    expect(readPresenceFrame({ snapshots: frame.presences }).presences).toHaveLength(1);
    expect(readPresenceFrame([]).presences).toEqual([]);
    expect(readPresenceFrame({ presences: [] }).presences).toEqual([]);
  });

  it('ورودی خراب قاب خالی می‌دهد و هرگز خطا نمی‌دهد', () => {
    for (const bad of [null, undefined, 7, 'x', {}, { presences: 'x' }, { presences: [null, 3] }]) {
      const parsed = readPresenceFrame(bad);
      expect(parsed.presences).toEqual([]);
      expect(parsed.serverNow === null || typeof parsed.serverNow === 'number').toBe(true);
    }
  });

  it('receivedAt جای lastUpdate را می‌گیرد', () => {
    const player = normalizeRemotePlayer({
      playerId: 'p',
      position: { x: 0, y: 0, z: 0 },
      receivedAt: 1_000,
    });
    expect(player?.updatedAt).toBe(1_000);
  });
});

describe('فاز ۱۲ — ادغام و هم‌زمانی', () => {
  it('ادغام، تازه‌ترین snapshot هر بازیکن را نگه می‌دارد', () => {
    const current = [
      { playerId: 'a', name: null, seatIndex: null, seatLabel: null, position: { x: 0, y: 0, z: 0 }, yawDeg: 0, phase: null, updatedAt: 500 },
      { playerId: 'b', name: null, seatIndex: null, seatLabel: null, position: { x: 1, y: 0, z: 0 }, yawDeg: 0, phase: null, updatedAt: 900 },
    ];
    const incoming = [
      { playerId: 'a', name: null, seatIndex: null, seatLabel: null, position: { x: 5, y: 0, z: 0 }, yawDeg: 0, phase: null, updatedAt: 700 },
      { playerId: 'b', name: null, seatIndex: null, seatLabel: null, position: { x: 9, y: 0, z: 0 }, yawDeg: 0, phase: null, updatedAt: 400 },
    ];
    const merged = mergePresenceFrames(current, incoming);
    expect(merged.map((player) => player.playerId)).toEqual(['a', 'b']);
    expect(merged[0].position.x).toBe(5);
    expect(merged[1].position.x).toBe(1);
  });

  it('سقف تعداد بازیکن در ادغام رعایت می‌شود', () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      playerId: `p${index}`,
      name: null, seatIndex: null, seatLabel: null,
      position: { x: 0, y: 0, z: 0 }, yawDeg: 0, phase: null, updatedAt: 1,
    }));
    expect(mergePresenceFrames([], many)).toHaveLength(32);
    expect(mergePresenceFrames([], many, 5)).toHaveLength(5);
  });

  it('اختلاف ساعت از serverNow محاسبه و مقدارهای غیرمنطقی نادیده گرفته می‌شوند', () => {
    expect(clockOffsetFromFrame(SERVER_NOW, SERVER_NOW - 120)).toBe(120);
    expect(clockOffsetFromFrame(null, 1_000)).toBe(0);
    expect(clockOffsetFromFrame(Number.NaN, 1_000)).toBe(0);
    expect(clockOffsetFromFrame(SERVER_NOW, SERVER_NOW - 600_000)).toBe(0);
    expect(serverClockNow(120, 1_000)).toBe(1_120);
    expect(serverClockNow(Number.NaN, 1_000)).toBe(1_000);
  });
});

describe('فاز ۱۲ — اتصال به نمای کوچه', () => {
  it('HUD در پوستهٔ سه‌بعدی mount شده و از دادهٔ واقعی تغذیه می‌شود', () => {
    expect(integration).toContain("import PresenceHud from '../hud/presence/PresenceHud'");
    expect(integration).toContain('usePresenceFeed({');
    expect(integration).toContain('phase: room.phase');
    expect(integration).toContain('players={presence.presences}');
    expect(integration).toContain('localPlayerId={room.me.playerId}');
    expect(integration).toContain('names={presenceNames}');
  });

  it('در نبود سرویس حضور، HUD بی‌صدا می‌ماند (بدون ۴۰۴ پشت‌سرهم)', () => {
    expect(feedSource).toContain('PRESENCE_PROBE_TIMEOUT_MS');
    expect(feedSource).toContain("const usable = response.ok;");
    expect(feedSource).toContain('if (!usable) return;');
    expect(feedSource).not.toMatch(/setInterval\(\s*sendPresence\s*,\s*PRESENCE_SEND_INTERVAL_MS\s*\);\s*\/\/\s*always/);
    expect(PRESENCE_PROBE_TIMEOUT_MS).toBeGreaterThanOrEqual(1_000);
    expect(PRESENCE_MAX_FAILURES).toBeGreaterThan(1);
  });

  it('ارسال throttle دارد، حرکت را می‌سنجد و keepalive کوتاه است', () => {
    expect(feedSource).toContain('PRESENCE_SEND_INTERVAL_MS');
    expect(feedSource).toContain('shouldPublishTransform');
    expect(feedSource).toContain('now - lastSentAt >= PRESENCE_KEEPALIVE_MS');
    expect(feedSource).toContain('keepalive: true');
    expect(PRESENCE_KEEPALIVE_MS).toBeGreaterThanOrEqual(1_000);
  });

  it('به‌روزرسانی UI با RAF و هم‌جوشی ۵۰ms است، نه هر رویداد', () => {
    expect(PRESENCE_COALESCE_MS).toBe(50);
    expect(feedSource).toContain('requestAnimationFrame');
    expect(feedSource).toContain('PRESENCE_COALESCE_MS');
    expect(feedSource).toContain("addEventListener('presence_update'");
  });

  it('بدون import از موتور سه‌بعدی و بدون ذخیرهٔ توکن در حافظهٔ محلی', () => {
    expect(contractSource).not.toContain("from '@/engine3d");
    expect(feedSource).not.toContain("from '@/engine3d");
    expect(feedSource).not.toContain('localStorage.setItem');
    expect(feedSource).not.toContain('sessionStorage.setItem');
  });

  it('خواندن توکن در محیط بدون window خطا نمی‌دهد', () => {
    expect(readStoredSeatToken('ABC123')).toBeNull();
  });
});
