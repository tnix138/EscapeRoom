import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHANDELIER_FALL_AT_MS, SLAM_IMPACTS } from '../../src/components/cinema/cutscene-timing';
import { CUTSCENE_DURATION_MS } from '../../src/components/hud/narration/narration-track';
import {
  FEAR_LEVELS,
  FLASH_DURATION_MS,
  HORROR_CUES,
  HORROR_WINDOW,
  MAX_FLASHES_PER_SECOND,
  MIN_FLASH_GAP_MS,
  describeFearState,
  effectsAt,
  fearAt,
  fearTone,
  flashAt,
  flashCountBetween,
  overlayAt,
  shakePxAt,
  toneLabel,
  visibleAt,
  type HorrorEffects,
} from '../../src/components/hud/horror/horror-hud';

/**
 * فاز ۰۷ — HUD ترس (امیرعلی)
 * ---------------------------------------------------------------------------
 * این فایل قرارداد سمت UI را نگه می‌دارد: ترس تابعی خالص از elapsedMs است،
 * پردهٔ جامپ‌اسکر فقط در سه لحظهٔ بزرگ باز می‌شود، فلاش نوری از ۳ بار در ثانیه
 * بیشتر نمی‌شود و در prefers-reduced-motion لرزش/فلاش صفر می‌شود.
 * زمان‌های کوبش و لوستر باید دقیقاً با تایم‌لاین سه‌بعدی علیرضا هم‌تراز بمانند.
 */

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const css = read('../../src/app/globals.css');
const hudSource = read('../../src/components/hud/horror/HorrorHud.tsx');
const overlaySource = read('../../src/components/hud/horror/JumpScareOverlay.tsx');

const HORROR_CSS_START = css.indexOf('فاز ۰۷ — HUD ترس');
const horrorCss = HORROR_CSS_START >= 0 ? css.slice(HORROR_CSS_START) : '';

function cssRule(selector: string): string {
  const start = horrorCss.indexOf(`${selector} {`);
  if (start < 0) return '';
  const end = horrorCss.indexOf('}', start);
  return horrorCss.slice(start, end);
}

const PERSIAN_TEXT = /[\u0600-\u06FF]/;
const LATIN_LETTERS = /[A-Za-z]/;

describe('فاز ۰۷ — مدل ترس خالص', () => {
  it('ورودی نامعتبر را صفر می‌کند و خروجی همیشه در بازهٔ ۰ تا ۱ است', () => {
    expect(fearAt(Number.NaN)).toBe(0);
    expect(fearAt(Number.POSITIVE_INFINITY)).toBe(0);
    expect(shakePxAt(Number.NaN)).toBe(0);
    expect(visibleAt(Number.NaN)).toBe(false);

    for (const t of [-5_000, 0, 10_000, 45_000, 57_000, 67_500, 120_000]) {
      const fear = fearAt(t);
      expect(fear, String(t)).toBeGreaterThanOrEqual(0);
      expect(fear, String(t)).toBeLessThanOrEqual(1);
    }
  });

  it('با نزدیک شدن به اوج، ترس بالا می‌رود و بعد از کات‌سین فروکش می‌کند', () => {
    expect(fearAt(10_000)).toBeLessThan(0.2);
    expect(fearAt(45_000)).toBeGreaterThan(fearAt(10_000));
    expect(fearAt(57_000)).toBeGreaterThan(fearAt(45_000));
    expect(fearAt(57_000)).toBeGreaterThanOrEqual(FEAR_LEVELS.terror);
    expect(fearAt(67_500)).toBeGreaterThan(0.95);
    expect(fearAt(80_000)).toBeLessThan(0.2);
  });

  it('آستانه‌ها آرام، دلواپس و وحشت را جدا می‌کنند و برچسب فارسی دارند', () => {
    expect(fearTone(0)).toBe('calm');
    expect(fearTone(FEAR_LEVELS.uneasy)).toBe('uneasy');
    expect(fearTone(FEAR_LEVELS.terror)).toBe('terror');
    expect(fearTone(Number.NaN)).toBe('calm');
    expect(toneLabel('calm')).toBe('آرام');
    expect(toneLabel('uneasy')).toBe('دلواپس');
    expect(toneLabel('terror')).toBe('وحشت');
    for (const tone of ['calm', 'uneasy', 'terror'] as const) {
      expect(toneLabel(tone)).toMatch(PERSIAN_TEXT);
      expect(toneLabel(tone)).not.toMatch(LATIN_LETTERS);
    }
  });

  it('درصد ترس با رقم فارسی و برای صفحه‌خوان خوانا است', () => {
    const effects = effectsAt(57_000);
    expect(effects.fearPercentLabel).toMatch(/^[۰-۹]+٪$/);
    expect(describeFearState(effects)).toMatch(PERSIAN_TEXT);
    expect(describeFearState(effects)).toContain('وحشت');
    expect(describeFearState(effects)).not.toMatch(LATIN_LETTERS);
  });
});

describe('فاز ۰۷ — کیوهای هم‌تراز با تایم‌لاین کات‌سین', () => {
  it('کیوها مرتب، در پنجرهٔ کات‌سین و با شدت معتبر هستند', () => {
    const times = HORROR_CUES.map((cue) => cue.atMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const cue of HORROR_CUES) {
      expect(cue.atMs).toBeGreaterThanOrEqual(40_000);
      expect(cue.atMs).toBeLessThan(CUTSCENE_DURATION_MS);
      expect(cue.durationMs).toBeGreaterThan(0);
      expect(cue.intensity).toBeGreaterThanOrEqual(0);
      expect(cue.intensity).toBeLessThanOrEqual(1);
      expect(new Set([cue.id]).size).toBe(1);
    }
    expect(new Set(HORROR_CUES.map((cue) => cue.id)).size).toBe(HORROR_CUES.length);
    expect(HORROR_WINDOW.endMs).toBe(CUTSCENE_DURATION_MS);
  });

  it('شش کوبش دقیقاً روی لحظه‌های تایم‌لاین سه‌بعدی می‌نشیند', () => {
    const slamCues = HORROR_CUES.filter((cue) => cue.kind === 'slam');
    expect(slamCues).toHaveLength(SLAM_IMPACTS.length);
    expect(slamCues.map((cue) => cue.atMs)).toEqual(SLAM_IMPACTS.map((impact) => impact.atMs));
    const fall = HORROR_CUES.find((cue) => cue.id === 'chandelier-fall');
    expect(fall?.atMs).toBe(CHANDELIER_FALL_AT_MS);
    expect(fall && 'chandelier-shatter' in fall).toBe(false);
    expect(HORROR_CUES.some((cue) => cue.id === 'chandelier-shatter')).toBe(true);
  });

  it('متن‌ها فارسی‌اند و هیچ رقم یا پاسخ معمایی ندارند', () => {
    for (const cue of HORROR_CUES) {
      expect(cue.headline, cue.id).toMatch(PERSIAN_TEXT);
      expect(cue.subline, cue.id).toMatch(PERSIAN_TEXT);
      expect(cue.headline, cue.id).not.toMatch(/[0-9۰-۹]/);
      expect(cue.subline, cue.id).not.toMatch(/[0-9۰-۹]/);
      expect(cue.headline, cue.id).not.toMatch(/کد|رمز|ترکیب/);
      expect(cue.subline, cue.id).not.toMatch(/کد|رمز|ترکیب/);
    }
  });
});

describe('فاز ۰۷ — پردهٔ جامپ‌اسکر', () => {
  it('پرده فقط در سه لحظهٔ بزرگ و بدون هم‌پوشانی باز می‌شود', () => {
    const overlays = HORROR_CUES.filter((cue) => cue.overlay).sort((a, b) => a.atMs - b.atMs);
    expect(overlays.map((cue) => cue.id)).toEqual(['hand-rejection', 'choke-lift', 'vanish']);
    for (let index = 1; index < overlays.length; index += 1) {
      const previous = overlays[index - 1];
      expect(overlays[index].atMs, previous.id).toBeGreaterThanOrEqual(previous.atMs + previous.durationMs);
    }
  });

  it('در هر لحظه حداکثر یک پردهٔ فعال است و بعد از پایانش بسته می‌شود', () => {
    expect(overlayAt(49_000)).toBeNull();
    expect(overlayAt(49_600)?.cue.id).toBe('hand-rejection');
    expect(overlayAt(50_500)?.cue.id).toBe('hand-rejection');
    expect(overlayAt(51_300)).toBeNull();
    expect(overlayAt(56_000)?.cue.id).toBe('choke-lift');
    expect(overlayAt(65_500)).toBeNull();
    expect(overlayAt(67_000)?.cue.id).toBe('vanish');
    expect(overlayAt(69_300)).toBeNull();
  });

  it('زمان باقی‌مانده و پیشرفت پرده با گذشت زمان درست تغییر می‌کند', () => {
    const start = overlayAt(49_600);
    const middle = overlayAt(50_400);
    expect(start?.remainingMs).toBe(1_600);
    expect(start?.progress).toBe(0);
    expect(middle?.remainingMs).toBe(800);
    expect(middle?.progress).toBeCloseTo(0.5, 5);
    expect(middle && start && middle.remainingMs < start.remainingMs).toBe(true);
  });
});

describe('فاز ۰۷ — ایمنی فلاش و حالت کم‌حرکت', () => {
  it('در هیچ پنجرهٔ یک‌ثانیه‌ای بیش از ۳ فلاش رخ نمی‌دهد', () => {
    expect(MAX_FLASHES_PER_SECOND).toBe(3);
    expect(MIN_FLASH_GAP_MS).toBeGreaterThanOrEqual(Math.ceil(1_000 / MAX_FLASHES_PER_SECOND));
    for (const cue of HORROR_CUES) {
      expect(
        flashCountBetween(cue.atMs, cue.atMs + 1_000),
        `پنجرهٔ ${cue.id}`,
      ).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
    }
    expect(flashCountBetween(40_000, 74_000)).toBeLessThanOrEqual(12);
  });

  it('هر فلاش فقط در ۱۲۰ میلی‌ثانیهٔ آغاز کیو روشن است', () => {
    const cue = HORROR_CUES.find((entry) => entry.id === 'choke-lift');
    expect(cue).toBeTruthy();
    const at = cue?.atMs ?? 0;
    expect(flashAt(at - 1)).toBe(0);
    expect(flashAt(at)).toBeGreaterThan(0);
    expect(flashAt(at + FLASH_DURATION_MS - 1)).toBeGreaterThan(0);
    expect(flashAt(at + FLASH_DURATION_MS)).toBe(0);
  });

  it('حالت کم‌حرکت لرزش و فلاش را صفر می‌کند ولی متن پرده می‌ماند', () => {
    const motion = effectsAt(56_000, { reducedMotion: false });
    const still = effectsAt(56_000, { reducedMotion: true });
    expect(motion.shakePx).toBeGreaterThan(0);
    expect(motion.flashIntensity).toBeGreaterThan(0);
    expect(still.shakePx).toBe(0);
    expect(still.flashIntensity).toBe(0);
    expect(still.overlay?.cue.id).toBe('choke-lift');
    expect(effectsAt(57_000, { shakeScale: 0 }).shakePx).toBe(0);
  });
});

describe('فاز ۰۷ — خروجی رندر HUD', () => {
  it('لرزش، پالس و مه با ترس شدیدتر می‌شوند و از سقف عبور نمی‌کنند', () => {
    const calm = effectsAt(10_000);
    const climax = effectsAt(57_000);
    expect(climax.pulseOpacity).toBeGreaterThan(calm.pulseOpacity);
    expect(climax.vignetteOpacity).toBeGreaterThan(calm.vignetteOpacity);
    expect(climax.grainOpacity).toBeGreaterThan(calm.grainOpacity);
    expect(climax.shakePx).toBeLessThanOrEqual(8);
    for (const value of [climax.pulseOpacity, climax.vignetteOpacity, climax.grainOpacity]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('پنجرهٔ نمایش از ۳۵ ثانیه تا ۷۴ ثانیه است', () => {
    expect(visibleAt(34_999)).toBe(false);
    expect(visibleAt(35_000)).toBe(true);
    expect(visibleAt(74_000)).toBe(true);
    expect(visibleAt(74_001)).toBe(false);
    expect(effectsAt(10_000).visible).toBe(false);
    expect(effectsAt(56_000).visible).toBe(true);
  });

  it('پاسخ صفحه‌خوان برای هر سه حالت یکتا و کوتاه است', () => {
    const make = (fear: number): HorrorEffects => effectsAt(fear);
    const calm = describeFearState(make(10_000));
    const uneasy = describeFearState(make(50_000));
    const terror = describeFearState(make(57_000));
    expect(new Set([calm, uneasy, terror]).size).toBe(3);
    for (const text of [calm, uneasy, terror]) {
      expect(text.length).toBeLessThan(64);
      expect(text).toMatch(PERSIAN_TEXT);
    }
  });
});

describe('فاز ۰۷ — قرارداد دسترس‌پذیری در کد و CSS', () => {
  it('کامپوننت کلاینتی است و تغییر حالت را مؤدبانه اعلام می‌کند', () => {
    expect(hudSource.startsWith("'use client';")).toBe(true);
    expect(hudSource).toContain('role="status"');
    expect(hudSource).toContain('aria-live="polite"');
    expect(hudSource).toContain('aria-hidden="true"');
    expect(hudSource).toContain('data-tone={effects.tone}');
    expect(hudSource).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
    expect(hudSource).toContain('query.addEventListener');
    expect(hudSource).not.toContain('dangerouslySetInnerHTML');
  });

  it('پردهٔ جامپ‌اسکر یک alert مستقل و بدون HTML تزریقی است', () => {
    expect(overlaySource.startsWith("'use client';")).toBe(true);
    expect(overlaySource).toContain('role="alert"');
    expect(overlaySource).toContain('aria-live="assertive"');
    expect(overlaySource).toContain('aria-atomic="true"');
    expect(overlaySource).toContain('onSkip');
    expect(overlaySource).toContain('رد کردن صحنه');
    expect(overlaySource).not.toContain('dangerouslySetInnerHTML');
  });

  it('لایهٔ HUD تزئینی و غیرمسدودکننده است و از عرض صفحه بیرون نمی‌زند', () => {
    const hudRule = cssRule('.horror-hud');
    expect(hudRule).toContain('position: fixed');
    expect(hudRule).toContain('pointer-events: none');
    expect(hudRule).toContain('max-width: 100vw');
    expect(cssRule('.jump-scare-overlay')).toContain('pointer-events: none');
    expect(cssRule('.jump-scare-skip')).toContain('pointer-events: auto');
    expect(cssRule('.jump-scare-skip')).toContain('min-height: var(--control-height)');
  });

  it('با prefers-reduced-motion همهٔ انیمیشن‌ها و فلاش خاموش می‌شوند', () => {
    expect(horrorCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(horrorCss).toMatch(/\.horror-flash\s*\{\s*display:\s*none;/);
    expect(horrorCss).toMatch(/animation:\s*none\s*!important/);
  });

  it('هیچ اندازهٔ متن زیر ۱۲px و هیچ min-width بزرگ‌تر از ۲۸۸px در بخش ترس نیست', () => {
    const violations: string[] = [];
    const fontSizes = horrorCss.matchAll(/font-size:\s*([^;]+);/g);
    for (const match of fontSizes) {
      const value = match[1].trim();
      let px: number | null = null;
      if (value.includes('var(--text-xs)')) px = 12;
      else if (value.includes('var(--text-sm)')) px = 14;
      else if (value.includes('var(--text-base)')) px = 16;
      else if (value.includes('var(--text-lg)')) px = 18;
      else {
        const rem = /([\d.]+)rem/.exec(value);
        const rawPx = /(^|[\s,(])([\d.]+)px/.exec(value);
        if (rem) px = Number(rem[1]) * 16;
        else if (rawPx) px = Number(rawPx[2]);
      }
      if (px !== null && px < 12) violations.push(value);
    }
    for (const match of horrorCss.matchAll(/(?:^|[;{\s])min-width:\s*([^;]+);/g)) {
      const value = match[1].trim();
      if (value === 'var(--control-height)') continue;
      const px = Number((/([\d.]+)px/.exec(value) ?? [])[1] ?? 0);
      if (px > 288) violations.push(`min-width: ${value}`);
    }
    expect(violations).toEqual([]);
  });
});
