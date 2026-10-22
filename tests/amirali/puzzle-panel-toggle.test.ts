import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PUZZLE_PANEL_ID,
  puzzleToggleHint,
  puzzleToggleIcon,
  puzzleToggleLabel,
} from '../../src/components/alley/puzzle-rules';

/**
 * بازبینی امیرعلی — همسفران بالاتر، پاسخ معما هم‌تم با سرنخ‌ها و جمع‌شدنی
 * ---------------------------------------------------------------------------
 * سه خواسته:
 *  ۱) «همسفران تماشاخانه» در نمای کلاسیک برود بالاتر و روی بلیط نیفتد.
 *  ۲) «پاسخ معما» (نماد/پرده/ردیف) یک پله بزرگ‌تر شود.
 *  ۳) تم و حالتش شبیه پنل «سرنخ‌های کوچه» شود و یک دکمهٔ باز/بسته کنارش باشد.
 *
 * این فایل هم منطق خالص دکمه را می‌سنجد، هم ساختار کامپوننت و هم قواعد CSS؛
 * اگر کسی بعداً اندازه‌ها یا تم را برگرداند، همین‌جا قرمز می‌شود.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const css = read('../../src/app/globals.css');
const drawer = read('../../src/components/alley/HeldTicketsDrawer.tsx');
const classic = read('../../src/components/alley/AlleyFirstPersonScene.tsx');
const rules = read('../../src/components/alley/puzzle-rules.ts');

const MARKER = 'بازبینی امیرعلی — همسفران بالاتر، پاسخ معما بزرگ‌تر و هم‌تم با سرنخ‌ها';
const markerAt = css.indexOf(MARKER);
const nextSection = markerAt >= 0 ? css.indexOf('\n/* ====', markerAt + 1) : -1;
const block = markerAt >= 0 ? css.slice(markerAt, nextSection > 0 ? nextSection : undefined) : '';

const PERSIAN = /[\u0600-\u06FF]/;

describe('پاسخ معما — منطق دکمهٔ کشویی', () => {
  it('برچسب باز و بسته فارسی، کوتاه و متمایز است', () => {
    expect(puzzleToggleLabel(true)).not.toBe(puzzleToggleLabel(false));
    for (const label of [puzzleToggleLabel(true), puzzleToggleLabel(false)]) {
      expect(label).toMatch(PERSIAN);
      expect(label.length).toBeGreaterThan(4);
      expect(label.length).toBeLessThanOrEqual(24);
    }
    expect(puzzleToggleLabel(true)).toContain('بستن');
    expect(puzzleToggleLabel(false)).toContain('باز');
  });

  it('راهنما وضعیت را توضیح می‌دهد و با برچسب یکی نیست', () => {
    for (const open of [true, false]) {
      const hint = puzzleToggleHint(open);
      expect(hint).toMatch(PERSIAN);
      expect(hint).not.toBe(puzzleToggleLabel(open));
      expect(hint.length).toBeGreaterThan(20);
    }
    expect(puzzleToggleHint(true)).not.toBe(puzzleToggleHint(false));
  });

  it('نشانهٔ دکمه در دو حالت فرق دارد و شناسهٔ پنل ثابت است', () => {
    expect(puzzleToggleIcon(true)).not.toBe(puzzleToggleIcon(false));
    expect(PUZZLE_PANEL_ID).toBe('ticket-puzzle-body');
    expect(rules).toContain('export const PUZZLE_PANEL_ID');
  });
});

describe('پاسخ معما — ساختار کامپوننت', () => {
  it('دکمه از نوع button است تا فرم را ناخواسته نفرستد', () => {
    const at = drawer.indexOf('className="punch-card-toggle"');
    expect(at).toBeGreaterThan(-1);
    expect(drawer.slice(at - 120, at + 40)).toContain('type="button"');
  });

  it('وضعیت باز/بسته را به صفحه‌خوان و به بدنه وصل می‌کند', () => {
    expect(drawer).toContain('aria-expanded={puzzleOpen}');
    expect(drawer).toContain('aria-controls={PUZZLE_PANEL_ID}');
    expect(drawer).toContain('id={PUZZLE_PANEL_ID}');
    expect(drawer).toContain('hidden={!puzzleOpen}');
    expect(drawer).toContain('aria-label={puzzleToggleLabel(puzzleOpen)}');
    expect(drawer).toContain('title={puzzleToggleHint(puzzleOpen)}');
  });

  it('با کلیک، وضعیت برمی‌گردد و پیش‌فرض باز است', () => {
    expect(drawer).toContain('const [puzzleOpen, setPuzzleOpen] = useState(true);');
    expect(drawer).toContain('onClick={() => setPuzzleOpen((value) => !value)}');
  });

  it('بازیکن با کیبورد هم به دکمه می‌رسد (دکمهٔ واقعی، نه div)', () => {
    expect(drawer).toContain('<button');
    expect(drawer).toContain('className="punch-card-toggle"');
    // هیچ‌جای کارت با onClick روی عنصر غیرتعاملی باز/بسته نمی‌شود.
    expect(drawer).not.toMatch(/<div[^>]*onClick=/);
  });

  it('عنوان و کیکر کارت «سرنخ‌های کوچه» و «پاسخ معما» است', () => {
    expect(drawer).toContain('>سرنخ‌های کوچه<');
    expect(drawer).toContain('>پاسخ معما<');
    expect(drawer).toContain('className="punch-card-lede"');
  });

  it('انتخاب نماد/پرده/ردیف دست‌نخورده مانده است', () => {
    for (const token of ['emblem-grid', 'segmented-row', 'punch-summary', 'ticket-punch-button']) {
      expect(drawer, token).toContain(token);
    }
    expect(drawer).toContain('THEATER_EMBLEMS.map');
    expect(drawer).toContain('ACT_NUMBERS.map');
    expect(drawer).toContain('ROW_CODES.map');
  });
});

describe('پاسخ معما — تم و اندازهٔ سرنخ‌های کوچه', () => {
  it('بلوک CSS این بازبینی وجود دارد', () => {
    expect(block).not.toBe('');
    expect(block.length).toBeGreaterThan(1200);
  });

  it('کارت پس‌زمینهٔ مخملی و خط طلایی پنل سرنخ را گرفته است', () => {
    const card = block.match(/\.punch-card\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(card).toContain('radial-gradient');
    expect(card).toContain('linear-gradient(158deg, #241a1d, #150f12 72%)');
    expect(card).toContain('rgba(212, 175, 99, 0.4)');
    // همان تیرگی/هالهٔ پنل سرنخ‌ها، نه رنگ تازه.
    expect(css).toContain('radial-gradient(ellipse at 78% 4%, rgba(143, 33, 50, 0.16), transparent 46%)');
  });

  it('کیکر و عنوان مثل سرنخ‌ها Georgia و توکن‌های متنی است', () => {
    expect(block).toMatch(/\.punch-card-kicker\s*\{[^}]*font-family:\s*Georgia, serif;/s);
    expect(block).toMatch(/\.punch-card-kicker\s*\{[^}]*letter-spacing:\s*0\.14em;/s);
    expect(block).toMatch(/\.punch-card-title\s*\{[^}]*font-weight:\s*500;/s);
  });

  it('کنترل‌ها یک پله بزرگ‌تر شده‌اند (ولی هدف لمسی حفظ شده)', () => {
    expect(block).toMatch(/\.punch-card \.emblem-option\s*\{[^}]*min-height:\s*60px;/s);
    expect(block).toMatch(/\.punch-card \.segment-option\s*\{[^}]*min-height:\s*56px;/s);
    expect(block).toMatch(/\.punch-card \.ticket-punch-button\s*\{[^}]*min-height:\s*46px;/s);
    expect(block).toMatch(/\.punch-card \.emblem-symbol\s*\{[^}]*font-size:\s*22px;/s);
    // مقدارهای قبلی برای مقایسه: کاشی ۵۲، قطعه ۵۰، دکمهٔ پانچ ۴۴.
    expect(60).toBeGreaterThan(52);
    expect(56).toBeGreaterThan(50);
    expect(46).toBeGreaterThanOrEqual(44);
  });

  it('کاشی انتخاب‌شده و هاور روی مخمل قابل تشخیص است', () => {
    expect(block).toMatch(/\.punch-card \.emblem-option\.is-selected\s*\{[^}]*border-color:\s*var\(--gold\)/s);
    expect(block).toMatch(/\.punch-card \.segment-option\.is-selected\s*\{[^}]*border-color:\s*var\(--gold\)/s);
    expect(block).toMatch(/\.punch-card \.emblem-option:hover\s*\{[^}]*rgba\(212, 175, 99, 0\.14\)/s);
  });

  it('متن‌های داخل کارت برای مخمل روشن شده‌اند (کنتراست)', () => {
    expect(block).toMatch(/\.punch-card \.punch-legend\s*\{[^}]*color:\s*var\(--gold-light\)/s);
    expect(block).toMatch(/\.punch-card \.punch-summary\s*\{[^}]*color:\s*var\(--text-primary\)/s);
    expect(block).toMatch(/\.punch-card \.revealed-digit strong\s*\{[^}]*color:\s*var\(--gold-light\)/s);
  });

  it('هیچ فونتی زیر ۱۲px در بلوک نیست', () => {
    for (const match of block.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = match[1].trim();
      if (!value.startsWith('var(')) {
        expect(Number(value.replace('px', '')), value).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

describe('پاسخ معما — دکمهٔ کشویی در CSS', () => {
  it('دکمه ۴۴px لمس دارد و کنار عنوان می‌نشیند', () => {
    const toggle = block.match(/\.punch-card-toggle\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(toggle).toContain('min-height: 44px');
    expect(toggle).toContain('margin-inline-start: auto');
    expect(toggle).toContain('border-radius: 999px');
  });

  it('بدنهٔ بسته واقعاً از چیدمان حذف می‌شود', () => {
    expect(block).toMatch(/\.punch-card-body\[hidden\]\s*\{\s*display:\s*none;/);
  });

  it('باز شدن انیمیشن کوتاه دارد و با کاهش حرکت خاموش می‌شود', () => {
    expect(block).toContain('@keyframes punch-card-reveal');
    expect(block).toMatch(/\.punch-card-body:not\(\[hidden\]\)\s*\{[^}]*animation:\s*punch-card-reveal/s);
    expect(block).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.punch-card-body:not\(\[hidden\]\)\s*\{\s*animation:\s*none;/s);
  });

  it('فوکوس دکمه دیده می‌شود', () => {
    expect(block).toMatch(/\.punch-card-toggle:focus-visible\s*\{[^}]*outline:\s*var\(--focus-ring\)/s);
  });
});

describe('همسفران تماشاخانه — بالاتر و بدون تداخل در نمای کلاسیک', () => {
  it('در نمای کلاسیک داخل نگه‌دارندهٔ خط سربرگ رندر می‌شود', () => {
    expect(classic).toContain('<div className="alley-classic-companion">');
    expect(classic).toMatch(/alley-classic-companion[\s\S]{0,200}<TheaterCompanionHud/);
    // نگه‌دارنده بعد از سربرگ و پیش از صحنه می‌آید.
    const header = classic.indexOf('<header className="alley-topbar">');
    const wrapper = classic.indexOf('alley-classic-companion');
    const panorama = classic.indexOf('className={`alley-panorama');
    expect(header).toBeGreaterThan(-1);
    expect(wrapper).toBeGreaterThan(header);
    expect(panorama).toBeGreaterThan(wrapper);
  });

  it('پنل در نمای کلاسیک دیگر شناور نیست (با اسکرول کنار می‌رود)', () => {
    expect(block).toMatch(/\.alley-classic-companion\s*\{[^}]*position:\s*relative;/s);
    expect(block).toMatch(/\.alley-classic-companion \.theater-companion-hud\s*\{[^}]*position:\s*relative;/s);
    expect(block).toMatch(/\.alley-classic-companion \.theater-companion-hud\s*\{[^}]*top:\s*auto;/s);
  });

  it('بدنهٔ باز با موقعیت absolute باز می‌شود تا صحنه جابه‌جا نشود', () => {
    expect(block).toMatch(
      /\.alley-classic-companion \.theater-companion-hud\.is-open \.companion-body\s*\{[^}]*position:\s*absolute;[^}]*top:\s*100%;/s,
    );
  });

  it('در ستون راست می‌ماند و روی پنل نجوا (چپ) نمی‌افتد', () => {
    // در سند dir="rtl"، flex-start همان سمت راست است (flex-end چپ می‌افتد و روی نجوا می‌نشیند).
    expect(block).toMatch(/\.alley-classic-companion\s*\{[^}]*justify-content:\s*flex-start;/s);
  });

  it('روی گوشی ردیف تازه هیچ فضای خالی نمی‌گیرد', () => {
    expect(css).toMatch(/@media \(max-width: 720px\)\s*\{\s*\.alley-classic-companion\s*\{[^}]*height:\s*0;/s);
  });

  it('چیدمان تبِ گوشی دست‌نخورده می‌ماند', () => {
    // overrideها فقط از ۷۲۱px به بالا اعمال می‌شوند.
    const mobileOverride = block.match(/@media \(min-width: 721px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(mobileOverride).toContain('.alley-classic-companion .theater-companion-hud');
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.theater-companion-hud\s*\{[^}]*width:\s*44px/s);
  });
});

describe('بلیط و مودال قفل — بزرگ‌تر و هم‌تم', () => {
  it('پنل بلیط سه‌بعدی از ۳۳۲ به ۳۶۰px رسیده است', () => {
    expect(block).toMatch(/:root\s*\{[^}]*--hud-w-ticket:\s*360px;/s);
    expect(360).toBeLessThanOrEqual(380);
  });

  it('مودال قفل همان مخمل و خط طلایی سرنخ‌ها را دارد', () => {
    const modal = block.match(/\.door-modal\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(modal).toContain('linear-gradient(158deg, #241a1d, #150f12 72%)');
    expect(modal).toContain('rgba(212, 175, 99, 0.4)');
    expect(block).toMatch(/\.door-modal \.eyebrow\s*\{[^}]*font-family:\s*Georgia, serif;/s);
  });

  it('صفحه‌کلید برنجی و دکمهٔ کشویی آن دست‌نخورده است', () => {
    expect(css).toContain('.keypad-toggle');
    expect(css).toMatch(/\.brass-keypad\[hidden\]\s*\{\s*display:\s*none;/);
    expect(block).not.toMatch(/\.brass-keypad\s*\{/);
  });
});
