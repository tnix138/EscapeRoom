import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDGE_INSET_PCT,
  MAX_MARKERS,
  MAX_NAMEPLATES,
  PRESENCE_OFFLINE_TIMEOUT_MS,
  PRESENCE_PUBLISH_INTERVAL_MS,
  PRESENCE_SEND_INTERVAL_MS,
  PRESENCE_STALE_AFTER_MS,
  bearingDeg,
  buildPresenceMarkers,
  describeDirection,
  distanceMeters,
  edgePosition,
  formatDistance,
  isTeammateOnline,
  normalizeRemotePlayer,
  normalizeRemotePlayers,
  presenceAge,
  presenceOpacity,
  presenceSummaryLabel,
  projectPoint,
  shouldShowPresence,
  staleOpacity,
  toPersianNumber,
  type LocalViewer,
} from '../../src/components/hud/presence/presence-hud';

/**
 * فاز ۱۲ — HUD حضور در ۳D (امیرعلی)
 * -------------------------------------------------------------------------
 * قرارداد این فایل:
 *  - هم‌تیمی در دید → برچسب نام بالای سر؛ بیرون از دید یا پشت سر → فلش لبه.
 *  - هندسه دقیق است: رو‌به‌رو = ۰ درجه، سمت راست = +۹۰، پشت سر = ۱۸۰.
 *  - هم‌تیمی آفلاین دقیقاً بعد از ۳۰ ثانیه حذف و پیش از آن کم‌رنگ می‌شود.
 *  - هر دو شکل snapshot (فاز ۰۴ و قرارداد ۲) بدون خطا خوانده می‌شود.
 *  - لایه فقط نمایشی است: بدون واکشی شبکه، بدون three.js و بدون گرفتن کلیک.
 */

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const hudSource = read('../../src/components/hud/presence/PresenceHud.tsx');
const indexSource = read('../../src/components/hud/presence/index.ts');
const css = read('../../src/app/globals.css');

const MARKER = 'فاز ۱۲ — HUD حضور در جهان سه‌بعدی';

/** برش یک بخش CSS تا شروع بخش بعدی، تا افزودن فازهای بعدی این تست را نشکند. */
function cssSection(marker: string): string {
  const start = css.indexOf(marker);
  if (start < 0) return '';
  const next = css.indexOf('\n/* ====', start);
  return css.slice(start, next > 0 ? next : undefined);
}

const presenceCss = cssSection(MARKER);

function rule(selector: string): string {
  const start = presenceCss.indexOf(`${selector} {`);
  if (start < 0) return '';
  const end = presenceCss.indexOf('}', start);
  return presenceCss.slice(start, end);
}

const NOW = 1_700_000_000_000;
const LOCAL: LocalViewer = { position: { x: 0, y: 1.65, z: 0 }, yawDeg: 0, pitchDeg: 0 };
const VIEW = { widthPx: 1280, heightPx: 720, fovYDeg: 68 };
const PERSIAN_TEXT = /[\u0600-\u06FF]/;

/** snapshot به سبک فاز ۰۴ (transform). */
function phase04(id: string, x: number, z: number, updatedAt = NOW) {
  return { playerId: id, transform: { x, y: 1.65, z, yawDeg: 0, pitchDeg: 0 }, updatedAt };
}

/** snapshot به سبک قرارداد ۲ (position + lastUpdate). */
function contract2(id: string, x: number, z: number, lastUpdate = NOW) {
  return { playerId: id, seatIndex: 2, position: { x, y: 1.65, z }, yaw: 0, phase: 'in_theater', lastUpdate };
}

describe('فاز ۱۲ — خواندن snapshotها (سازگاری دو قرارداد)', () => {
  it('شکل فاز ۰۴ را می‌خواند', () => {
    const player = normalizeRemotePlayer(phase04('p1', 2, -3));
    expect(player).toEqual({
      playerId: 'p1',
      name: null,
      seatIndex: null,
      seatLabel: null,
      position: { x: 2, y: 1.65, z: -3 },
      updatedAt: NOW,
    });
  });

  it('شکل قرارداد ۲ را هم می‌خواند (position + lastUpdate + seatIndex)', () => {
    const player = normalizeRemotePlayer(contract2('p2', -1, 4));
    expect(player?.playerId).toBe('p2');
    expect(player?.position).toEqual({ x: -1, y: 1.65, z: 4 });
    expect(player?.updatedAt).toBe(NOW);
    expect(player?.seatIndex).toBe(2);
  });

  it('شکل تخت {playerId,x,y,z} و نام و برچسب صندلی را می‌پذیرد', () => {
    const player = normalizeRemotePlayer({
      playerId: ' p3 ',
      playerName: '  سارا ',
      seatLabel: ' ردیف ۱ — صندلی ۳ ',
      x: 1,
      y: 1.6,
      z: 2,
      updatedAt: NOW,
    });
    expect(player?.playerId).toBe('p3');
    expect(player?.name).toBe('سارا');
    expect(player?.seatLabel).toBe('ردیف ۱ — صندلی ۳');
  });

  it('ورودی خراب را بی‌صدا رد می‌کند و هرگز خطا نمی‌دهد', () => {
    for (const bad of [
      null,
      undefined,
      0,
      'text',
      [],
      {},
      { playerId: '' , x: 1, y: 1, z: 1 },
      { playerId: 'p', x: '1', y: 1, z: 1 },
      { playerId: 'p', transform: { x: 1, y: Number.NaN, z: 0 } },
      { playerId: 'p', position: null },
    ]) {
      expect(normalizeRemotePlayer(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(normalizeRemotePlayers(null)).toEqual([]);
    expect(normalizeRemotePlayers({})).toEqual([]);
    expect(normalizeRemotePlayers([phase04('a', 1, 1), null, 'x', 7])).toHaveLength(1);
  });

  it('تکراری‌ها را با تازه‌ترین snapshot جمع می‌کند و سقف تعداد را نگه می‌دارد', () => {
    const players = normalizeRemotePlayers([
      phase04('dup', 1, 1, NOW - 500),
      phase04('dup', 9, 9, NOW),
      phase04('other', 2, 2),
    ]);
    expect(players).toHaveLength(2);
    expect(players.find((player) => player.playerId === 'dup')?.position).toEqual({ x: 9, y: 1.65, z: 9 });

    const many = Array.from({ length: MAX_MARKERS + 10 }, (_, index) => phase04(`p${index}`, index, 0));
    expect(normalizeRemotePlayers(many)).toHaveLength(MAX_MARKERS);
  });
});

describe('فاز ۱۲ — کهنگی و آفلاین شدن (قرارداد ۲: ۳۰ ثانیه)', () => {
  it('تا ۳۰ ثانیه آنلاین و بعد از آن آفلاین است', () => {
    expect(PRESENCE_OFFLINE_TIMEOUT_MS).toBe(30_000);
    expect(presenceAge({ updatedAt: NOW - 29_999 }, NOW)).toBe(29_999);
    expect(isTeammateOnline({ updatedAt: NOW - 29_999 }, NOW)).toBe(true);
    expect(isTeammateOnline({ updatedAt: NOW - 30_000 }, NOW)).toBe(false);
    expect(isTeammateOnline({ updatedAt: 0 }, NOW)).toBe(false);
    expect(presenceAge({ updatedAt: 0 }, NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it('شفافیت تا ۱۰ ثانیه کامل، بعد کم‌رنگ و در ۳۰ ثانیه صفر است', () => {
    expect(PRESENCE_STALE_AFTER_MS).toBe(10_000);
    expect(staleOpacity(0)).toBe(1);
    expect(staleOpacity(10_000)).toBe(1);
    expect(staleOpacity(20_000)).toBeLessThan(1);
    expect(staleOpacity(20_000)).toBeGreaterThan(0.25);
    expect(staleOpacity(30_000)).toBe(0);
    expect(staleOpacity(Number.POSITIVE_INFINITY)).toBe(0);
    expect(presenceOpacity({ updatedAt: NOW - 5_000 }, NOW)).toBe(1);
    expect(presenceOpacity({ updatedAt: NOW - 31_000 }, NOW)).toBe(0);
  });
});

describe('فاز ۱۲ — هندسهٔ جهت و فاصله', () => {
  it('رو‌به‌رو، راست، چپ و پشت سر را درست حساب می‌کند', () => {
    // دوربین با yaw=0 رو به محور −z نگاه می‌کند (قرارداد موتور).
    expect(bearingDeg(LOCAL, { x: 0, y: 1.65, z: -5 })).toBeCloseTo(0, 5);
    expect(bearingDeg(LOCAL, { x: 5, y: 1.65, z: 0 })).toBeCloseTo(90, 5);
    expect(bearingDeg(LOCAL, { x: -5, y: 1.65, z: 0 })).toBeCloseTo(-90, 5);
    expect(Math.abs(bearingDeg(LOCAL, { x: 0, y: 1.65, z: 5 }))).toBeCloseTo(180, 5);
    expect(bearingDeg(LOCAL, { x: 0, y: 1.65, z: 0 })).toBe(0);
  });

  it('چرخش بازیکن جهت فلش را می‌چرخاند', () => {
    const facingRight: LocalViewer = { position: { x: 0, y: 1.65, z: 0 }, yawDeg: 90 };
    // با yaw=90 (نگاه به −x)، هم‌تیمی در −x رو‌به‌رو است.
    expect(bearingDeg(facingRight, { x: -5, y: 1.65, z: 0 })).toBeCloseTo(0, 5);
    // رو به −x، محور −z در سمت راست بازیکن است.
    expect(bearingDeg(facingRight, { x: 0, y: 1.65, z: -5 })).toBeCloseTo(90, 5);
  });

  it('زاویه همیشه در بازهٔ −۱۸۰ تا ۱۸۰ است', () => {
    for (let degrees = 0; degrees < 360; degrees += 15) {
      const radians = (degrees * Math.PI) / 180;
      const point = { x: Math.cos(radians) * 4, y: 1.65, z: Math.sin(radians) * 4 };
      const bearing = bearingDeg({ position: { x: 0, y: 1.65, z: 0 }, yawDeg: degrees * 3 }, point);
      expect(bearing).toBeGreaterThanOrEqual(-180.0001);
      expect(bearing).toBeLessThanOrEqual(180.0001);
    }
  });

  it('فاصله افقی است و برچسب فارسی با رقم فارسی می‌سازد', () => {
    expect(distanceMeters(LOCAL, { x: 3, y: 40, z: 4 })).toBeCloseTo(5, 5);
    expect(formatDistance(0.4)).toBe('کمتر از ۱ متر');
    expect(formatDistance(2.44)).toBe('۲.۴ متر');
    expect(formatDistance(12)).toMatch(/^[۰-۹]+ متر$/);
    expect(formatDistance(Number.NaN)).toBe('نامعلوم');
    expect(toPersianNumber(1403)).toBe('۱۴۰۳');
  });

  it('جهت و فاصله را به جملهٔ فارسی برای صفحه‌خوان تبدیل می‌کند', () => {
    expect(describeDirection(0)).toBe('روبه‌رو');
    expect(describeDirection(45)).toContain('راست');
    expect(describeDirection(-45)).toContain('چپ');
    expect(describeDirection(90)).toBe('سمت راست');
    expect(describeDirection(180)).toBe('پشت سر');
    expect(describeDirection(-180)).toBe('پشت سر');
    expect(describeDirection(Number.NaN)).toBe('نامعلوم');
  });
});

describe('فاز ۱۲ — تصویر کردن روی صفحه', () => {
  it('نقطهٔ رو‌به‌رو در مرکز و نقطهٔ بیرون از دید در لبه‌ها می‌نشیند', () => {
    const ahead = projectPoint(LOCAL, { x: 0, y: 1.65, z: -6 }, VIEW);
    expect(ahead.inFront).toBe(true);
    expect(ahead.xPct).toBeCloseTo(0.5, 5);
    expect(ahead.yPct).toBeCloseTo(0.5, 5);

    const right = projectPoint(LOCAL, { x: 6, y: 1.65, z: -6 }, VIEW);
    expect(right.xPct).toBeGreaterThan(0.5);

    const high = projectPoint(LOCAL, { x: 0, y: 3.2, z: -6 }, VIEW);
    expect(high.yPct).toBeLessThan(0.5);
  });

  it('نقطهٔ پشت سر «در دید» نیست', () => {
    const behind = projectPoint(LOCAL, { x: 0, y: 1.65, z: 8 }, VIEW);
    expect(behind.inFront).toBe(false);
    expect(behind.depth).toBeLessThan(0);
  });

  it('نسبت ابعاد روی محور افقی اثر دارد و خروجی همیشه معتبر است', () => {
    const wide = projectPoint(LOCAL, { x: 5, y: 1.65, z: -6 }, { widthPx: 1920, heightPx: 720 });
    const square = projectPoint(LOCAL, { x: 5, y: 1.65, z: -6 }, { widthPx: 720, heightPx: 720 });
    expect(Math.abs(wide.xPct - 0.5)).toBeLessThan(Math.abs(square.xPct - 0.5));
    for (const view of [
      { widthPx: 0, heightPx: 0 },
      { widthPx: Number.NaN, heightPx: 720 },
      { widthPx: 1280, heightPx: 720, fovYDeg: 179 },
      { widthPx: 1280, heightPx: 720, fovYDeg: 0 },
    ]) {
      const point = projectPoint(LOCAL, { x: 1, y: 1.65, z: -2 }, view);
      expect(Number.isFinite(point.xPct)).toBe(true);
      expect(Number.isFinite(point.yPct)).toBe(true);
    }
  });

  it('فلش لبه دقیقاً روی لبهٔ امن می‌نشیند و جهت را نگه می‌دارد', () => {
    const top = edgePosition(0, 6);
    expect(top.xPct).toBeCloseTo(50, 5);
    expect(top.yPct).toBeCloseTo(6, 5);

    const right = edgePosition(90, 6);
    expect(right.yPct).toBeCloseTo(50, 5);
    expect(right.xPct).toBeCloseTo(94, 5);

    const bottom = edgePosition(180, 6);
    expect(bottom.xPct).toBeCloseTo(50, 5);
    expect(bottom.yPct).toBeCloseTo(94, 5);

    for (const bearing of [-180, -90, -45, 0, 45, 90, 180]) {
      const position = edgePosition(bearing, DEFAULT_EDGE_INSET_PCT);
      expect(position.xPct).toBeGreaterThanOrEqual(DEFAULT_EDGE_INSET_PCT);
      expect(position.xPct).toBeLessThanOrEqual(100 - DEFAULT_EDGE_INSET_PCT);
      expect(position.yPct).toBeGreaterThanOrEqual(DEFAULT_EDGE_INSET_PCT);
      expect(position.yPct).toBeLessThanOrEqual(100 - DEFAULT_EDGE_INSET_PCT);
    }
  });
});

describe('فاز ۱۲ — نشانگرهای نهایی', () => {
  it('هم‌تیمی در دید برچسب نام می‌گیرد و نام و حرف اول دارد', () => {
    const markers = buildPresenceMarkers(LOCAL, [phase04('p1', 0.4, -4)], VIEW, { now: NOW });
    expect(markers).toHaveLength(1);
    const marker = markers[0];
    expect(marker.kind).toBe('nameplate');
    expect(marker.angleDeg).toBe(0);
    expect(marker.label).toBe('هم‌تیمی');
    expect(marker.initial).toBe('ه');
    expect(marker.xPct).toBeGreaterThan(40);
    expect(marker.xPct).toBeLessThan(60);
  });

  it('نام واقعی، برچسب صندلی و اعلان فارسی ساخته می‌شود', () => {
    const markers = buildPresenceMarkers(
      LOCAL,
      [{ ...phase04('p1', 0, -4), playerName: 'سارا', seatLabel: 'ردیف ۱ — صندلی ۳' }],
      VIEW,
      { now: NOW },
    );
    expect(markers[0].label).toBe('سارا');
    expect(markers[0].seatLabel).toBe('ردیف ۱ — صندلی ۳');
    expect(markers[0].announcement).toContain('سارا');
    expect(markers[0].announcement).toContain('روبه‌رو');
    expect(markers[0].announcement).toMatch(PERSIAN_TEXT);
    expect(markers[0].announcement).not.toMatch(/[A-Za-z]/);
  });

  it('هم‌تیمی پشت سر یا بیرون از دید فلش لبه می‌گیرد', () => {
    const behind = buildPresenceMarkers(LOCAL, [phase04('p1', 0, 6)], VIEW, { now: NOW })[0];
    expect(behind.kind).toBe('arrow');
    expect(Math.abs(behind.angleDeg)).toBeCloseTo(180, 5);
    expect(behind.yPct).toBeGreaterThan(80);

    const farRight = buildPresenceMarkers(LOCAL, [phase04('p2', 40, -2)], VIEW, { now: NOW })[0];
    expect(farRight.kind).toBe('arrow');
    expect(farRight.xPct).toBeGreaterThan(90);
    expect(farRight.angleDeg).toBeGreaterThan(0);
  });

  it('بازیکن محلی و هم‌تیمی آفلاین حذف می‌شوند', () => {
    const players = [
      phase04('me', 0, -1),
      phase04('offline', 1, -2, NOW - 30_000),
      phase04('online', 1, -2, NOW - 5_000),
    ];
    const markers = buildPresenceMarkers(LOCAL, players, VIEW, { now: NOW, localPlayerId: 'me' });
    expect(markers.map((marker) => marker.playerId)).toEqual(['online']);
  });

  it('حداکثر ۴ برچسب نام می‌دهد و بقیه فلش می‌شوند', () => {
    expect(MAX_NAMEPLATES).toBe(4);
    const players = Array.from({ length: 7 }, (_, index) => phase04(`p${index}`, (index - 3) * 0.6, -5 - index * 0.2));
    const markers = buildPresenceMarkers(LOCAL, players, VIEW, { now: NOW });
    expect(markers.filter((marker) => marker.kind === 'nameplate')).toHaveLength(4);
    expect(markers.filter((marker) => marker.kind === 'arrow')).toHaveLength(3);
    expect(buildPresenceMarkers(LOCAL, players, VIEW, { now: NOW, maxNameplates: 0 })
      .every((marker) => marker.kind === 'arrow')).toBe(true);
  });

  it('مرتب‌سازی نزدیک‌ترین اول است تا نشانگرها نلرزند', () => {
    const markers = buildPresenceMarkers(
      LOCAL,
      [phase04('far', 0, -9), phase04('near', 0, -2), phase04('mid', 0, -5)],
      VIEW,
      { now: NOW },
    );
    expect(markers.map((marker) => marker.playerId)).toEqual(['near', 'mid', 'far']);
    expect(markers[0].distanceMeters).toBeLessThan(markers[1].distanceMeters);
  });

  it('همهٔ خروجی‌ها در بازهٔ معتبر و بدون NaN هستند', () => {
    const players = Array.from({ length: 12 }, (_, index) =>
      phase04(`p${index}`, Math.sin(index) * 30, Math.cos(index) * 30, NOW - index * 1_000),
    );
    for (const marker of buildPresenceMarkers(LOCAL, players, VIEW, { now: NOW })) {
      expect(Number.isFinite(marker.xPct)).toBe(true);
      expect(Number.isFinite(marker.yPct)).toBe(true);
      expect(marker.xPct).toBeGreaterThanOrEqual(0);
      expect(marker.xPct).toBeLessThanOrEqual(100);
      expect(marker.yPct).toBeGreaterThanOrEqual(0);
      expect(marker.yPct).toBeLessThanOrEqual(100);
      expect(marker.opacity).toBeGreaterThanOrEqual(0);
      expect(marker.opacity).toBeLessThanOrEqual(1);
      expect(marker.label.length).toBeGreaterThan(0);
      expect(marker.announcement).toMatch(PERSIAN_TEXT);
    }
  });

  it('بدون بازیکن محلی یا بدون هم‌تیمی، چیزی نمایش داده نمی‌شود', () => {
    expect(buildPresenceMarkers(null, [phase04('p1', 0, -4)], VIEW, { now: NOW })).toEqual([]);
    expect(buildPresenceMarkers(LOCAL, [], VIEW, { now: NOW })).toEqual([]);
    expect(shouldShowPresence(null, [])).toBe(false);
    expect(shouldShowPresence(LOCAL, [])).toBe(false);
    expect(presenceSummaryLabel([])).toBe('هم‌تیمی‌ای در دید نیست.');
  });

  it('نام‌های view اتاق بر نام داخل snapshot اولویت دارند', () => {
    const markers = buildPresenceMarkers(
      LOCAL,
      [{ ...phase04('p1', 0, -4), playerName: 'نام قدیمی' }],
      VIEW,
      { now: NOW, names: { p1: 'سارا' } },
    );
    expect(markers[0].label).toBe('سارا');
    expect(buildPresenceMarkers(LOCAL, [phase04('p1', 0, -4)], VIEW, { now: NOW, names: { p1: '   ' } })[0].label)
      .toBe('هم‌تیمی');
  });

  it('اعلان کلی تعداد در دید و بیرون از دید را می‌گوید', () => {
    const markers = buildPresenceMarkers(
      LOCAL,
      [phase04('a', 0, -4), phase04('b', 0, 6), phase04('c', 0, 8)],
      VIEW,
      { now: NOW },
    );
    expect(markers.map((marker) => marker.inView)).toEqual([true, false, false]);
    const summary = presenceSummaryLabel(markers);
    expect(summary).toContain('۱ هم‌تیمی در دید');
    expect(summary).toContain('۲ نفر بیرون از دید');
    expect(summary).toMatch(PERSIAN_TEXT);
  });

  it('نرخ ارسال قرارداد (۱۰Hz) در مدل هم صادر می‌شود', () => {
    expect(PRESENCE_SEND_INTERVAL_MS).toBe(100);
    expect(PRESENCE_PUBLISH_INTERVAL_MS).toBe(PRESENCE_SEND_INTERVAL_MS);
  });
});

describe('فاز ۱۲ — قرارداد کامپوننت و CSS', () => {
  it('کلاینتی، بدون واکشی شبکه و بدون three.js است', () => {
    expect(hudSource.startsWith("'use client';")).toBe(true);
    for (const forbidden of ['fetch(', 'EventSource', 'XMLHttpRequest', "from 'three'", 'localStorage']) {
      expect(hudSource, forbidden).not.toContain(forbidden);
    }
    expect(hudSource).not.toContain('dangerouslySetInnerHTML');
  });

  it('لایهٔ بصری aria-hidden و فهرست صفحه‌خوان جداگانه است', () => {
    expect(hudSource).toContain('aria-hidden="true"');
    expect(hudSource).toContain('className="sr-only"');
    expect(hudSource).toContain('role="status"');
    expect(hudSource).toContain('aria-live="polite"');
    expect(hudSource).toContain('aria-label="هم‌تیمی‌های اطراف"');
    expect(hudSource).toContain('memo(PresenceHud)');
    expect(hudSource).toContain('useMemo');
  });

  it('خروجی عمومی از مسیر hud/presence قابل import است', () => {
    expect(indexSource).toContain("export { default as PresenceHud } from './PresenceHud'");
    expect(indexSource).toContain("export * from './presence-hud'");
  });

  it('CSS لایه را غیرمسدودکننده و مهارشده نگه می‌دارد', () => {
    expect(presenceCss).not.toBe('');
    expect(rule('.presence-hud')).toContain('pointer-events: none');
    expect(rule('.presence-hud')).toContain('max-width: 100vw');
    expect(rule('.presence-hud')).toContain('position: fixed');
    expect(rule('.presence-nameplate')).toContain('translate(-50%, -150%)');
    expect(rule('.presence-arrow')).toContain('translate(-50%, -50%)');
    expect(presenceCss).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('هیچ متن زیر ۱۲px و هیچ min-width بزرگ‌تر از ۲۸۸px در این بخش نیست', () => {
    const violations: string[] = [];
    for (const match of presenceCss.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = match[1].trim();
      let px: number | null = null;
      if (value.includes('var(--text-xs)')) px = 12;
      else if (value.includes('var(--text-sm)')) px = 14;
      else if (value.includes('var(--text-base)')) px = 16;
      else {
        const raw = /(\d+(?:\.\d+)?)px/.exec(value);
        if (raw) px = Number(raw[1]);
      }
      if (px !== null && px < 12) violations.push(`font-size: ${value}`);
    }
    for (const match of presenceCss.matchAll(/(?:^|[;{\s])min-width:\s*([^;]+);/g)) {
      const value = match[1].trim();
      const px = Number((/(\d+(?:\.\d+)?)px/.exec(value) ?? [])[1] ?? 0);
      if (px > 288) violations.push(`min-width: ${value}`);
    }
    expect(violations).toEqual([]);
  });
});
