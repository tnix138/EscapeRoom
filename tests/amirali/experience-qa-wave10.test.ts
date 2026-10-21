import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * موج ۱۰ — QA تجربه (امیرعلی)
 * ---------------------------------------------------------------------------
 * این فایل «قرارداد کیفیت» سطح بازیکن را نگه می‌دارد، نه رفتار یک ماژول:
 * RTL، ۳۲۰px و زوم ۲۰۰٪، هدف لمسی ۴۴px، کنتراست، مسیر صفحه‌کلید، وضعیت خطا
 * و ترتیب فلو reserve → invite → alley → puzzle → cutscene → exploration.
 * همهٔ بررسی‌ها روی منبع انجام می‌شود تا در محیط بدون مرورگر هم سبز باشد.
 */

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const css = read('../../src/app/globals.css');

interface CssRule {
  selectors: string[];
  body: string;
  media: string | null;
}

/** تجزیهٔ سادهٔ CSS به قواعد، با نگه‌داشتن متن `@media` هر قاعده. */
function parseRules(source: string): CssRule[] {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];

  const walk = (text: string, media: string | null) => {
    let index = 0;
    while (index < text.length) {
      const open = text.indexOf('{', index);
      if (open < 0) break;
      const head = text.slice(index, open).trim();
      let depth = 1;
      let cursor = open + 1;
      while (cursor < text.length && depth > 0) {
        if (text[cursor] === '{') depth += 1;
        else if (text[cursor] === '}') depth -= 1;
        cursor += 1;
      }
      const body = text.slice(open + 1, cursor - 1);
      if (/^@(media|supports)/.test(head)) walk(body, head);
      else if (!head.startsWith('@')) {
        rules.push({
          selectors: head.split(',').map((selector) => selector.replace(/\s+/g, ' ').trim()),
          body,
          media,
        });
      }
      index = cursor;
    }
  };

  walk(clean, null);
  return rules;
}

const RULES = parseRules(css);

function declaration(rule: CssRule, property: string): string | null {
  const match = rule.body.match(new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

/** آخرین مقدار یک ویژگی برای یک انتخابگر دقیق (به ترتیب فایل = ترتیب آبشار). */
function lastValue(selector: string, property: string): string | null {
  let value: string | null = null;
  for (const rule of RULES) {
    if (!rule.selectors.includes(selector)) continue;
    const found = declaration(rule, property);
    if (found) value = found;
  }
  return value;
}

function hasValue(selector: string, property: string, pattern: RegExp): boolean {
  return RULES.some(
    (rule) => rule.selectors.includes(selector) && pattern.test(declaration(rule, property) ?? ''),
  );
}

/** px را عدد می‌کند؛ توکن کنترل ۴۴px است. */
function toPx(value: string | null): number | null {
  if (!value) return null;
  if (value.includes('var(--control-height)')) return 44;
  const match = value.match(/^(\d+(?:\.\d+)?)px$/);
  return match ? Number(match[1]) : null;
}

/** بزرگ‌ترین هدف عمودی مؤثر یک کنترل (height یا min-height). */
function targetHeight(selector: string): number {
  return Math.max(toPx(lastValue(selector, 'height')) ?? 0, toPx(lastValue(selector, 'min-height')) ?? 0);
}

function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const layout = read('../../src/app/layout.tsx');

describe('wave 10 — RTL و پوستهٔ صفحه', () => {
  it('زبان و جهت صفحه فارسی و راست‌به‌چپ است', () => {
    expect(layout).toContain('<html lang="fa" dir="rtl">');
  });

  it('پرش به محتوا و نقطهٔ فوکوس اصلی وجود دارد', () => {
    expect(layout).toContain('className="skip-link"');
    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('id="main-content"');
  });

  it('حلقهٔ فوکوس سراسری برای همهٔ کنترل‌ها تعریف شده است', () => {
    expect(css).toMatch(/:where\(a, button, input, select, textarea, \[tabindex\]\):focus-visible/);
    expect(css).toContain('--focus-ring');
  });
});

describe('wave 10 — ۳۲۰px و زوم ۲۰۰٪', () => {
  it('هیچ پنل ثابتی از عرض صفحه بیرون نمی‌زند', () => {
    // هر HUD ثابت یا عرضش با min() مهار شده یا max-width با ۱۰۰vw دارد.
    const bounded: Array<[string, string]> = [
      ['.whisper-panel', 'max-width'],
      ['.whisper-expanded', 'max-width'],
      ['.theater-companion-hud', 'max-width'],
      ['.movement-notice', 'max-width'],
      ['.exploration-hud', 'width'],
      ['.controls-help', 'width'],
    ];
    for (const [selector, property] of bounded) {
      expect(
        hasValue(selector, property, /100vw/),
        `${selector} باید عرضش را با ۱۰۰vw مهار کند`,
      ).toBe(true);
    }
  });

  it('فهرست پیام‌های نجوا با ارتفاع صفحه نفس می‌کشد', () => {
    expect(css).toMatch(/\.whisper-messages\s*\{[^}]*max-height:\s*min\(248px,\s*34svh\)/);
  });

  it('نمای کوچه در پنجرهٔ کوتاه با svh جا می‌شود', () => {
    expect(css).toMatch(/@media \(max-width: 720px\) \{\s*\.alley-panorama,[\s\S]*?height:\s*min\(540px,\s*76svh\)/);
  });

  it('چیدمان‌های چندستونه در باریکی تک‌ستونه می‌شوند', () => {
    const gridUnder = (selector: string, maxWidth: number) =>
      RULES.filter(
        (rule) =>
          rule.selectors.includes(selector) &&
          rule.media !== null &&
          rule.media.includes(`max-width: ${maxWidth}px`),
      ).map((rule) => declaration(rule, 'grid-template-columns'));

    expect(gridUnder('.reservation-layout', 620)).toContain('1fr');
    expect(gridUnder('.ticket-pair', 680)).toContain('1fr');
    expect(gridUnder('.invitation-controls', 380)).toContain('0.8fr 1.2fr');
  });

  it('هیچ min-width بزرگ‌تر از ۲۸۸px روی عناصر صفحه نیست', () => {
    const offenders: string[] = [];
    for (const rule of RULES) {
      const value = declaration(rule, 'min-width');
      const size = toPx(value);
      if (size !== null && size > 288) offenders.push(`${rule.selectors.join(', ')} → ${value}`);
    }
    expect(offenders).toEqual([]);
  });

  it('پنل کاوش روی موبایل بالاتر از نوار کنترل‌ها می‌نشیند', () => {
    expect(css).toMatch(/@media \(max-width: 720px\) \{\s*\.exploration-hud\s*\{[^}]*bottom:\s*104px/);
  });
});

describe('wave 10 — هدف لمسی ۴۴px', () => {
  it('همهٔ کنترل‌های اصلی مسیر بازیکن ≥۴۴px هستند', () => {
    const controls = [
      '.whisper-toggle',
      '.whisper-form button',
      '.ticket-punch-button',
      '.brass-keypad button',
      '.unlock-button',
      '.door-modal-close',
      '.alley-head-button',
      '.camera-controls button',
      '.companion-toggle',
      '.controls-help-trigger',
      '.clue-sheet-close',
      '.clue-inspect-button',
      '.exploration-toggle',
      '.exploration-chat-button',
      '.exploration-hide',
      '.exploration-restore',
      '.narration-button',
      '.icon-button',
      '.story-cue-dismiss',
      '.sound-toggle',
    ];
    const tooSmall = controls
      .map((selector) => ({ selector, height: targetHeight(selector) }))
      .filter(({ height }) => height < 44);
    expect(tooSmall).toEqual([]);
  });
});

describe('wave 10 — کنتراست متن', () => {
  const ratios: Array<[string, string, string]> = [
    ['متن اصلی روی پس‌زمینه', '#f3ead8', '#120d10'],
    ['متن ثانویه روی پس‌زمینه', '#c9b9a9', '#120d10'],
    ['متن کم‌رنگ روی پس‌زمینه', '#a99a91', '#120d10'],
    ['متن ظریف روی پس‌زمینه', '#93847a', '#120d10'],
    ['طلایی روی پنل', '#d4af63', '#1b1417'],
    ['متن HUD کاوش روی پنل', '#9c8d7c', '#100b0e'],
    ['وضعیت مسیر روی پنل', '#8f8272', '#100b0e'],
    ['متن کوچک نجوا روی پنل', '#927f71', '#171017'],
  ];

  it('همهٔ جفت‌های متن/زمینه حداقل ۴٫۵:۱ هستند', () => {
    for (const [name, foreground, background] of ratios) {
      const ratio = contrastRatio(foreground, background);
      expect(ratio, `${name}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('wave 10 — صفحه‌کلید و وضعیت خطا', () => {
  it('هر لایهٔ روی صحنه با Escape بسته می‌شود', () => {
    for (const file of [
      '../../src/components/alley/ClueReadingPanel.tsx',
      '../../src/components/alley/ControlsHelpOverlay.tsx',
      '../../src/components/alley/TheaterDoorLockModal.tsx',
      '../../src/components/hud/WhisperChatPanel.tsx',
      '../../src/components/hud/ExplorationHud.tsx',
    ]) {
      expect(read(file), file).toContain("'Escape'");
    }
  });

  it('پنل نجوا با Esc بسته می‌شود و فوکوس را به سربرگ برمی‌گرداند', () => {
    const whisper = read('../../src/components/hud/WhisperChatPanel.tsx');
    expect(whisper).toContain("if (event.key !== 'Escape') return;");
    expect(whisper).toContain('toggleRef.current?.focus({ preventScroll: true })');
    expect(whisper).toContain('ref={toggleRef}');
  });

  it('مودال قفل در، فوکوس را برمی‌گرداند و پیام وضعیت دارد', () => {
    const modal = read('../../src/components/alley/TheaterDoorLockModal.tsx');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-live="polite"');
    expect(modal).toContain('previouslyFocused?.focus?.({ preventScroll: true })');
  });

  it('فرم رزرو خطاها را با role=alert و aria-invalid اعلام می‌کند', () => {
    const form = read('../../src/components/reservation/ReservationForm.tsx');
    expect(form).toContain('<form');
    expect(form).toContain('onSubmit={submit}');
    expect(form).toContain('role="alert"');
    expect(form).toContain('aria-invalid={fieldError ? true : undefined}');
    expect(form).toContain('aria-describedby={fieldError ? errorId : undefined}');
  });

  it('گیت دعوت‌نامه خطا و تلاش دوباره دارد', () => {
    const gate = read('../../src/components/invitation/InvitationGate.tsx');
    expect(gate).toContain('role="alert"');
    expect(gate).toContain('aria-busy="true"');
  });

  it('هیچ کامپوننت امیرعلی HTML خام تزریق نمی‌کند', () => {
    for (const file of [
      '../../src/components/hud/ExplorationHud.tsx',
      '../../src/components/hud/WhisperChatPanel.tsx',
      '../../src/components/alley/ClueReadingPanel.tsx',
      '../../src/components/reservation/ReservationForm.tsx',
      '../../src/components/invitation/InvitationGate.tsx',
    ]) {
      expect(read(file), file).not.toContain('dangerouslySetInnerHTML');
    }
  });
});

describe('wave 10 — ترتیب فلو بازیکن', () => {
  it('مسیر رزرو ← دعوت ← اتاق با کامپوننت‌های واقعی وصل است', () => {
    expect(read('../../src/app/page.tsx')).toContain("import ReservationForm from '@/components/reservation/ReservationForm'");
    expect(read('../../src/app/invite/[code]/[seatToken]/page.tsx')).toContain("import InvitationGate from '@/components/invitation/InvitationGate'");
    const room = read('../../src/app/room/[code]/page.tsx');
    expect(room).toContain("import AlleyFirstPersonScene from '@/components/alley/AlleyFirstPersonScene'");
    expect(room).toContain("import FirstPersonCutsceneStage from '@/components/cinema/FirstPersonCutsceneStage'");
    expect(room).toContain("import DarkAuditoriumScene from '@/components/auditorium/DarkAuditoriumScene'");
  });

  it('هر فاز سرور به صحنهٔ درست خودش می‌رسد', () => {
    const room = read('../../src/app/room/[code]/page.tsx');
    for (const phase of ['alley_puzzle', 'door_cutscene', 'theater_cutscene', 'in_theater']) {
      expect(room, phase).toContain(`'${phase}'`);
    }
    expect(room).toContain('<AlleyRoomThreeIntegration');
    expect(room).toContain('<FirstPersonCutsceneStage');
    expect(room).toContain('<DarkAuditoriumScene');
  });
});
