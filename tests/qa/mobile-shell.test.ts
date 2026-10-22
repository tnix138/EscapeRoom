/**
 * mobile-shell.test.ts — قرارداد «پوستهٔ گوشی» و نصب (PWA)
 * ---------------------------------------------------------------------------
 * چیزهایی که در بازبینی روی آیفون ۱۶ اصلاح شد و باید قفل بمانند:
 *
 *  ۱) برگهٔ بلیط روی گوشی **دقیقاً** به اندازهٔ صفحه است (نه بزرگ‌تر) و فقط
 *     بدنهٔ خودش اسکرول می‌شود؛
 *  ۲) نجوای گروهی و همراهِ تماشاخانه به تب‌های لبه جمع می‌شوند و «کارت‌ها روی
 *     هم نمی‌افتند»؛ فقط یکی در هر لحظه باز است و با فلش/کشیدن بسته می‌شود؛
 *  ۳) پیش از ورود به بازی، نصب نسخهٔ اپ پیشنهاد می‌شود (manifest + آیکن‌ها +
 *     apple-touch-icon + سرویس‌ورکر).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDismissSwipe, SWIPE_DISMISS_PX } from '@/components/hud/use-swipe-dismiss';
import { PANEL_OPEN_EVENT, announcePanelOpen, onOtherPanelOpen } from '@/components/hud/panel-focus';

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

const css = read('src/app/globals.css');
const alleyIntegration = read('src/components/alley/AlleyRoomThreeIntegration.tsx');
const whisper = read('src/components/hud/WhisperChatPanel.tsx');
const companion = read('src/components/hud/TheaterCompanionHud.tsx');
const exploration = read('src/components/hud/ExplorationHud.tsx');
const layout = read('src/app/layout.tsx');

const MOBILE_MEDIA = '@media (max-width: 720px), (max-height: 560px)';

/** متن کامل یک بلوک `@media` (با شمارش آکولاد تا انتهای همان بلوک) */
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

const mobileCss = mediaBlock(MOBILE_MEDIA);

/** بدنهٔ قاعدهٔ یک سلکتور داخل بلوک موبایل */
function ruleIn(_media: string, selector: string): string {
  const start = mobileCss.indexOf(`\n  ${selector} {`);
  expect(start, `قاعدهٔ ${selector} در بلوک موبایل پیدا نشد`).toBeGreaterThan(-1);
  const open = mobileCss.indexOf('{', start);
  const close = mobileCss.indexOf('}', open);
  return mobileCss.slice(open + 1, close);
}

describe('برگهٔ بلیط — دقیقاً به اندازهٔ صفحه', () => {
  it('برگهٔ باز روی گوشی کل دید را می‌گیرد و سرریز افقی ندارد', () => {
    const rule = ruleIn(MOBILE_MEDIA, '.alley3d-panels.is-open');
    expect(rule).toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/inset:\s*0/);
    expect(rule).toMatch(/height:\s*100dvh/);
    expect(rule).toMatch(/max-height:\s*none/);
    expect(rule).toMatch(/overflow:\s*hidden/);
  });

  it('تنها ناحیهٔ اسکرول، بدنهٔ برگه است (اسکرول دوتایی نمی‌شود)', () => {
    const inner = ruleIn(MOBILE_MEDIA, '.alley3d-panels.is-open .alley3d-ticket-inner');
    expect(inner).toMatch(/overflow-y:\s*auto/);
    expect(inner).toMatch(/min-height:\s*0/);

    // قاعده چندسلکتوری است و اسکرول داخلیِ کارت را برمی‌دارد.
    expect(css).toMatch(
      /\.alley3d-panels\.is-open \.held-tickets-scroll,\s*\.alley3d-panels\.is-open \.held-tickets \{[^}]*overflow:\s*visible/s,
    );
  });

  it('سربرگ برگه با دکمهٔ بستن ۴۴px وجود دارد', () => {
    expect(alleyIntegration).toContain('alley-sheet-head');
    expect(alleyIntegration).toContain('aria-label="بستن برگهٔ بلیط"');
    expect(css).toMatch(/\.alley-sheet-close\s*\{[^}]*width:\s*44px/s);
    expect(css).toMatch(/\.alley-sheet-close\s*\{[^}]*height:\s*44px/s);
    // سربرگ پیش‌فرض پنهان است تا دسکتاپ همان چیدمان قبلی را داشته باشد.
    expect(css).toMatch(/\.alley-sheet-head\s*\{\s*display:\s*none/);
  });

  it('با Esc هم بسته می‌شود', () => {
    expect(alleyIntegration).toContain("event.key === 'Escape'");
    expect(alleyIntegration).toContain('setTicketsOpen(false)');
  });

  it('در حالت افقی گوشی (عرض > ۷۲۰) هم برگه جمع می‌شود', () => {
    expect(css).toContain(MOBILE_MEDIA);
    expect(alleyIntegration).toContain('aria-controls="alley-tickets-sheet"');
  });
});

describe('کارت‌های کناری — تب لبه، بدون هم‌پوشانی', () => {
  it('نجوای گروهیِ بسته یک تب ۴۴px روی لبهٔ چپ است', () => {
    const rule = ruleIn(MOBILE_MEDIA, '.whisper-panel:not(.whisper-expanded)');
    expect(rule).toMatch(/width:\s*44px/);
    expect(css).toMatch(/@media \(max-width: 720px\), \(max-height: 560px\)[\s\S]*?\.whisper-panel:not\(\.whisper-expanded\) \.whisper-toggle-text \{\s*display:\s*none/s);
  });

  it('همراهِ تماشاخانهٔ بسته یک تب ۴۴px روی لبهٔ راست است', () => {
    const rule = ruleIn(MOBILE_MEDIA, '.theater-companion-hud');
    expect(rule).toMatch(/width:\s*44px/);
    expect(rule).toMatch(/right:\s*0/);
    expect(css).toMatch(/\.theater-companion-hud:not\(\.is-open\) \.companion-toggle-text \{\s*display:\s*none/s);
  });

  it('کشوهای باز عرضشان با ۱۰۰vw مهار شده و ارتفاعشان از دید بیرون نمی‌زند', () => {
    const rule = ruleIn(MOBILE_MEDIA, '.whisper-panel.whisper-expanded');
    expect(rule).toMatch(/max-width:\s*calc\(100vw - 44px\)/);
    expect(rule).toMatch(/max-height:\s*calc\(100dvh/);

    const companionRule = ruleIn(MOBILE_MEDIA, '.theater-companion-hud.is-open');
    expect(companionRule).toMatch(/max-width:\s*calc\(100vw - 44px\)/);
    expect(companionRule).toMatch(/max-height:\s*calc\(100dvh/);
  });

  it('هر سه پنل با باز شدن دیگری بسته می‌شوند (رویداد مشترک)', () => {
    for (const source of [whisper, companion, exploration]) {
      expect(source).toContain('onOtherPanelOpen');
    }
    expect(whisper).toContain("announcePanelOpen('whisper')");
    expect(companion).toContain("announcePanelOpen('companion')");
    expect(exploration).toContain("announcePanelOpen('exploration')");
  });

  it('کشیدن سربرگ به سمت لبه، کشو را می‌بندد', () => {
    expect(whisper).toContain("useSwipeDismiss(isOpen, () => setOpen(false), 'start')");
    expect(companion).toContain("useSwipeDismiss(isOpen, () => setIsOpen(false), 'end')");
    expect(isDismissSwipe(-SWIPE_DISMISS_PX, 'start')).toBe(true);
    expect(isDismissSwipe(SWIPE_DISMISS_PX, 'start')).toBe(false);
    expect(isDismissSwipe(SWIPE_DISMISS_PX, 'end')).toBe(true);
    expect(isDismissSwipe(10, 'end')).toBe(false);
  });

  it('تبِ بسته با فلش به سمت داخل صحنه اشاره می‌کند و کشو با پردهٔ پشت بسته می‌شود', () => {
    expect(css).toMatch(/\.whisper-panel:not\(\.whisper-expanded\) \.whisper-chevron \{\s*transform:\s*rotate\(-90deg\)/);
    expect(css).toMatch(/\.panel-scrim \{\s*display:\s*block/s);
    expect(whisper).toContain('className="panel-scrim"');
    expect(companion).toContain('className="panel-scrim"');
  });

  it('ستون پایین-چپ: کاوش بالای بلیط، راهنما به شکل دکمهٔ گرد', () => {
    const explore = ruleIn(MOBILE_MEDIA, '.exploration-hud');
    expect(explore).toMatch(/bottom:\s*calc\(env\(safe-area-inset-bottom, 0px\) \+ 64px\)/);
    const trigger = ruleIn(MOBILE_MEDIA, '.controls-help-trigger');
    expect(trigger).toMatch(/left:\s*8px/);
    expect(trigger).toMatch(/width:\s*44px/);
    expect(css).toMatch(/@media \(max-width: 720px\), \(max-height: 560px\)[\s\S]*?\.controls-help-trigger-label \{\s*display:\s*none/s);
  });

  it('دکمهٔ بلیط زیر پد حرکت نمی‌رود (ستون چپ)', () => {
    expect(css).toMatch(/@media \(max-width: 720px\)\s*\{[\s\S]*?\.alley3d-controls\s*\{[\s\S]*?align-items:\s*flex-end/);
  });
});

describe('نصب (PWA) پیش از بازی', () => {
  it('پروندهٔ manifest با نمایش standalone و آیکن‌های لازم ساخته شده است', async () => {
    const { default: manifest } = await import('@/app/manifest');
    const entries = manifest();
    expect(entries.name).toContain('پردهٔ سرخ');
    expect(entries.display).toBe('standalone');
    expect(entries.dir).toBe('rtl');
    expect(entries.lang).toBe('fa');
    const sizes = new Set((entries.icons ?? []).map((icon) => icon.sizes));
    expect(sizes.has('192x192')).toBe(true);
    expect(sizes.has('512x512')).toBe(true);
    expect((entries.icons ?? []).some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it('آیکن‌های PNG واقعی تولید شده‌اند (Safari برای apple-touch-icon به PNG نیاز دارد)', () => {
    for (const file of [
      'public/icons/icon-192.png',
      'public/icons/icon-512.png',
      'public/icons/maskable-512.png',
      'public/icons/apple-touch-icon-180.png',
    ]) {
      expect(existsSync(path.join(root, file)), `${file} تولید نشده`).toBe(true);
      const bytes = readFileSync(path.join(root, file));
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    }
  });

  it('لایه‌وت شامل manifest و متاتگ‌های اپ iOS است', () => {
    expect(layout).toContain("manifest: '/manifest.webmanifest'");
    expect(layout).toContain('appleWebApp');
    expect(layout).toContain("statusBarStyle: 'black-translucent'");
    expect(layout).toContain("apple-touch-icon-180.png");
    expect(layout).toContain('<InstallPrompt />');
    expect(layout).toContain('<ServiceWorkerBridge />');
  });

  it('سرویس‌ورکر فقط دارایی‌های ثابت را کش می‌کند (وضعیت اتاق کهنه نمی‌شود)', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain('STATIC_PREFIXES');
    expect(sw).toContain("'/_next/static/'");
    expect(sw).toContain("request.method !== 'GET'");
    // صفحه‌ها و API نباید کش شوند
    expect(sw).not.toMatch(/'\/api\//);
  });

  it('آستانهٔ نصب فقط در مسیر بازی، فقط روی گوشی و فقط وقتی نصب نشده ظاهر می‌شود', () => {
    const prompt = read('src/components/pwa/InstallPrompt.tsx');
    expect(prompt).toContain("pathname?.startsWith('/room')");
    expect(prompt).toContain("pathname?.startsWith('/invite')");
    expect(prompt).toContain('isStandalone()');
    expect(prompt).toContain('isMobileDevice()');
    expect(prompt).toContain('beforeinstallprompt');
    // همیشه راه ادامه در مرورگر هست؛ آستانه مانع بازی نمی‌شود.
    expect(prompt).toContain('ادامه در همین مرورگر');
    expect(css).toMatch(/\.pwa-gate-actions button \{\s*min-height:\s*48px/s);
  });
});

describe('panel-focus — تنها یک کشو در هر لحظه', () => {
  it('رویداد باز شدن پنل به بقیه اطلاع داده می‌شود', () => {
    const listeners = new Map<string, (event: Event) => void>();
    const fakeWindow = {
      dispatchEvent: (event: Event) => {
        listeners.get(event.type)?.(event);
        return true;
      },
      addEventListener: (type: string, handler: (event: Event) => void) => listeners.set(type, handler),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    const original = globalThis.window;
    // @ts-expect-error — پنجرهٔ جعلی برای تست رفتار خالص
    globalThis.window = fakeWindow;
    try {
      let closed = 0;
      const off = onOtherPanelOpen('whisper', () => {
        closed += 1;
      });
      announcePanelOpen('companion');
      expect(closed).toBe(1);
      // پنل خودش نباید با رویداد خودش بسته شود
      announcePanelOpen('whisper');
      expect(closed).toBe(1);
      off();
      expect(listeners.has(PANEL_OPEN_EVENT)).toBe(false);
    } finally {
      globalThis.window = original;
    }
  });
});
