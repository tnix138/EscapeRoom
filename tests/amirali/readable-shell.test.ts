import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Rule = { selector: string; media: string; declarations: Record<string, string> };

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

/** خوانندهٔ سبک CSS برای بررسی مقیاس تایپوگرافی بدون وابستگی اضافه. */
function parseCss(css: string, media = ''): Rule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  let index = 0;

  while (index < source.length) {
    const open = source.indexOf('{', index);
    if (open === -1) break;
    const prelude = source.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '{') depth += 1;
      else if (source[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const body = source.slice(open + 1, cursor - 1);

    if (prelude.startsWith('@media') || prelude.startsWith('@supports')) {
      rules.push(...parseCss(body, prelude.replace(/\s+/g, ' ')));
    } else if (!prelude.startsWith('@')) {
      const declarations: Record<string, string> = {};
      for (const part of body.split(';')) {
        const separator = part.indexOf(':');
        if (separator > 0) {
          declarations[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
        }
      }
      rules.push({ selector: prelude.replace(/\s+/g, ' '), media, declarations });
    }
    index = cursor;
  }

  return rules;
}

const tokens = new Map([
  ['var(--text-base)', 16],
  ['var(--text-sm)', 14],
  ['var(--text-xs)', 12],
]);

function fontPx(value: string): number | null {
  for (const [token, size] of tokens) {
    if (value.includes(token)) return size;
  }
  const match = /(\d+(?:\.\d+)?)px/.exec(value);
  return match ? Number(match[1]) : null;
}

const css = read('../../src/app/globals.css');
const rules = parseCss(css);
const layout = read('../../src/app/layout.tsx');

function selectorIncludes(rule: Rule, selector: string): boolean {
  return rule.selector.split(',').map((part) => part.trim()).includes(selector);
}

function declaredBase(selector: string, property: string): string | undefined {
  let value: string | undefined;
  for (const rule of rules) {
    if (rule.media !== '' || !selectorIncludes(rule, selector)) continue;
    if (rule.declarations[property] !== undefined) value = rule.declarations[property];
  }
  return value;
}

function lastRule(selector: string, media?: string): Rule | undefined {
  let found: Rule | undefined;
  for (const rule of rules) {
    if (!selectorIncludes(rule, selector)) continue;
    if (media !== undefined && !rule.media.includes(media)) continue;
    found = rule;
  }
  return found;
}

describe('مقیاس تایپوگرافی پوستهٔ خوانا', () => {
  it('توکن‌های مقیاس ۱۶/۱۴/۱۲ و اندازهٔ کنترل‌ها را تعریف می‌کند', () => {
    expect(css).toContain('--text-base: 1rem');
    expect(css).toContain('--text-sm: 0.875rem');
    expect(css).toContain('--text-xs: 0.75rem');
    expect(css).toContain('--control-height: 44px');
    expect(css).toContain('--focus-ring:');
  });

  it('هیچ اندازهٔ متنی زیر ۱۲ پیکسل در کل شیت باقی نمی‌گذارد', () => {
    const violations = rules
      .flatMap((rule) => Object.entries(rule.declarations).map(([property, value]) => ({ rule, property, value })))
      .filter(({ property, value }) => property === 'font-size' && (fontPx(value) ?? 99) < 12)
      .map(({ rule, value }) => `${rule.media || 'base'} ${rule.selector} → ${value}`);
    expect(violations).toEqual([]);
  });

  it('متن اصلی و کنترل‌های کلیدی را دست‌کم ۱۶ پیکسل نگه می‌دارد', () => {
    for (const selector of [
      '.hero-description',
      '.button',
      '.input-wrap input',
      '.invite-name-row strong',
      '.ticket-punch-button',
      '.punch-select-label select',
      '.unlock-button',
      '.whisper-form input',
      '.coupon-clue strong',
    ]) {
      const size = declaredBase(selector, 'font-size');
      expect(size, selector).toBeTruthy();
      expect(fontPx(size ?? ''), selector).toBeGreaterThanOrEqual(16);
    }
  });

  it('متن ثانویه را دست‌کم ۱۴ پیکسل و جزئیات غیرحیاتی را ۱۲ پیکسل نگه می‌دارد', () => {
    for (const selector of ['.section-aside', '.footer', '.invite-name-row span', '.whisper-message p', '.door-modal-desc']) {
      const size = declaredBase(selector, 'font-size');
      expect(size, selector).toBeTruthy();
      expect(fontPx(size ?? ''), selector).toBeGreaterThanOrEqual(14);
    }
    for (const selector of ['.playbill-entry > span small', '.tickets-footnote']) {
      const size = declaredBase(selector, 'font-size');
      expect(size, selector).toBeTruthy();
      expect(fontPx(size ?? ''), selector).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('دسترس‌پذیری و چیدمان پوسته', () => {
  it('حالت فوکوس دیدنی و اندازهٔ حداقل کنترل‌ها را اعمال می‌کند', () => {
    const focusRule = rules.find((rule) => rule.declarations['outline']?.includes('var(--focus-ring)'));
    expect(focusRule).toBeTruthy();
    expect(declaredBase('.button', 'min-height')).toBe('var(--control-height)');
    expect(declaredBase('.icon-button', 'width')).toBe('var(--control-height)');
  });

  it('در موبایل بلیط‌ها را تک‌ستونی می‌کند تا متن سرریز نکند', () => {
    const mobileTickets = lastRule('.ticket-pair', 'max-width: 680px');
    expect(mobileTickets?.declarations['grid-template-columns']).toBe('1fr');
  });

  it('لینک پرش به محتوا و تنظیمات ویوپورت را در ریشهٔ برنامه دارد', () => {
    expect(layout).toContain('dir="rtl"');
    expect(layout).toContain('lang="fa"');
    expect(layout).toContain('className="skip-link"');
    expect(layout).toContain('id="main-content"');
    expect(layout).toContain('export const viewport: Viewport');
    expect(css).toContain('.skip-link');
  });
});
