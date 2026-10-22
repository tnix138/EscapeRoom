import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  TICKET_DRAWER_BODY_ID,
  ticketDrawerStatusLine,
  ticketDrawerToggleHint,
  ticketDrawerToggleLabel,
} from '../../src/components/alley/puzzle-rules';

/**
 * بازبینی امیرعلی — پنل بلیط شیشه‌ای، بزرگ‌تر، جمع‌شدنی و اسکرول هم‌تم
 * ---------------------------------------------------------------------------
 * چهار خواستهٔ امیرعلی:
 *  ۱) عنوان «بلیط امیرعلی — ردیف ۱ — صندلی ۲» و خود پنل بلیط بزرگ‌تر و واضح‌تر شوند.
 *  ۲) مثل بقیهٔ پنل‌ها دکمهٔ باز و بستن از سمت راست داشته باشد تا با یک کلیک باز
 *     شود و با کلیک بعدی بسته شود.
 *  ۳) تمام رنگ‌های کرمی/کاغذی داخل بلیط و کوپن حذف شوند و همه‌چیز یک‌دست شیشه‌ای
 *     تیره و خوش‌فرم مثل سایر پنل‌ها شود.
 *  ۴) نوارهای اسکرول پایین و چپ و کنترل‌های پایین/چپ هم‌تم با بقیهٔ پنل‌ها شوند.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const css = read('../../src/app/globals.css');
const integration = read('../../src/components/alley/AlleyRoomThreeIntegration.tsx');

const MARKER = 'بازبینی امیرعلی — پنل بلیط شیشه‌ای، بزرگ‌تر، جمع‌شدنی و اسکرول هم‌تم';
const markerAt = css.indexOf(MARKER);
const block = markerAt >= 0 ? css.slice(markerAt) : '';

const PERSIAN = /[\u0600-\u06FF]/;

function tokenFromCss(source: string, name: string): number {
  const matches = [...source.matchAll(new RegExp(`${name}:\\s*(-?[\\d.]+)px\\s*;`, 'g'))];
  const last = matches.at(-1);
  if (!last) throw new Error(`توکن ${name} پیدا نشد`);
  return Number(last[1]);
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

describe('منطق خالص سربرگ و کلید باز/بستهٔ پنل بلیط', () => {
  it('برچسب و راهنمای باز و بسته فارسی، گویا و متمایز است', () => {
    expect(TICKET_DRAWER_BODY_ID).toBe('alley3d-ticket-body');
    expect(ticketDrawerToggleLabel(true)).not.toBe(ticketDrawerToggleLabel(false));
    expect(ticketDrawerToggleLabel(true)).toContain('بستن');
    expect(ticketDrawerToggleLabel(false)).toContain('باز');

    for (const open of [true, false]) {
      expect(ticketDrawerToggleLabel(open)).toMatch(PERSIAN);
      expect(ticketDrawerToggleHint(open)).toMatch(PERSIAN);
      expect(ticketDrawerToggleHint(open)).not.toBe(ticketDrawerToggleLabel(open));
    }
  });

  it('خط وضعیت بر اساس پانچ شدن و همگام‌سازی رقم طلایی به‌روز می‌شود', () => {
    expect(ticketDrawerStatusLine(false, null)).toBe('مدارک ورود و پاسخ معما');
    expect(ticketDrawerStatusLine(true, null)).toContain('پانچ شد');
    expect(ticketDrawerStatusLine(true, 6)).toBe('بلیط پانچ شد · رقم طلایی: ۶');
    expect(ticketDrawerStatusLine(true, 0)).toBe('بلیط پانچ شد · رقم طلایی: ۰');
  });
});

describe('ساختار دکمهٔ باز و بستن پنل بلیط در صحنهٔ سه‌بعدی', () => {
  it('یک دکمهٔ واقعی در سمت راست با کلید و عنوان بزرگ «بلیط ... — ردیف ... — صندلی ...» دارد', () => {
    expect(integration).toContain('const [desktopTicketOpen, setDesktopTicketOpen] = useState(true);');
    expect(integration).toContain('className="alley3d-ticket-toggle"');
    expect(integration).toContain('type="button"');
    expect(integration).toContain('aria-expanded={desktopTicketOpen}');
    expect(integration).toContain('aria-controls={TICKET_DRAWER_BODY_ID}');
    expect(integration).toContain('onClick={() => setDesktopTicketOpen((value) => !value)}');
    expect(integration).toContain('className="alley3d-ticket-key"');
    expect(integration).toContain('className="alley3d-ticket-owner-line"');
    expect(integration).toContain('بلیط {room.me.playerName} — {room.me.seatLabel}');
  });

  it('بدنهٔ بلیط با بسته شدن واقعاً پنهان می‌شود و برگهٔ تمام‌صفحهٔ گوشی آسیب نمی‌بیند', () => {
    expect(integration).toContain('id={TICKET_DRAWER_BODY_ID}');
    expect(integration).toContain('hidden={!desktopTicketOpen}');
    expect(block).toMatch(/\.alley3d-ticket-body\[hidden\]\s*\{\s*display:\s*none;/);
    // روی گوشی دکمهٔ دسکتاپ مخفی است و بدنهٔ داخل برگهٔ باز همیشه دیده می‌شود.
    expect(block).toMatch(
      /@media \(max-width: 720px\), \(max-height: 560px\)[\s\S]*?\.alley3d-ticket-toggle\s*\{\s*display:\s*none;/,
    );
    expect(block).toMatch(
      /\.alley3d-panels\.is-open \.alley3d-ticket-body\[hidden\]\s*\{\s*display:\s*block;/,
    );
  });

  it('اندازهٔ عنوان بلیط و صندلی بزرگ‌تر و کاملاً خوانا شده است', () => {
    expect(block).toMatch(/\.alley3d-ticket-toggle\s*\{[^}]*min-height:\s*58px;/s);
    expect(block).toMatch(
      /\.alley3d-ticket-owner-line\s*\{[^}]*font-size:\s*17px;[^}]*font-weight:\s*600;/s,
    );
    expect(block).toMatch(/\.ticket-seat-tag\s*\{[^}]*font-size:\s*var\(--text-sm\);/s);
    expect(tokenFromCss(block, '--hud-w-ticket-open')).toBeGreaterThan(360);
  });
});

describe('یک‌دست‌سازی شیشه‌ای و حذف کامل رنگ کرمی', () => {
  it('بخش بازبینی شیشه‌ای در انتهای استایل وجود دارد و هیچ رنگ کرمی ندارد', () => {
    expect(block.length).toBeGreaterThan(2500);
    for (const creamHex of ['#e8d8b6', '#c9b28a', '#e2d3b4', '#e4d2ad', '#bca27a']) {
      expect(block.toLowerCase()).not.toContain(creamHex);
    }
  });

  it('بلیط اصلی، پشت و روی کوپن و پوستهٔ پنل بلیط همه شیشه‌ای تیره با blur و خط طلایی هستند', () => {
    for (const selector of [
      '\\.main-ticket',
      '\\.coupon-face',
      '\\.alley3d-ticket-inner',
      '\\.exploration-toggle',
      '\\.exploration-panel',
      '\\.alley3d-hint',
      '\\.alley3d-small-button',
    ]) {
      const rule = block.match(new RegExp(`${selector}\\s*\\{[^}]*\\}`, 's'))?.[0] ?? '';
      expect(rule, selector).not.toBe('');
      expect(rule, `${selector} blur`).toContain('backdrop-filter: blur(');
      expect(rule, `${selector} gold border`).toContain('212, 175, 99');
    }

    const couponBack = block.match(/\.coupon-back\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(couponBack).toContain('linear-gradient');
    expect(couponBack).toContain('color: var(--text-primary)');
  });

  it('اسکرول‌بارهای پایین و چپ با استایل شیشه‌ای طلایی و بدون فلش‌های سفید ویندوز تم شده‌اند', () => {
    expect(block).toMatch(/\.held-tickets-scroll,[\s\S]*?overflow-x:\s*hidden;/);
    expect(block).toContain('@supports selector(::-webkit-scrollbar)');
    expect(block).toMatch(/::-webkit-scrollbar-button\s*\{\s*display:\s*none;/);
    expect(block).toMatch(/::-webkit-scrollbar-track\s*\{[^}]*rgba\(16, 10, 14, 0\.62\)/s);
    expect(block).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*rgba\(212, 175, 99/s);
  });

  it('هیچ اندازهٔ متنی زیر ۱۲ پیکسل در بلوک جدید تعریف نشده است', () => {
    for (const match of block.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = match[1].trim();
      if (!value.startsWith('var(')) {
        expect(Number(value.replace('px', '')), value).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

describe('تضمین هندسی عدم برخورد پنل بزرگ‌ترِ بلیط در همهٔ ابعاد دسکتاپ', () => {
  const edge = tokenFromCss(css, '--hud-edge');
  const top = tokenFromCss(css, '--hud-top');
  const companionTop = tokenFromCss(css, '--hud-companion-top');
  const bottom = tokenFromCss(css, '--hud-bottom');
  const companionW = tokenFromCss(css, '--hud-w-companion');
  const exploreW = tokenFromCss(css, '--hud-w-explore');
  const ticketOpenW = tokenFromCss(block, '--hud-w-ticket-open');
  const ticketClosedW = tokenFromCss(block, '--hud-w-ticket-closed');

  const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 900, height: 700 },
    { width: 721, height: 640 },
  ];

  it.each(VIEWPORTS)(
    'در $width×$height بلیط (باز یا بسته) نه با همسفران بالا برخورد دارد نه با سرنخ‌های چپ',
    ({ width, height }) => {
      const colBudget = (height - top - bottom - 44 - 46 - 24) / 2;
      const companionOpenH = 44 + Math.min(300, colBudget);
      const companionRect = box(width - edge - companionW, companionTop, companionW, companionOpenH);

      const ticketEffectiveOpenW = Math.min(ticketOpenW, width - exploreW - edge * 2 - 20);
      const ticketEffectiveClosedW = Math.min(ticketClosedW, width - exploreW - edge * 2 - 20);
      const scrollMax = Math.min(
        390,
        height - companionTop - bottom - 44 - 58 - Math.min(300, colBudget) - 20,
      );
      const ticketOpenH = 58 + Math.max(0, scrollMax);
      const ticketOpenRect = box(
        width - edge - ticketEffectiveOpenW,
        height - bottom - ticketOpenH,
        ticketEffectiveOpenW,
        ticketOpenH,
      );
      const ticketClosedRect = box(
        width - edge - ticketEffectiveClosedW,
        height - bottom - 58,
        ticketEffectiveClosedW,
        58,
      );
      const exploreRect = box(edge, height - bottom - 44, exploreW, 44);

      expect(overlaps(companionRect, ticketOpenRect), 'همسفران باز و بلیط باز').toBe(false);
      expect(ticketOpenRect.top - companionRect.bottom).toBeGreaterThanOrEqual(20);
      expect(overlaps(exploreRect, ticketOpenRect), 'کاوش چپ و بلیط باز راست').toBe(false);
      expect(overlaps(exploreRect, ticketClosedRect), 'کاوش چپ و بلیط بسته راست').toBe(false);
    },
  );
});
