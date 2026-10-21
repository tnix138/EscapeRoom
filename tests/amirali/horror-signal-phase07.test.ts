import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  HORROR_LEVELS,
  HORROR_LEVEL_STYLE,
  describeHorrorLevel,
  horrorHeartbeatMs,
  horrorLevelChangeMessage,
  horrorLevelFromFear,
  horrorLevelIntensity,
  isMotionLevel,
  normalizeHorrorLevel,
  horrorSignalCssVars,
} from '../../src/components/hud/horror/horror-signal';

/**
 * فاز ۰۷-ب — سیگنال ترس سه‌سطحی (Issue #91)
 * ---------------------------------------------------------------------------
 * قرارداد: کامپوننت فقط `level: 'calm' | 'tense' | 'panic'` می‌گیرد، هیچ
 * import ای از `src/engine3d/**` ندارد، سطح ناشناخته به «آرام» برمی‌گردد و
 * هر سطح برچسب فارسی و اعلان خودش را دارد.
 */

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const signalSource = read('../../src/components/hud/horror/horror-signal.ts');
const hudSource = read('../../src/components/hud/horror/HorrorSignalHud.tsx');
const css = read('../../src/app/globals.css');
const integration = read('../../src/components/alley/AlleyRoomThreeIntegration.tsx');

const MARKER = 'فاز ۰۷-ب — نشانگر سیگنال ترس سه‌سطحی';
const start = css.indexOf(MARKER);
const nextSection = css.indexOf('\n/* ====', start + 1);
const signalCss = start >= 0 ? css.slice(start, nextSection > 0 ? nextSection : undefined) : '';

const PERSIAN_TEXT = /[\u0600-\u06FF]/;

describe('فاز ۰۷-ب — مدل سیگنال', () => {
  it('فقط سه سطح قرارداد را می‌شناسد', () => {
    expect(HORROR_LEVELS).toEqual(['calm', 'tense', 'panic']);
    expect(normalizeHorrorLevel('calm')).toBe('calm');
    expect(normalizeHorrorLevel('tense')).toBe('tense');
    expect(normalizeHorrorLevel('panic')).toBe('panic');
    expect(normalizeHorrorLevel('  PANIC ')).toBe('panic');
  });

  it('هر مقدار ناشناخته به «آرام» برمی‌گردد (fail-safe)', () => {
    for (const bad of [null, undefined, '', 'chaos', 7, {}, [], true, Number.NaN]) {
      expect(normalizeHorrorLevel(bad), String(bad)).toBe('calm');
    }
  });

  it('هر سطح برچسب فارسی یکتا و اعلان فارسی دارد', () => {
    const labels = HORROR_LEVELS.map((level) => HORROR_LEVEL_STYLE[level].label);
    expect(new Set(labels).size).toBe(3);
    for (const level of HORROR_LEVELS) {
      const style = HORROR_LEVEL_STYLE[level];
      expect(style.label).toMatch(PERSIAN_TEXT);
      expect(style.announcement).toMatch(PERSIAN_TEXT);
      expect(style.announcement).not.toMatch(/[A-Za-z]/);
      expect(style.pulse).toBeGreaterThanOrEqual(0);
      expect(style.pulse).toBeLessThanOrEqual(1);
      expect(style.heartbeatMs).toBeGreaterThan(300);
    }
  });

  it('شدت افکت‌ها با بالا رفتن سطح زیاد می‌شود', () => {
    expect(horrorLevelIntensity('calm')).toBeLessThan(horrorLevelIntensity('tense'));
    expect(horrorLevelIntensity('tense')).toBeLessThan(horrorLevelIntensity('panic'));
    expect(horrorHeartbeatMs('calm')).toBeGreaterThan(horrorHeartbeatMs('panic'));
    expect(horrorLevelIntensity('unknown')).toBe(horrorLevelIntensity('calm'));
  });

  it('اعلان فقط هنگام تغییر سطح ساخته می‌شود', () => {
    expect(horrorLevelChangeMessage('calm', 'calm')).toBe('');
    expect(horrorLevelChangeMessage('tense', 'tense')).toBe('');
    expect(horrorLevelChangeMessage('calm', 'panic')).toBe(describeHorrorLevel('panic'));
    expect(horrorLevelChangeMessage(null, 'tense')).toBe(describeHorrorLevel('tense'));
    // مقدار ناشناخته معادل calm است و اعلان بی‌مورد نمی‌سازد.
    expect(horrorLevelChangeMessage('calm', 'garbage')).toBe('');
  });

  it('پل مدل زمان‌محور ترس به سه سطح درست کار می‌کند', () => {
    expect(horrorLevelFromFear(0)).toBe('calm');
    expect(horrorLevelFromFear(0.31)).toBe('calm');
    expect(horrorLevelFromFear(0.32)).toBe('tense');
    expect(horrorLevelFromFear(0.63)).toBe('tense');
    expect(horrorLevelFromFear(0.64)).toBe('panic');
    expect(horrorLevelFromFear(1)).toBe('panic');
    expect(horrorLevelFromFear(Number.NaN)).toBe('calm');
  });

  it('برای هر سه سطح، متغیرهای CSS درست و متمایز ساخته می‌شود', () => {
    const seen = new Set<string>();
    for (const level of HORROR_LEVELS) {
      const vars = horrorSignalCssVars(level);
      expect(Object.keys(vars)).toEqual([
        '--horror-signal-pulse',
        '--horror-signal-vignette',
        '--horror-signal-grain',
        '--horror-signal-shake',
        '--horror-signal-heartbeat',
      ]);
      expect(vars['--horror-signal-pulse']).toBe(HORROR_LEVEL_STYLE[level].pulse.toFixed(3));
      expect(vars['--horror-signal-heartbeat']).toBe(`${HORROR_LEVEL_STYLE[level].heartbeatMs}ms`);
      seen.add(JSON.stringify(vars));
    }
    // سه سطح ⇒ سه استایل متمایز (نه یک ظاهر برای همه).
    expect(seen.size).toBe(3);
    // مقدار ناشناخته همان استایل آرام است.
    expect(horrorSignalCssVars('garbage')).toEqual(horrorSignalCssVars('calm'));
    expect(horrorSignalCssVars(null)).toEqual(horrorSignalCssVars('calm'));
  });

  it('سطح آرام حرکتی ندارد', () => {
    expect(isMotionLevel('calm')).toBe(false);
    expect(isMotionLevel('tense')).toBe(true);
    expect(isMotionLevel('panic')).toBe(true);
    expect(isMotionLevel('nonsense')).toBe(false);
  });
});

describe('فاز ۰۷-ب — کامپوننت HUD', () => {
  it('کلاینتی است و فقط یک prop سطح می‌گیرد', () => {
    expect(hudSource.startsWith("'use client';")).toBe(true);
    expect(hudSource).toContain('level: HorrorIntensity | string | null | undefined');
    expect(hudSource).toContain('normalizeHorrorLevel(level)');
    expect(hudSource).toContain('horrorSignalCssVars(safeLevel)');
  });

  it('هیچ وابستگی به موتور سه‌بعدی، صدا یا شبکه ندارد', () => {
    for (const forbidden of ["from '@/engine3d", "from '../../engine3d", 'three', 'fetch(', 'EventSource', 'localStorage']) {
      expect(hudSource, forbidden).not.toContain(forbidden);
    }
    for (const forbidden of ["from '@/engine3d", 'three']) {
      expect(signalSource, forbidden).not.toContain(forbidden);
    }
  });

  it('برچسب فارسی، اعلان زنده و لایهٔ تزئینی دسترس‌پذیر دارد', () => {
    expect(hudSource).toContain("data-level={safeLevel}");
    expect(hudSource).toContain('aria-hidden="true"');
    expect(hudSource).toContain('role="status"');
    expect(hudSource).toContain('aria-live="polite"');
    expect(hudSource).toContain('horror-signal-badge');
    expect(hudSource).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
    expect(hudSource).not.toContain('dangerouslySetInnerHTML');
  });

  it('در prefers-reduced-motion حرکت متوقف می‌شود ولی لبهٔ قرمز می‌ماند', () => {
    expect(signalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(signalCss).toMatch(/animation:\s*none\s*!important/);
    expect(signalCss).toContain('.horror-signal-vignette');
    expect(signalCss).toContain('.horror-signal-pulse');
    expect(signalCss).toContain('.horror-signal[data-level=\'panic\'] .horror-signal-dot');
  });

  it('لایه غیرمسدودکننده و مهارشده است', () => {
    expect(signalCss).toContain('pointer-events: none');
    expect(signalCss).toContain('max-width: 100vw');
    expect(signalCss).toContain('max-height: 100svh');
    const fontSizes = [...signalCss.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1].trim());
    for (const value of fontSizes) {
      expect(['var(--text-xs)', 'var(--text-sm)', 'var(--text-base)']).toContain(value);
    }
  });

  it('سیگنال در پوستهٔ کوچه به دادهٔ واقعی بازی وصل است', () => {
    expect(integration).toContain("import HorrorSignalHud from '../hud/horror/HorrorSignalHud'");
    expect(integration).toContain('<HorrorSignalHud level={horrorLevel}');
    expect(integration).toContain("transition?.phase === 'door_opening'");
  });
});
