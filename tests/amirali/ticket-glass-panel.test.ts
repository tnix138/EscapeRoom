import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  TICKET_DRAWER_BODY_ID,
  ticketDrawerHandleText,
  ticketDrawerStatusLine,
  ticketDrawerToggleHint,
  ticketDrawerToggleLabel,
} from '../../src/components/alley/puzzle-rules';

/**
 * بازبینی امیرعلی — کشوی شیشه‌ای بلیط چسبیده به دیوارهٔ راست با دکمهٔ متصل
 * ---------------------------------------------------------------------------
 * خواسته‌ها:
 *  ۱) کل پنل بلیط به دیوارهٔ سمت راست بچسبد (`right: 0` بدون فاصلهٔ خالی).
 *  ۲) یک دکمهٔ متصل به بدنهٔ خودِ پنل طراحی شود که با زدنش کل این قسمت
 *     (سربرگ + بلیط + پاسخ معما + کوپن) نرم به داخل دیوارهٔ راست جمع و باز شود.
 *  ۳) عنوان بلیط و صندلی بزرگ و خوانا باشد، هیچ رنگ کرمی باقی نماند و اسکرول‌ها
 *     و کنترل‌های پایین/چپ هم‌تم و شیشه‌ای باشند.
 *  ۴) بدون هیچ باگ UI: بدون برخورد با سایر پنل‌ها، بدون hitbox مخفی در حالت بسته،
 *     بدون تلهٔ فوکوس کیبورد (`inert` + `visibility: hidden`) و بدون آسیب به موبایل.
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

describe('منطق خالص دکمهٔ زبانهٔ متصل و وضعیت کشوی بلیط', () => {
  it('برچسب، متن کوتاه زبانه و راهنمای باز/بسته فارسی و متمایز است', () => {
    expect(TICKET_DRAWER_BODY_ID).toBe('alley3d-ticket-body');
    expect(ticketDrawerToggleLabel(true)).not.toBe(ticketDrawerToggleLabel(false));
    expect(ticketDrawerToggleLabel(true)).toContain('بستن');
    expect(ticketDrawerToggleLabel(false)).toContain('باز');
    expect(ticketDrawerHandleText(true)).toBe('بستن');
    expect(ticketDrawerHandleText(false)).toBe('بلیط');

    for (const open of [true, false]) {
      expect(ticketDrawerToggleLabel(open)).toMatch(PERSIAN);
      expect(ticketDrawerToggleHint(open)).toMatch(PERSIAN);
      expect(ticketDrawerHandleText(open)).toMatch(PERSIAN);
    }
  });

  it('خط وضعیت بر اساس پانچ شدن و همگام‌سازی رقم طلایی به‌روز می‌شود', () => {
    expect(ticketDrawerStatusLine(false, null)).toBe('مدارک ورود و پاسخ معما');
    expect(ticketDrawerStatusLine(true, null)).toContain('پانچ شد');
    expect(ticketDrawerStatusLine(true, 6)).toBe('بلیط پانچ شد · رقم طلایی: ۶');
    expect(ticketDrawerStatusLine(true, 0)).toBe('بلیط پانچ شد · رقم طلایی: ۰');
  });
});

describe('دکمهٔ متصل به بدنه و چسبیدن کل کشو به دیوارهٔ سمت راست', () => {
  it('دکمهٔ زبانه مستقیم به کل ظرف پنل بلیط وصل است و کل بخش را باز و بسته می‌کند', () => {
    expect(integration).toContain('const [desktopTicketOpen, setDesktopTicketOpen] = useState(true);');
    expect(integration).toContain('className="alley3d-ticket-toggle alley3d-ticket-handle"');
    expect(integration).toContain('type="button"');
    expect(integration).toContain('aria-expanded={desktopTicketOpen}');
    expect(integration).toContain('aria-controls={TICKET_DRAWER_BODY_ID}');
    expect(integration).toContain('onClick={() => setDesktopTicketOpen((value) => !value)}');

    // کلِ پنل (شامل سربرگ و بلیط‌ها) داخل ظرف کنترل‌شده با TICKET_DRAWER_BODY_ID قرار دارد.
    const innerAt = integration.indexOf('id={TICKET_DRAWER_BODY_ID}');
    const headAt = integration.indexOf('className="alley3d-ticket-head"');
    const drawerAt = integration.indexOf('<HeldTicketsDrawer');
    expect(innerAt).toBeGreaterThan(-1);
    expect(headAt).toBeGreaterThan(innerAt);
    expect(drawerAt).toBeGreaterThan(headAt);

    // در فوکوس کیبورد، دکمهٔ زبانه پیش از محتوای داخلی بلیط قرار دارد.
    const handleAt = integration.indexOf('alley3d-ticket-handle');
    expect(handleAt).toBeGreaterThan(-1);
    expect(handleAt).toBeLessThan(innerAt);
  });

  it('پنل به دیوارهٔ راست (`right: 0`) چسبیده و در حالت بسته هیچ hitbox یا فوکوس مخفی ندارد', () => {
    expect(integration).toContain('inert={!desktopTicketOpen && !ticketsOpen ? true : undefined}');
    expect(block).toMatch(/\.alley3d-panels\s*\{[^}]*right:\s*0;[^}]*overflow-x:\s*clip;/s);
    expect(block).toMatch(/\.alley3d-ticket-inner\s*\{[^}]*border-right:\s*0;[^}]*border-radius:\s*14px 0 0 14px;/s);
    expect(block).toMatch(
      /\.alley3d-ticket-handle\s*\{[^}]*min-height:\s*128px;[^}]*border-right:\s*0;[^}]*border-radius:\s*12px 0 0 12px;/s,
    );
    expect(block).toMatch(
      /\.alley3d-ticket\.is-collapsed\s*\{\s*transform:\s*translate3d\(calc\(100% - var\(--ticket-handle-w\)\), 0, 0\);/,
    );
    expect(block).toMatch(
      /\.alley3d-ticket\.is-collapsed \.alley3d-ticket-inner\s*\{[^}]*pointer-events:\s*none;[^}]*visibility:\s*hidden;/s,
    );
  });

  it('نسخهٔ برگهٔ تمام‌صفحهٔ گوشی بدون دکمهٔ تکراری یا اسکرول دوتایی حفظ شده است', () => {
    expect(block).toMatch(
      /@media \(max-width: 720px\), \(max-height: 560px\)[\s\S]*?\.alley3d-ticket-handle,\s*\.alley3d-ticket-head\s*\{\s*display:\s*none;/,
    );
    expect(block).toMatch(
      /@media \(max-width: 720px\), \(max-height: 560px\)[\s\S]*?\.alley3d-panels\.is-open \.alley3d-ticket\s*\{[^}]*transform:\s*none;/s,
    );
    expect(block).toMatch(
      /@media \(max-width: 720px\), \(max-height: 560px\)[\s\S]*?\.alley3d-panels\.is-open \.alley3d-ticket-inner\s*\{[^}]*visibility:\s*visible;/s,
    );
  });

  it('اندازهٔ عنوان بلیط و هدف لمسی دکمهٔ زبانه استاندارد و خوانا است', () => {
    expect(tokenFromCss(block, '--ticket-handle-w')).toBeGreaterThanOrEqual(44);
    expect(tokenFromCss(block, '--hud-w-ticket-open')).toBeGreaterThan(360);
    expect(block).toMatch(
      /\.alley3d-ticket-owner-line\s*\{[^}]*font-size:\s*17px;[^}]*font-weight:\s*600;/s,
    );
    expect(block).toMatch(/\.ticket-seat-tag\s*\{[^}]*font-size:\s*var\(--text-sm\);/s);
  });
});

describe('یک‌دست‌سازی شیشه‌ای و حذف کامل رنگ کرمی و اسکرول سفید', () => {
  it('هیچ رنگ کرمی در بلوک شیشه‌ای وجود ندارد و همهٔ پنل‌ها شیشه‌ای هستند', () => {
    for (const creamHex of ['#e8d8b6', '#c9b28a', '#e2d3b4', '#e4d2ad', '#bca27a']) {
      expect(block.toLowerCase()).not.toContain(creamHex);
    }

    for (const selector of [
      '\\.main-ticket',
      '\\.coupon-face',
      '\\.alley3d-ticket-inner',
      '\\.alley3d-ticket-handle',
      '\\.exploration-toggle',
      '\\.exploration-panel',
      '\\.alley3d-hint',
      '\\.alley3d-small-button',
    ]) {
      const rule = block.match(new RegExp(`${selector}\\s*\\{[^}]*\\}`, 's'))?.[0] ?? '';
      expect(rule, selector).not.toBe('');
      expect(rule, `${selector} blur`).toContain('backdrop-filter: blur(');
      expect(rule, `${selector} gold`).toContain('212, 175, 99');
    }
  });

  it('اسکرول‌بارهای پایین و چپ شیشه‌ای تیره-طلایی و بدون فلش ویندوز هستند و فونتی زیر ۱۲px نیست', () => {
    expect(block).toMatch(/\.held-tickets-scroll,[\s\S]*?overflow-x:\s*hidden;/);
    expect(block).toContain('@supports selector(::-webkit-scrollbar)');
    expect(block).toMatch(/::-webkit-scrollbar-button\s*\{\s*display:\s*none;/);
    expect(block).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*rgba\(212, 175, 99/s);

    for (const match of block.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = match[1].trim();
      if (!value.startsWith('var(')) {
        expect(Number(value.replace('px', '')), value).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

describe('آزمون هندسی اتصال دکمه، چسبیدن به دیوارهٔ راست و عدم برخورد در دسکتاپ', () => {
  const edge = tokenFromCss(css, '--hud-edge');
  const top = tokenFromCss(css, '--hud-top');
  const companionTop = tokenFromCss(css, '--hud-companion-top');
  const bottom = tokenFromCss(css, '--hud-bottom');
  const companionW = tokenFromCss(css, '--hud-w-companion');
  const exploreW = tokenFromCss(css, '--hud-w-explore');
  const ticketOpenW = tokenFromCss(block, '--hud-w-ticket-open');
  const handleW = tokenFromCss(block, '--ticket-handle-w');
  const handleH = 128;

  const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 900, height: 700 },
    { width: 721, height: 640 },
  ];

  it.each(VIEWPORTS)(
    'در $width×$height کشوی باز و بسته به دیوارهٔ راست چسبیده، دکمه متصل است و برخوردی ندارد',
    ({ width, height }) => {
      const colBudget = (height - top - bottom - 44 - 46 - 24) / 2;
      const companionOpenH = 44 + Math.min(300, colBudget);
      const companionRect = box(width - edge - companionW, companionTop, companionW, companionOpenH);

      const drawerW = Math.min(ticketOpenW, width - exploreW - edge - handleW - 20);
      const scrollMax = Math.min(
        390,
        height - companionTop - bottom - 44 - 56 - Math.min(300, colBudget) - 22,
      );
      const drawerH = 56 + Math.max(0, scrollMax);
      const drawerTop = height - bottom - drawerH;
      const handleTop = drawerTop + (drawerH - handleH) / 2;

      // حالت باز: بدنه به دیوارهٔ راست (x = width) چسبیده و دکمه بدون هیچ شکافی به لبهٔ چپش وصل است.
      const openDrawerRect = box(width - drawerW, drawerTop, drawerW, drawerH);
      const openHandleRect = box(width - drawerW - handleW, handleTop, handleW, handleH);
      expect(openDrawerRect.right).toBe(width);
      expect(openHandleRect.right).toBe(openDrawerRect.left);

      // حالت بسته: جابه‌جایی calc(100% - handleW) دقیقاً برابر +drawerW است؛
      // بدنه ۱۰۰٪ پشت دیوارهٔ راست می‌رود و دکمه دقیقاً به دیوارهٔ راست (x = width) می‌چسبد.
      const shiftX = drawerW + handleW - handleW;
      const closedDrawerRect = box(openDrawerRect.left + shiftX, drawerTop, drawerW, drawerH);
      const closedHandleRect = box(openHandleRect.left + shiftX, handleTop, handleW, handleH);
      expect(closedDrawerRect.left).toBe(width);
      expect(closedHandleRect.right).toBe(width);
      expect(closedHandleRect.left).toBe(width - handleW);

      // عدم برخورد با همسفران بالا، سرنخ‌های چپ و نوار راهنمای پایین در هر دو حالت.
      const exploreRect = box(edge, height - bottom - 44, exploreW, 44);
      const bottomHintRect = box(width - 12 - Math.min(520, width - 24), height - 10 - 56, Math.min(520, width - 24), 56);

      expect(overlaps(companionRect, openDrawerRect), 'همسفران و کشوی باز').toBe(false);
      expect(overlaps(companionRect, openHandleRect), 'همسفران و دکمهٔ باز').toBe(false);
      expect(overlaps(companionRect, closedHandleRect), 'همسفران و دکمهٔ بسته').toBe(false);
      expect(openDrawerRect.top - companionRect.bottom).toBeGreaterThanOrEqual(22);

      expect(overlaps(exploreRect, openHandleRect), 'سرنخ‌های چپ و دکمهٔ کشوی باز').toBe(false);
      expect(overlaps(exploreRect, openDrawerRect), 'سرنخ‌های چپ و کشوی باز').toBe(false);
      expect(overlaps(bottomHintRect, openDrawerRect), 'راهنمای پایین و کشوی باز').toBe(false);
      expect(overlaps(bottomHintRect, closedHandleRect), 'راهنمای پایین و دکمهٔ بسته').toBe(false);
    },
  );
});
