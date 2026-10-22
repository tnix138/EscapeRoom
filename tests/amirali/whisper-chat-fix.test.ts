import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * نجوای گروهی — بازبینی امیرعلی
 * ---------------------------------------------------------------------------
 * باگ گزارش‌شده: «روی نجوای گروهی نمی‌توانم کلیک کنم، باز نمی‌شود.»
 *
 * علت: پنل در نمای سه‌بعدی داخل `.alley3d-chat` می‌نشیند که عمداً
 * `pointer-events: none` دارد تا بوم بازی زیرش قابل کشیدن بماند. این ویژگی
 * ارث می‌رسد و تنها override داخل مدیای گوشی/قاب کوتاه بود؛ پس روی دسکتاپ
 * هیچ کلیکی به دکمه نمی‌رسید.
 *
 * این فایل هم قرارداد CSS را می‌سنجد، هم اتصال درست پنل به نمای سه‌بعدی و
 * رفتار باز/بستهٔ کامپوننت را، تا باگ برنگردد.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const css = read('../../src/app/globals.css');
const scene3d = read('../../src/components/alley/AlleyRoomThreeIntegration.tsx');
const component = read('../../src/components/hud/WhisperChatPanel.tsx');

const MARKER = 'بازبینی امیرعلی — نجوای گروهی: کلیک‌پذیر شدن + منوی جمع‌وجورتر';
const markerAt = css.indexOf(MARKER);
const nextSection = markerAt >= 0 ? css.indexOf('\n/* ====', markerAt + 1) : -1;
const block = markerAt >= 0 ? css.slice(markerAt, nextSection > 0 ? nextSection : undefined) : '';
const beforeBlock = markerAt >= 0 ? css.slice(0, markerAt) : css;

describe('نجوای گروهی — کلیک‌پذیری روی دسکتاپ', () => {
  it('قاعدهٔ لمس‌پذیر کردن پنل بیرون از مدیا نوشته شده است', () => {
    expect(block).not.toBe('');
    expect(block).toMatch(
      /\.alley3d-chat > \.whisper-panel,\s*\.alley3d-chat > \.panel-scrim\s*\{\s*pointer-events:\s*auto;/,
    );
  });

  it('قاعدهٔ کلیک پیش از هر @media می‌آید تا روی دسکتاپ هم اعمال شود', () => {
    const ruleAt = block.search(/pointer-events:\s*auto/);
    const mediaAt = block.indexOf('@media');
    expect(ruleAt).toBeGreaterThanOrEqual(0);
    expect(mediaAt).toBeGreaterThan(ruleAt);
  });

  it('نگه‌دارندهٔ پنل همان‌طور غیرلمسی می‌ماند تا کلیک‌ها به بوم صحنه برسند', () => {
    expect(beforeBlock).toMatch(/\.alley3d-chat\s*\{[^}]*pointer-events:\s*none;/);
    // هیچ قاعده‌ای نباید خودِ نگه‌دارنده را لمس‌پذیر کند.
    expect(block).not.toMatch(/\.alley3d-chat\s*\{[^}]*pointer-events:\s*auto/);
  });

  it('هیچ قاعده‌ای کل پنل را از کلیک نمی‌اندازد', () => {
    expect(css).not.toMatch(/\.whisper-panel[^{]*\{[^}]*pointer-events:\s*none/);
  });

  it('پردهٔ پشت پنل هم کلیک‌پذیر است تا زدن بیرون آن را ببندد', () => {
    expect(component).toContain('className="panel-scrim"');
    expect(component).toContain('onClick={() => setOpen(false)}');
    expect(block).toMatch(/\.alley3d-chat > \.panel-scrim\s*\{\s*pointer-events:\s*auto;/);
  });

  it('پنل در نمای سه‌بعدی داخل همان نگه‌دارنده رندر می‌شود', () => {
    expect(scene3d).toMatch(
      /<div className="alley3d-chat">\s*<WhisperChatPanel[\s\S]*?open=\{chatOpen\}[\s\S]*?onOpenChange=\{setChatOpen\}/,
    );
  });

  it('چیدمان قدیمی موبایل (تب لبهٔ چپ) دست‌نخورده مانده است', () => {
    expect(css).toMatch(
      /@media \(max-width: 720px\), \(max-height: 560px\)[\s\S]*?\.alley3d-chat > \.whisper-panel,\s*\.whisper-panel\s*\{\s*pointer-events:\s*auto;/,
    );
  });
});

describe('نجوای گروهی — باز و بسته شدن', () => {
  it('دکمه با کلیک وضعیت را برمی‌گرداند و وضعیتش را اعلام می‌کند', () => {
    expect(component).toContain('function toggle()');
    expect(component).toContain('setOpen(!isOpen);');
    expect(component).toContain('onClick={toggle}');
    expect(component).toContain('aria-expanded={isOpen}');
    expect(component).toContain('aria-controls="whisper-body"');
  });

  it('Esc و پرده پنل را می‌بندند و فوکوس به دکمه برمی‌گردد', () => {
    expect(component).toContain("if (event.key !== 'Escape') return;");
    expect(component).toContain("document.addEventListener('keydown', onKeyDown)");
    expect(component).toContain('toggleRef.current?.focus({ preventScroll: true })');
  });

  it('باز شدن یک پنل دیگر نجوا را جمع می‌کند تا روی صحنه نیفتد', () => {
    expect(component).toContain("onOtherPanelOpen('whisper'");
    expect(component).toContain("announcePanelOpen('whisper')");
  });
});

describe('نجوای گروهی — منوی جمع‌وجورتر', () => {
  it('عرض پنل روی دسکتاپ حدود ۱۲٪ کم شده و از عرض قبلی بزرگ‌تر نیست', () => {
    expect(block).toMatch(/@media \(min-width: 721px\)/);
    expect(block).toMatch(/\.whisper-panel\s*\{\s*width:\s*300px;/);
    expect(block).toMatch(/\.whisper-panel\.whisper-expanded\s*\{\s*width:\s*324px;/);
    // مقدارهای قبلی برای مقایسه: ۳۴۰ بسته / ۳۸۰ باز.
    expect(300).toBeLessThan(340);
    expect(324).toBeLessThan(380);
  });

  it('فهرست پیام‌ها کوتاه‌تر و سربرگ جمع‌تر شده است', () => {
    expect(block).toMatch(/\.whisper-panel \.whisper-toggle\s*\{\s*min-height:\s*54px;/);
    expect(block).toMatch(/\.whisper-panel \.whisper-messages\s*\{\s*height:\s*206px;/);
    expect(206).toBeLessThan(248);
  });

  it('اندازهٔ متن‌ها کم نشده است (خوانایی دست‌نخورده)', () => {
    expect(block).not.toMatch(/font-size/);
  });
});
