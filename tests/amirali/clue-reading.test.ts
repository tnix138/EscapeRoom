import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CLUE_META,
  actLabel,
  clueAnnouncement,
  clueSummary,
  hasClueContent,
  inspectHint,
  readyTicketsText,
  shouldBlockGameKey,
  toPersianNumber,
  type ClueReadingInput,
} from '@/components/alley/clue-reading-data';

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const css = read('../../src/app/globals.css');
const panel = read('../../src/components/alley/ClueReadingPanel.tsx');
const classicScene = read('../../src/components/alley/AlleyFirstPersonScene.tsx');
const threeScene = read('../../src/components/alley/AlleyRoomThreeIntegration.tsx');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

const TOKENS: Record<string, number> = {
  'var(--text-base)': 16,
  'var(--text-sm)': 14,
  'var(--text-xs)': 12,
  'var(--text-lg)': 18,
};

function fontPx(rule: string): number {
  const match = /font-size:\s*([^;]+);/.exec(rule);
  if (!match) return 0;
  const value = match[1].trim();
  const token = /var\(--text-[a-z]+\)/.exec(value);
  if (token) return TOKENS[token[0]] ?? 0;
  const num = /([\d.]+)(rem|px)/.exec(value);
  if (!num) return 0;
  return num[2] === 'rem' ? Number(num[1]) * 16 : Number(num[1]);
}

const DATA: ClueReadingInput = {
  playbill: [
    { actNumber: 1, sceneTitle: 'پردهٔ نقاب', description: 'نقاب‌ها در تاریکی جابه‌جا می‌شوند.' },
    { actNumber: 2, sceneTitle: 'پردهٔ ویولن', description: 'سیم‌ها بی‌صدا کشیده می‌شوند.' },
    { actNumber: 3, sceneTitle: 'پردهٔ رز', description: 'رزی که هرگز پژمرده نمی‌شود.' },
  ],
  rowChart: [
    { rowTitle: 'ردیف سرخ', romanCode: 'I' },
    { rowTitle: 'ردیف طلایی', romanCode: 'IV' },
    { rowTitle: 'ردیف سربی', romanCode: 'VII' },
  ],
  punchedCount: 2,
  playerCount: 5,
};

describe('محتوای کوچه — موج ۴', () => {
  it('اعداد را فارسی می‌کند و برچسب پرده را درست می‌سازد', () => {
    expect(toPersianNumber(0)).toBe('۰');
    expect(toPersianNumber(3)).toBe('۳');
    expect(toPersianNumber(12)).toBe('۱۲');
    expect(toPersianNumber(Number.NaN)).toBe('');
    expect(actLabel(2)).toBe('پردهٔ ۲');
    expect(actLabel(10)).toBe('پردهٔ ۱۰');
  });

  it('برای هر دو سرنخ عنوان و متن راهنمای مستقل دارد', () => {
    expect(CLUE_META.playbill.title).not.toBe(CLUE_META.rowChart.title);
    expect(CLUE_META.playbill.closeLabel).toContain('پوستر');
    expect(CLUE_META.rowChart.closeLabel).toContain('ردیف');
    expect(inspectHint('playbill')).toContain('اعلان');
    expect(inspectHint('rowChart')).toContain('جدول');
  });

  it('خلاصهٔ محتوا و حالت خالی را برای screen reader می‌سازد', () => {
    expect(clueSummary('playbill', DATA)).toContain('۳ پرده');
    expect(clueSummary('rowChart', DATA)).toContain('۳ ردیف');
    expect(hasClueContent('playbill', DATA)).toBe(true);
    expect(hasClueContent('rowChart', DATA)).toBe(true);

    const empty: ClueReadingInput = { playbill: [], rowChart: [], punchedCount: 0, playerCount: 0 };
    expect(hasClueContent('playbill', empty)).toBe(false);
    expect(clueSummary('playbill', empty)).toBe(CLUE_META.playbill.emptyText);
    expect(clueAnnouncement('rowChart', true)).toContain('باز شد');
    expect(clueAnnouncement('rowChart', false)).toContain('بسته شد');
  });

  it('شمارندهٔ بلیط فقط تعداد می‌گوید و کد در یا رقم پنهان را لو نمی‌دهد', () => {
    const text = readyTicketsText(DATA);
    expect(text).toContain('۲');
    expect(text).toContain('۵');
    expect(text).not.toMatch(/[0-9]/);
    expect(text).not.toMatch(/کد|رمز|رقم/);
  });

  it('کلیدهای حرکت را هنگام خواندن می‌بلعد ولی H و Tab و Esc را نه', () => {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', 'ArrowUp', 'ArrowLeft', 'ShiftLeft']) {
      expect(shouldBlockGameKey(code), code).toBe(true);
    }
    for (const code of ['KeyH', 'Tab', 'Escape', 'KeyM']) {
      expect(shouldBlockGameKey(code), code).toBe(false);
    }
  });
});

describe('پنل خواندن سرنخ', () => {
  it('متن سرنخ را در اندازهٔ خواندن نمایش می‌دهد، نه اندازهٔ دکور', () => {
    expect(fontPx(block('.clue-sheet-titles h2'))).toBeGreaterThanOrEqual(24);
    expect(fontPx(block('.clue-act-title'))).toBeGreaterThanOrEqual(20);
    expect(fontPx(block('.clue-act-description'))).toBeGreaterThanOrEqual(16);
    expect(fontPx(block('.clue-row th'))).toBeGreaterThanOrEqual(16);
    expect(fontPx(block('.clue-row td strong'))).toBeGreaterThanOrEqual(20);
    expect(fontPx(block('.clue-rows thead th'))).toBeGreaterThanOrEqual(14);
  });

  it('کنترل بستن و کلیدهای راهنما اندازهٔ لمسی دارند و پنل اسکرول می‌شود', () => {
    expect(block('.clue-sheet-close')).toContain('width: 44px');
    expect(block('.clue-sheet-close')).toContain('height: 44px');
    expect(block('.clue-inspect-button')).toContain('min-height: 44px');
    expect(block('.clue-sheet')).toContain('max-height: 88svh');
    expect(block('.clue-sheet')).toContain('overflow: auto');
  });

  it('در موبایل تمام‌عرض و بالای ناحیهٔ امن باز می‌شود', () => {
    expect(css).toContain('@media (max-width: 680px)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.clue-sheet \{\s*width: 100%;/);
  });

  it('دسترس‌پذیری: دیالوگ مودال، Esc، بازگشت فوکوس و آزادکردن نشانگر ماوس', () => {
    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('aria-modal="true"');
    expect(panel).toContain('aria-labelledby="clue-reading-title"');
    expect(panel).toContain("event.key === 'Escape'");
    expect(panel).toContain('document.exitPointerLock');
    expect(panel).toContain('restoreTo.current');
    expect(panel).toContain('aria-live="polite"');
  });

  it('کلیدهای حرکت را در فاز capture می‌گیرد تا بازیکن ناخواسته راه نرود', () => {
    expect(panel).toContain('shouldBlockGameKey');
    expect(panel).toContain("window.addEventListener('keydown', onKeyDown, true)");
    expect(panel).toContain('event.stopPropagation()');
  });
});

describe('اتصال پنل به هر دو نمای کوچه', () => {
  it('نمای کلاسیک دکمهٔ بررسی پوستر و گیشه با کلید E دارد', () => {
    expect(classicScene).toContain("from './ClueReadingPanel'");
    expect(classicScene).toContain("setOpenClue('playbill')");
    expect(classicScene).toContain("setOpenClue('rowChart')");
    expect(classicScene).toContain('clue-inspect-button');
    expect(classicScene).toContain("event.key.toLowerCase() === 'e'");
    expect(classicScene).toContain('<ClueReadingPanel');
  });

  it('نمای سه‌بعدی به‌جای overlay درون‌خطی ۱۲px از همان پنل استفاده می‌کند', () => {
    expect(threeScene).toContain("from './ClueReadingPanel'");
    expect(threeScene).toContain('kind="playbill"');
    expect(threeScene).toContain('kind="rowChart"');
    expect(threeScene).not.toContain('🎭 تابلوی اعلانات — نمایش امشب');
    expect(threeScene).not.toContain('📋 گیشه — جدول ردیف‌ها');
    expect(threeScene).not.toContain('fontSize: 12, opacity: 0.8');
  });
});
