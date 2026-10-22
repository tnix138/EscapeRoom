import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MOVEMENT_POINTER_HINT_MS,
  MOVEMENT_RELEASE_WINDOW_MS,
  describeMovementMode,
  movementNotice,
  resolveMovementMode,
} from '../../src/components/hud/narration/movement-notice';
import { keypadToggleHint, keypadToggleLabel } from '../../src/components/alley/puzzle-rules';

/**
 * بازبینی UI امیرعلی — ۱) اعلان دائمی «ماوس قفل شده» و ۲) کلید کشویی کیپد
 * ---------------------------------------------------------------------------
 * باگ گزارش‌شده: وقتی ماوس قفل می‌شد، یک بنر وسط صفحه می‌گفت «ماوس قفل شده» و
 * هیچ‌وقت نمی‌رفت (در بازی ماوس همیشه قفل است). حالا راهنما فقط چند ثانیه
 * می‌ماند، ولی اعلان‌های «حرکت قفل شد» (مودال/کات‌سین) سر جایشان هستند.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const noticeComponent = read('../../src/components/hud/MovementNotice.tsx');
const noticeRules = read('../../src/components/hud/narration/movement-notice.ts');
const modal = read('../../src/components/alley/TheaterDoorLockModal.tsx');
const puzzleRules = read('../../src/components/alley/puzzle-rules.ts');
const css = read('../../src/app/globals.css');

const MARKER = 'بازبینی امیرعلی — «کلید کشویی» صفحه‌کلید قفل';
const start = css.indexOf(MARKER);
const nextSection = css.indexOf('\n/* ====', start + 1);
const toggleCss = start >= 0 ? css.slice(start, nextSection > 0 ? nextSection : undefined) : '';
const PERSIAN = /[\u0600-\u06FF]/;

describe('بازبینی — راهنمای «ماوس قفل شده» دیگر دائمی نیست', () => {
  it('زمان قفل داده نشده → رفتار قبلی (نمایش) حفظ می‌شود', () => {
    const notice = movementNotice({ mode: 'pointer-lock' }, 0);
    expect(notice).not.toBeNull();
    expect(notice?.text).toBe('ماوس قفل شده');
    expect(notice?.tone).toBe('info');
    // سازگاری عقب‌رو: null صریح هم مثل «نامعلوم» رفتار می‌کند.
    expect(movementNotice({ mode: 'pointer-lock', pointerLockedAtMs: null }, 0)).not.toBeNull();
  });

  it('داخل پنجرهٔ کوتاه نمایش داده می‌شود', () => {
    const lockedAt = 10_000;
    for (const now of [lockedAt, lockedAt + 500, lockedAt + MOVEMENT_POINTER_HINT_MS - 1]) {
      const notice = movementNotice({ mode: 'pointer-lock', pointerLockedAtMs: lockedAt }, now);
      expect(notice, String(now)).not.toBeNull();
      expect(notice?.id).toBe('movement-pointer-lock');
    }
  });

  it('بعد از پنجره کاملاً محو می‌شود (باگ اصلی)', () => {
    const lockedAt = 10_000;
    for (const now of [
      lockedAt + MOVEMENT_POINTER_HINT_MS,
      lockedAt + MOVEMENT_POINTER_HINT_MS + 1,
      lockedAt + 60_000,
    ]) {
      expect(movementNotice({ mode: 'pointer-lock', pointerLockedAtMs: lockedAt }, now), String(now)).toBeNull();
    }
  });

  it('زمان نامعتبر fail-safe است و صفحه را برای همیشه شلوغ نمی‌کند', () => {
    // NaN → مثل «نامعلوم» رفتار می‌کنیم و راهنما را نشان می‌دهیم (کوتاه نیست ولی خراب هم نیست)
    expect(movementNotice({ mode: 'pointer-lock', pointerLockedAtMs: Number.NaN }, 0)).not.toBeNull();
    // ساعت عقب رفته / قفل در آینده → راهنما پنهان می‌شود، نه اینکه گیر کند
    expect(movementNotice({ mode: 'pointer-lock', pointerLockedAtMs: 5_000 }, 1_000)).toBeNull();
    // now نامعتبر
    expect(movementNotice({ mode: 'pointer-lock', pointerLockedAtMs: 1_000 }, Number.NaN)).toBeNull();
  });

  it('پنجره کوتاه و منطقی است (نه صفر، نه بی‌نهایت)', () => {
    expect(MOVEMENT_POINTER_HINT_MS).toBeGreaterThanOrEqual(2_000);
    expect(MOVEMENT_POINTER_HINT_MS).toBeLessThanOrEqual(8_000);
    expect(MOVEMENT_POINTER_HINT_MS).toBeGreaterThan(0);
  });

  it('اعلان‌های «حرکت قفل شد» دست‌نخورده و دائمی می‌مانند', () => {
    for (const mode of ['modal', 'cinematic'] as const) {
      for (const now of [0, 5_000, 500_000]) {
        const notice = movementNotice({ mode }, now);
        expect(notice, `${mode}@${now}`).not.toBeNull();
        expect(notice?.tone).toBe('locked');
        expect(notice?.detail).toMatch(PERSIAN);
      }
    }
    expect(describeMovementMode('modal')).toMatch(PERSIAN);
    expect(describeMovementMode('pointer-lock')).toMatch(PERSIAN);
  });

  it('اعلان «حرکت آزاد شد» همچنان پنجرهٔ خودش را دارد', () => {
    const released = 1_000;
    expect(movementNotice({ mode: 'free', releasedAtMs: released }, released + 10)).not.toBeNull();
    expect(
      movementNotice({ mode: 'free', releasedAtMs: released }, released + MOVEMENT_RELEASE_WINDOW_MS),
    ).toBeNull();
  });

  it('اولویت حالت‌ها عوض نشده است', () => {
    expect(resolveMovementMode({ cinematic: true, modalOpen: true, pointerLocked: true })).toBe('cinematic');
    expect(resolveMovementMode({ modalOpen: true, pointerLocked: true })).toBe('modal');
    expect(resolveMovementMode({ pointerLocked: true })).toBe('pointer-lock');
    expect(resolveMovementMode({})).toBe('free');
  });

  it('کامپوننت زمان قفل را ثبت و پس از پنجره رندر تازه می‌گیرد', () => {
    expect(noticeComponent).toContain('const lockStartedAt = useRef<number | null>(null);');
    expect(noticeComponent).toContain('lockStartedAt.current = Date.now();');
    expect(noticeComponent).toContain('const timer = window.setTimeout(refresh, remaining + 16);');
    expect(noticeComponent).toContain('window.clearTimeout(timer)');
    expect(noticeComponent).toContain('pointerLockedAtMs: lockStartedAt.current');
    // با خروج از حالت قفل، زمان پاک می‌شود تا قفل بعدی پنجرهٔ تازه بگیرد.
    expect(noticeComponent).toContain('lockStartedAt.current = null;');
    // هیچ تایمری برای «دائمی نگه‌داشتن» وجود ندارد.
    expect(noticeComponent).not.toContain('setInterval');
    expect(noticeRules).toContain('MOVEMENT_POINTER_HINT_MS');
  });
});

describe('بازبینی — کلید کشویی صفحه‌کلید معما', () => {
  it('برچسب کشو فارسی، روشن و برای هر دو وضعیت متمایز است', () => {
    const open = keypadToggleLabel(true);
    const closed = keypadToggleLabel(false);
    expect(open).toMatch(PERSIAN);
    expect(closed).toMatch(PERSIAN);
    expect(open).not.toBe(closed);
    expect(keypadToggleHint(true)).toMatch(PERSIAN);
    expect(keypadToggleHint(false)).toMatch(PERSIAN);
    expect(keypadToggleHint(true)).not.toBe(keypadToggleHint(false));
    // برچسب برای صفحه‌خوان باید کوتاه و بدون نویسهٔ لاتین باشد.
    expect(open).not.toMatch(/[A-Za-z]/);
    expect(closed).not.toMatch(/[A-Za-z]/);
  });

  it('مودال، دکمه را با aria-expanded و aria-controls دارد', () => {
    expect(modal).toContain('aria-expanded={showKeypad}');
    expect(modal).toContain('aria-controls="door-lock-keypad"');
    expect(modal).toContain('id="door-lock-keypad"');
    expect(modal).toContain('hidden={!showKeypad}');
    expect(modal).toContain('keypadToggleLabel(showKeypad)');
    expect(modal).toContain('keypadToggleHint(showKeypad)');
    expect(puzzleRules).toContain('export function keypadToggleLabel');
  });

  it('بستن کیپد، ورودی متنی و دکمهٔ قفل را از بین نمی‌برد', () => {
    const keypadBlock = modal.slice(modal.indexOf('id="door-lock-keypad"'));
    const restOfForm = modal.slice(0, modal.indexOf('id="door-lock-keypad"'));
    // ورودی متنی و اسلات‌ها قبل از بلوک کیپد و بیرون از آن هستند.
    expect(restOfForm).toContain('id="theater-door-code"');
    expect(restOfForm).toContain('lock-slots');
    // دکمهٔ چرخاندن قفل بعد از کیپد و در فرم باقی می‌ماند.
    expect(keypadBlock).toContain('unlock-button');
    // فقط خود بلوک کیپد مخفی می‌شود، نه کل فرم.
    expect(modal.match(/hidden=\{!showKeypad\}/g)).toHaveLength(1);
  });

  it('با باز شدن دوبارهٔ مودال، کیپد به حالت پیش‌فرض باز برمی‌گردد', () => {
    expect(modal).toContain('const [showKeypad, setShowKeypad] = useState(true);');
    expect(modal).toContain('setShowKeypad(true);');
    // ریست فقط در مسیر بسته‌شدن مودال انجام می‌شود.
    const resetBlock = modal.slice(modal.indexOf("if (!open) {"));
    expect(resetBlock.slice(0, 260)).toContain('setShowKeypad(true);');
  });

  it('دکمهٔ کشویی ۴۴px لمس دارد و کیپدِ بسته واقعاً حذف می‌شود', () => {
    expect(toggleCss).toMatch(/\.keypad-toggle\s*\{[^}]*min-height:\s*44px/s);
    expect(toggleCss).toContain('.brass-keypad[hidden]');
    expect(toggleCss).toMatch(/\.brass-keypad\[hidden\]\s*\{\s*display:\s*none;/);
    expect(toggleCss).toContain(':focus-visible');
    // فونت‌ها فقط از توکن‌های موجود استفاده می‌کنند تا با تست اندازهٔ متن تصادم نکند.
    const fontSizes = [...toggleCss.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1].trim());
    for (const value of fontSizes) {
      expect(['var(--text-xs)', 'var(--text-sm)', 'var(--text-base)']).toContain(value);
    }
  });

  it('دکمهٔ کشویی از نوع button است تا فرم را ناخواسته ارسال نکند', () => {
    const toggleIndex = modal.indexOf('className="keypad-toggle"');
    const snippet = modal.slice(toggleIndex - 120, toggleIndex + 60);
    expect(snippet).toContain('type="button"');
  });
});
