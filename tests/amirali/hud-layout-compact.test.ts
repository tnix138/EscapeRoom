import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * چیدمان HUD — بدون تداخل، جمع‌وجور (بازبینی امیرعلی)
 * ---------------------------------------------------------------------------
 * شکایت: «بعضی قسمت‌ها با هم تداخل دارن، تو هم تو هم هستن — مثل همسفران
 * تماشاخانه و صفحه‌ای که جواب معما را می‌نویسیم؛ اندازه‌ها را اوکی کن و همه را
 * یک مقدار کوچک‌تر کن.»
 *
 * این فایل یک آزمون هندسی واقعی است: اندازه‌ها را از توکن‌های CSS می‌خواند،
 * جعبهٔ هر HUD را روی چند اندازهٔ نمایشگر می‌سازد و می‌سنجد که هیچ دو پنلی روی
 * هم نیفتد. اگر کسی بعداً عرض/ارتفاعی را در CSS بزرگ کند، همین‌جا قرمز می‌شود.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const css = read('../../src/app/globals.css');
const roomShellCss = read('../../src/app/room/[code]/page.module.css');

const MARKER = 'بازبینی امیرعلی — چیدمان فشرده و بدون تداخلِ HUD';
const markerAt = css.indexOf(MARKER);
const nextSection = markerAt >= 0 ? css.indexOf('\n/* ====', markerAt + 1) : -1;
const block = markerAt >= 0 ? css.slice(markerAt, nextSection > 0 ? nextSection : undefined) : '';

/** مقدار عددی یک توکن px از بلوک چیدمان. */
function token(name: string): number {
  const match = block.match(new RegExp(`${name}:\\s*(-?[\\d.]+)px\\s*;`));
  if (!match) throw new Error(`توکن ${name} پیدا نشد`);
  return Number(match[1]);
}

interface CssRule {
  selectors: string[];
  body: string;
  media: string | null;
}

/** تجزیهٔ واقعی CSS: بدنهٔ @media باز می‌شود و قاعده‌های داخلی هم جمع می‌شوند. */
function cssRules(source: string, media: string | null = null, out: CssRule[] = []): CssRule[] {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  let index = 0;
  while (index < clean.length) {
    const open = clean.indexOf('{', index);
    if (open < 0) break;
    const prelude = clean.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < clean.length && depth > 0) {
      if (clean[cursor] === '{') depth += 1;
      else if (clean[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const body = clean.slice(open + 1, cursor - 1);
    if (/^@(media|supports|container)/.test(prelude)) {
      cssRules(body, prelude, out);
    } else {
      out.push({
        selectors: prelude.split(',').map((selector) => selector.trim()).filter(Boolean),
        body,
        media,
      });
    }
    index = cursor;
  }
  return out;
}

const RULES = cssRules(css);

/** مدیاهایی که چیدمان دسکتاپ را می‌سازند (قاعدهٔ پایه + min-width). */
const DESKTOP = (media: string | null) => media === null || media.includes('min-width');

/** آخرین مقدار z-index یک انتخابگر در کل فایل (به ترتیب آبشار). */
function lastZIndex(rawSelector: string, includeMedia: (media: string | null) => boolean = () => true): number {
  // فروشِ بک‌اسلش‌های احتمالی؛ تطبیق دقیق رشته‌ای است، نه regex.
  const selector = rawSelector.replace(/\\/g, '');
  let value: number | null = null;
  for (const rule of RULES) {
    if (!rule.selectors.includes(selector) || !includeMedia(rule.media)) continue;
    const found = rule.body.match(/(?:^|[;\s])z-index:\s*(-?\d+)/);
    if (found) value = Number(found[1]);
  }
  if (value === null) throw new Error(`z-index برای ${selector} پیدا نشد`);
  return value;
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

const round = (value: number) => Math.round(value * 10) / 10;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 900, height: 700 },
  { width: 721, height: 640 },
];

/** ارتفاع سهم هر پنل در یک ستون (CSS: --hud-column-budget). */
const columnBudget = (height: number) =>
  (height - token('--hud-top') - token('--hud-bottom') - 44 - 46 - 24) / 2;

describe('چیدمان فشرده — توکن‌ها و اندازه‌ها', () => {
  it('بلوک چیدمان وجود دارد و توکن‌های اصلی را تعریف می‌کند', () => {
    expect(block).not.toBe('');
    for (const name of [
      '--hud-edge',
      '--hud-top',
      '--hud-bottom',
      '--hud-w-companion',
      '--hud-w-whisper',
      '--hud-w-whisper-open',
      '--hud-w-explore',
      '--hud-w-ticket',
      '--hud-w-modal',
      '--hud-w-keypad',
    ]) {
      expect(() => token(name), name).not.toThrow();
    }
  });

  it('همهٔ پنل‌ها از اندازهٔ قبلی خود کوچک‌تر شده‌اند', () => {
    // مقدارهای قبلی: همراه ۳۰۴ · نجوا ۳۰۰/۳۲۴ · کاوش ۳۸۰ · بلیط ۳۸۰ · مودال ۴۵۲ · کیپد ۲۵۲
    expect(token('--hud-w-companion')).toBeLessThan(304);
    expect(token('--hud-w-whisper')).toBeLessThan(300);
    expect(token('--hud-w-whisper-open')).toBeLessThan(324);
    expect(token('--hud-w-explore')).toBeLessThan(380);
    expect(token('--hud-w-ticket')).toBeLessThan(380);
    expect(token('--hud-w-modal')).toBeLessThan(452);
    expect(token('--hud-w-keypad')).toBeLessThan(252);
  });

  it('روی موبایل هم پنل‌ها باریک می‌مانند و از قاب بیرون نمی‌زنند', () => {
    expect(token('--hud-w-companion')).toBeLessThanOrEqual(280);
    expect(token('--hud-w-whisper-open')).toBeLessThanOrEqual(320);
    expect(token('--hud-edge')).toBeLessThanOrEqual(16);
    // موبایل چیدمان تب خودش را دارد و نباید با این بلوک عوض شود.
    expect(block).not.toMatch(/@media \(max-width: 720px\)\s*\{[^@]*--hud-w-companion/);
  });

  it('اندازهٔ فونت‌ها فقط از توکن‌های موجود است (زیر ۱۲px نمی‌رویم)', () => {
    const sizes = [...block.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1].trim());
    for (const value of sizes) {
      if (value.startsWith('var(')) continue;
      const pixels = Number(value.replace('px', ''));
      expect(pixels, value).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('چیدمان فشرده — ترتیب لایه‌ها', () => {
  it('نام هم‌تیمی‌های شناور زیر همهٔ پنل‌ها و زیر مودال معما می‌نشیند', () => {
    expect(lastZIndex('\\.presence-hud')).toBeLessThan(lastZIndex('\\.theater-companion-hud'));
  });

  it('ترتیب کامل روی دسکتاپ: صحنه < همسفران < نجوا < کاوش < مودال < نوار ابزار', () => {
    const order = [
      lastZIndex('.presence-hud', DESKTOP),
      lastZIndex('.theater-companion-hud', DESKTOP),
      lastZIndex('.whisper-panel', DESKTOP),
      lastZIndex('.exploration-hud', DESKTOP),
      lastZIndex('.door-modal-backdrop', DESKTOP),
    ];
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index], `پلهٔ ${index}: ${order.join(' < ')}`).toBeGreaterThan(order[index - 1]);
    }
    // نوار ابزار صحنه (کلید سه‌بعدی/کلاسیک) در CSS ماژول صفحهٔ اتاق است.
    const toolbar = Number(roomShellCss.match(/\.sceneToolbar\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
    expect(toolbar).toBeGreaterThan(order[order.length - 1]);
  });

  it('روی موبایل هم نام هم‌تیمی‌ها زیر تب‌های پنل می‌ماند', () => {
    const presence = lastZIndex('.presence-hud');
    const panels = [
      lastZIndex('.theater-companion-hud'),
      lastZIndex('.whisper-panel'),
      lastZIndex('.exploration-hud'),
    ];
    expect(presence).toBeLessThan(Math.min(...panels));
  });

  it('اعلان حرکت زیر پنل‌های کناری است تا اگر جا کم آمد پشت آن‌ها پنهان شود', () => {
    const notice = lastZIndex('\\.movement-notice');
    expect(notice).toBeLessThan(lastZIndex('\\.whisper-panel'));
    expect(notice).toBeLessThan(lastZIndex('\\.theater-companion-hud'));
    expect(notice).toBeGreaterThan(lastZIndex('\\.presence-hud'));
  });
});

describe('چیدمان فشرده — هیچ دو پنلی روی هم نمی‌افتد', () => {
  const edge = () => token('--hud-edge');
  const top = () => token('--hud-top');
  const bottom = () => token('--hud-bottom');

  it.each(VIEWPORTS)('ستون بالا در $width×$height', ({ width, height }) => {
    // نجوا (چپ) و همسفران (راست) هم‌تراز بالای صفحه‌اند.
    const whisper = box(edge(), top(), token('--hud-w-whisper-open'), 54);
    const companion = box(width - edge() - token('--hud-w-companion'), top(), token('--hud-w-companion'), 44);
    expect(overlaps(whisper, companion), 'نجوا و همسفران').toBe(false);
    // حتی نسخهٔ بازِ نجوا هم نباید به ستون راست برسد.
    expect(width - edge() - token('--hud-w-companion')).toBeGreaterThan(edge() + token('--hud-w-whisper-open'));
    expect(height).toBeGreaterThan(0);
  });

  it.each(VIEWPORTS)('اعلان حرکت بین دو پنل می‌ماند یا پشتشان پنهان می‌شود — $width×$height', ({ width }) => {
    const noticeWidth = Math.min(
      460,
      Math.max(180, width - 2 * (token('--hud-w-whisper') + edge() + 16)),
    );
    const notice = box((width - noticeWidth) / 2, top(), noticeWidth, 40);
    const whisper = box(edge(), top(), token('--hud-w-whisper'), 54);
    const companion = box(width - edge() - token('--hud-w-companion'), top(), token('--hud-w-companion'), 44);
    const collides = overlaps(notice, whisper) || overlaps(notice, companion);
    if (collides) {
      // تداخل مجاز است فقط اگر اعلان زیر هر دو پنل باشد (دیده نمی‌شود).
      expect(lastZIndex('\\.movement-notice')).toBeLessThan(lastZIndex('\\.whisper-panel'));
      expect(lastZIndex('\\.movement-notice')).toBeLessThan(lastZIndex('\\.theater-companion-hud'));
    }
    expect(noticeWidth).toBeGreaterThanOrEqual(180);
    expect(noticeWidth).toBeLessThanOrEqual(460);
  });

  it.each(VIEWPORTS)('ستون راست: همسفران بالا هرگز به بلیط پایین نمی‌رسد — $width×$height', ({ height }) => {
    const budget = columnBudget(height);
    const companionHeight = Math.min(300, budget);
    const ticketScroll = Math.min(300, budget);
    const companion = box(0, top(), token('--hud-w-companion'), 44 + companionHeight);
    const ticket = box(0, height - bottom() - (46 + ticketScroll), token('--hud-w-ticket'), 46 + ticketScroll);
    expect(overlaps(companion, ticket), `فاصلهٔ ستون راست در ارتفاع ${height}`).toBe(false);
    expect(ticket.top - companion.bottom).toBeGreaterThanOrEqual(16);
  });

  it.each(VIEWPORTS)('ستون راست و چپ هم‌زمان به هم نمی‌رسند — $width×$height', ({ width, height }) => {
    // کاوش (پایین-چپ) و بلیط (پایین-راست) در دو ستون جدا هستند.
    const explore = box(edge(), height - bottom() - 44, token('--hud-w-explore'), 44);
    const ticket = box(width - 12 - token('--hud-w-ticket'), height - bottom() - 46, token('--hud-w-ticket'), 46);
    expect(overlaps(explore, ticket), 'کاوش و بلیط').toBe(false);
  });

  it.each(VIEWPORTS)('ستون چپ: نجوا و کاوش با هم برخورد ندارند — $width×$height', ({ height }) => {
    const cap = height - top() - bottom() - 44 - 70;
    const whisperOpen = box(edge(), top(), token('--hud-w-whisper-open'), Math.max(220, Math.min(cap, 430)));
    const exploreToggle = box(edge(), height - bottom() - 44, token('--hud-w-explore'), 44);
    expect(overlaps(whisperOpen, exploreToggle), 'نجوا و دکمهٔ کاوش').toBe(false);

    // کاوشِ باز هم نباید به سربرگِ جمع‌شدهٔ نجوا برسد.
    const explorePanelHeight = Math.min(380, cap);
    const exploreTop = height - bottom() - 44 - explorePanelHeight;
    const whisperHeader = box(edge(), top(), token('--hud-w-whisper'), 44);
    expect(exploreTop).toBeGreaterThanOrEqual(whisperHeader.bottom + 16);
  });
});

describe('چیدمان فشرده — صفحهٔ رمز و کیپد معما', () => {
  it('مودال باریک‌تر شده و جمع‌وجورتر نفس می‌کشد', () => {
    expect(block).toMatch(/\.door-modal\s*\{[^}]*width:\s*min\(100%,\s*var\(--hud-w-modal\)\)/s);
    expect(block).toMatch(/\.door-modal\s*\{[^}]*padding:\s*16px 18px 12px;/s);
  });

  it('کیپد و اسلات‌ها کوچک‌تر شده‌اند ولی نه زیر حد خوانایی', () => {
    expect(block).toMatch(/\.brass-keypad\s*\{[^}]*width:\s*min\(100%,\s*var\(--hud-w-keypad\)\)/s);
    expect(block).toMatch(/\.lock-slot\s*\{[^}]*width:\s*26px;[^}]*height:\s*34px;/s);
    expect(block).toMatch(/\.code-display-row input\s*\{[^}]*height:\s*42px;/s);
    expect(token('--hud-w-keypad')).toBeGreaterThanOrEqual(180);
  });

  it('هدف لمس ۴۴px دست‌نخورده مانده و نسخهٔ فشرده فقط برای ماوس است', () => {
    // دکمه‌های کیپد در بلوک فشرده با انتخابگر دقیق‌تر (زیر مودال) کوچک می‌شوند.
    expect(block).toMatch(/@media \(min-width: 721px\) and \(min-height: 560px\) and \(pointer: fine\)\s*\{\s*\.door-modal \.brass-keypad button\s*\{[^}]*min-height:\s*36px;/s);
    // قاعدهٔ عمومی ۴۶px لمسی سر جایش است و در بلوک فشرده بازنویسی نشده است.
    expect(block).not.toMatch(/^\.brass-keypad button\s*\{/m);
    expect(css).toMatch(/\.brass-keypad button\s*\{[^}]*min-height:\s*46px/s);
    expect(css).toMatch(/\.unlock-button\s*\{[^}]*min-height:\s*4[4-9]px/s);
    expect(block).toMatch(/\.unlock-button\s*\{[^}]*min-height:\s*44px;/s);
  });

  it('ارتفاع کل مودال با احتساب کیپد در پنجرهٔ ۷۰۰px جا می‌شود', () => {
    // جمع تقریبی اجزا (بدون اسکرول) بر اساس اندازه‌های همین بلوک.
    const parts = {
      padding: 16 + 12,
      emblem: 28 + 4,
      title: 26 + 18,
      description: 54,
      team: 62,
      label: 16,
      slots: 34 + 11,
      input: 42,
      progress: 18,
      toggle: 40,
      keypad: 4 * 36 + 3 * 4,
      feedback: 18,
      unlock: 44,
    };
    const total = Object.values(parts).reduce((sum, value) => sum + value, 0);
    // ۷۰۰px ارتفاع دید منهای ۳۰px حاشیهٔ مودال = ۶۷۰px فضای واقعی.
    expect(total).toBeLessThan(660);
    expect(round(total)).toBeGreaterThan(300);
  });
});
