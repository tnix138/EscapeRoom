import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * بازبینی امیرعلی — انتقال «هم‌سفران تماشاخانه» به گوشهٔ بالا-راست (دسکتاپ و گوشی) بدون باگ UI
 * -------------------------------------------------------------------------------------------
 * خواسته‌ها:
 *  ۱) در نمای سه‌بعدی دسکتاپ (۱۹۲۰×۱۰۸۰ تا ۷۲۱×۵۶۰)، «هم‌سفران تماشاخانه» دیگر در ارتفاع ۷۶px
 *     پایین‌تر از سقف معلق نباشد؛ دقیقاً به گوشهٔ بالا-راست برود (روبه‌روی دکمهٔ «نمای کلاسیک»
 *     در گوشهٔ بالا-چپ) و هیچ تداخلی با بلیط، نجوا، اعلان حرکت یا نوار ابزار نداشته باشد.
 *  ۲) روی گوشی (عمودی ۳۲۰–۷۲۰px و افقی ≤۵۶۰px)، تب و کشوی «هم‌سفران تماشاخانه» در گوشهٔ
 *     بالا-راست بنشیند، دکمهٔ «نمای کلاسیک» (z-index: 50) از روی کشوی باز بیرون نزند و در
 *     نمای کلاسیک گوشی روی سربرگ «پردهٔ سرخ» نیفتد.
 *  ۳) در نمای کلاسیک دسکتاپ (dir="rtl")، `justify-content: flex-start` پنل را واقعاً در سمت
 *     راست نگه دارد (نه چپ روی نجوای گروهی) و اسکرول افقیِ اضافی پنل بلیط حذف شود.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const css = read('../../src/app/globals.css');
const roomShellCss = read('../../src/app/room/[code]/page.module.css');
const companionHud = read('../../src/components/hud/TheaterCompanionHud.tsx');
const layout = read('../../src/app/layout.tsx');

const COMPACT_MARKER = 'بازبینی امیرعلی — چیدمان فشرده و بدون تداخلِ HUD';
const compactStart = css.indexOf(COMPACT_MARKER);
const compactEnd = css.indexOf('\n/* ====', compactStart + 1);
const compactBlock = css.slice(compactStart, compactEnd > 0 ? compactEnd : undefined);

function token(name: string): number {
  const match = compactBlock.match(new RegExp(`${name}:\\s*(-?[\\d.]+)px\\s*;`));
  if (!match) throw new Error(`توکن ${name} پیدا نشد`);
  return Number(match[1]);
}

function mediaBlock(media: string): string {
  const start = css.indexOf(`${media} {`);
  if (start === -1) return '';
  let depth = 0;
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, index + 1);
    }
  }
  return css.slice(start);
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const box = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  right: left + width,
  top,
  bottom: top + height,
});

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('هم‌سفران تماشاخانه — گوشهٔ بالا-راست در نمای سه‌بعدی دسکتاپ', () => {
  const DESKTOP_VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 900, height: 700 },
    { width: 721, height: 640 },
    { width: 721, height: 560 },
  ];

  it('توکن گوشهٔ بالا-راست تعریف شده و واقعاً در گوشه است (نه ۷۶px پایین‌تر)', () => {
    const companionTop = token('--hud-companion-top');
    const whisperTop = token('--hud-top');
    expect(companionTop).toBeGreaterThanOrEqual(8);
    expect(companionTop).toBeLessThanOrEqual(16);
    expect(companionTop).toBeLessThan(whisperTop - 48);
  });

  it('قاعدهٔ دسکتاپ، پنل را با احتساب safe-area به گوشهٔ بالا-راست می‌چسباند', () => {
    expect(compactBlock).toMatch(
      /\.theater-companion-hud\s*\{[^}]*top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*var\(--hud-companion-top\)\);[^}]*right:\s*calc\(env\(safe-area-inset-right,\s*0px\)\s*\+\s*var\(--hud-edge\)\);/s,
    );
  });

  it('در صفحهٔ پیش‌نمایش، پنل داخل قاب بوم سه‌بعدی مهار می‌شود تا روی نوار راهنما نیفتد', () => {
    expect(compactBlock).toMatch(
      /\.alley-preview-wrap \.alley3d-surface > \.theater-companion-hud\s*\{\s*position:\s*absolute;\s*\}/s,
    );
  });

  it.each(DESKTOP_VIEWPORTS)(
    'بدون تداخل با دکمهٔ «نمای کلاسیک»، نجوا، اعلان حرکت و بلیط (شامل عنوان بلیط) — $width×$height',
    ({ width, height }) => {
      const edge = token('--hud-edge');
      const companionTop = token('--hud-companion-top');
      const whisperTop = token('--hud-top');
      const bottom = token('--hud-bottom');
      const budget = (height - whisperTop - bottom - 44 - 46 - 24) / 2;

      // دکمهٔ «نمای کلاسیک» در سند RTL روی inset-inline-end (= چپ) می‌نشیند.
      expect(layout).toContain('dir="rtl"');
      expect(roomShellCss).toMatch(/\.sceneToolbar\s*\{[^}]*inset-inline-end:/s);
      const toolbar = box(8, 8, 136, 38);

      const companionClosed = box(
        width - edge - token('--hud-w-companion'),
        companionTop,
        token('--hud-w-companion'),
        44,
      );
      const companionOpen = box(
        width - edge - token('--hud-w-companion'),
        companionTop,
        token('--hud-w-companion'),
        44 + Math.min(300, budget),
      );
      const whisperOpen = box(edge, whisperTop, token('--hud-w-whisper-open'), 260);
      // عنوان بالای کارت بلیط + پدینگ ظرف بیرونی حدود ۴۲px به ارتفاع اسکرول بلیط اضافه می‌کند.
      const ticketFullHeight = 42 + Math.min(300, budget);
      const ticket = box(
        width - 12 - 360,
        height - bottom - ticketFullHeight,
        360,
        ticketFullHeight,
      );

      expect(overlaps(companionClosed, toolbar), 'همسفران و دکمهٔ نمای کلاسیک').toBe(false);
      expect(overlaps(companionOpen, toolbar), 'همسفرانِ باز و دکمهٔ نمای کلاسیک').toBe(false);
      expect(overlaps(companionOpen, whisperOpen), 'همسفرانِ باز و نجوای باز').toBe(false);
      expect(overlaps(companionOpen, ticket), 'همسفرانِ باز و کل جعبهٔ بلیط').toBe(false);
      expect(ticket.top - companionOpen.bottom).toBeGreaterThanOrEqual(24);
    },
  );

  it('جعبهٔ اسکرول بلیط در نمای سه‌بعدی اسکرول افقیِ مزاحم ندارد', () => {
    expect(compactBlock).toMatch(
      /\.alley3d-ticket \.held-tickets-scroll\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;[^}]*scrollbar-width:\s*thin;/s,
    );
  });
});

describe('هم‌سفران تماشاخانه — گوشهٔ بالا-راست روی گوشی (عمودی و افقی)', () => {
  const mobileBlock = mediaBlock('@media (max-width: 720px), (max-height: 560px)');
  const landscapeBlock = mediaBlock('@media (orientation: landscape) and (max-height: 560px)');
  const MOBILE_WIDTHS = [320, 360, 390, 430, 720];

  it('تب بسته و کشوی باز هر دو به گوشهٔ بالا-راست گوشی منتقل شده‌اند', () => {
    expect(mobileBlock).toMatch(
      /\.theater-companion-hud\s*\{[^}]*top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*8px\);[^}]*right:\s*0;/s,
    );
    expect(mobileBlock).toMatch(
      /\.theater-companion-hud\.is-open\s*\{[^}]*top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*8px\);/s,
    );
  });

  it.each(MOBILE_WIDTHS)('تب بسته با دکمهٔ «نمای کلاسیک» در عرض %ipx برخورد ندارد', (width) => {
    const tabWidth = width <= 360 ? 40 : 44;
    // در RTL، sceneToolbar در چپ (x: 8..140) و تب همسفران در راست (x: width - tabWidth .. width) است.
    const toolbar = box(8, 8, 132, 44);
    const companionTab = box(width - tabWidth, 8, tabWidth, 52);
    expect(overlaps(toolbar, companionTab)).toBe(false);
    expect(companionTab.left - toolbar.right).toBeGreaterThanOrEqual(130);
  });

  it('وقتی کشوی گوشی باز می‌شود، پرده و کشو بالاتر از نوار ابزار (۵۰) و زیر برگهٔ بلیط (۶۰) هستند', () => {
    const toolbarZ = Number(roomShellCss.match(/\.sceneToolbar\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
    const scrimZ = Number(mobileBlock.match(/\.panel-scrim\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
    const openCompanionZ = Number(
      mobileBlock.match(/\.theater-companion-hud\.is-open\s*\{[^}]*z-index:\s*(\d+)/s)?.[1],
    );
    const openWhisperZ = Number(
      mobileBlock.match(/\.whisper-panel\.whisper-expanded\s*\{[^}]*z-index:\s*(\d+)/s)?.[1],
    );
    const ticketSheetZ = Number(
      mobileBlock.match(/\.alley3d-panels\.is-open\s*\{[^}]*z-index:\s*(\d+)/s)?.[1],
    );
    const helpZ = Number(mobileBlock.match(/\.controls-help\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);

    expect(toolbarZ).toBe(50);
    expect(scrimZ).toBeGreaterThan(toolbarZ);
    expect(openCompanionZ).toBeGreaterThan(scrimZ);
    expect(openWhisperZ).toBeGreaterThan(scrimZ);
    expect(ticketSheetZ).toBeGreaterThan(openCompanionZ);
    expect(helpZ).toBeGreaterThan(ticketSheetZ);
  });

  it('در حالت افقی گوشی، تب نجوا زیر دکمهٔ «نمای کلاسیک» می‌رود و تب همسفران در گوشهٔ بالا-راست می‌ماند', () => {
    expect(landscapeBlock).toMatch(
      /\.whisper-panel\s*\{\s*top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*58px\);/s,
    );
    expect(landscapeBlock).toMatch(
      /\.theater-companion-hud\s*\{\s*top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*8px\);/s,
    );
  });
});

describe('هم‌سفران تماشاخانه — نمای کلاسیک و دسترس‌پذیری کیبورد', () => {
  it('در نمای کلاسیک دسکتاپ (RTL) واقعاً سمت راست می‌نشیند و کانتکست لایه‌ای موبایل را قفل نمی‌کند', () => {
    expect(css).toMatch(/\.alley-classic-companion\s*\{[^}]*justify-content:\s*flex-start;/s);
    expect(css).toMatch(
      /@media \(max-width: 720px\)\s*\{\s*\.alley-classic-companion\s*\{[^}]*z-index:\s*auto;/s,
    );
    expect(css).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.alley-classic-companion \.theater-companion-hud:not\(\.is-open\)\s*\{\s*top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*96px\);/s,
    );
    expect(css).toMatch(
      /@media \(min-width: 721px\) and \(max-height: 560px\)\s*\{\s*\.alley-classic-companion\s*\{[^}]*z-index:\s*auto;/s,
    );
  });

  it('با کلید Escape بسته می‌شود و فوکوس را به دکمهٔ سربرگ برمی‌گرداند (کلیدهای دیگر نادیده گرفته می‌شوند)', () => {
    expect(companionHud).toContain("if (event.key !== 'Escape') return;");
    expect(companionHud).toContain('setIsOpen(false)');
    expect(companionHud).toContain('toggleRef.current?.focus({ preventScroll: true })');
    expect(companionHud).toContain('ref={toggleRef}');
  });
});
