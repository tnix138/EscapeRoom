/**
 * mobile-responsive.test.ts — قرارداد ریسپانسیو موبایل (بدون مرورگر)
 * ---------------------------------------------------------------------------
 * این تست همان چیزی را قفل می‌کند که در بازبینی گوشی اصلاح شد و اگر کسی
 * دوباره رگرسیون وارد کند، CI سریع شکست می‌خورد:
 *
 *  ۱) متا-ویوپورت با `viewport-fit=cover` تا لایه‌های ایمن کار کنند؛
 *  ۲) نبود `minHeight` ثابت ۶۰۰/۵۶۰ در قاب صحنه‌های سه‌بعدی (علت اسکرول در گوشی)؛
 *  ۳) وجود پد حرکت لمسی و اتصال آن به حلقهٔ حرکت بازیکن؛
 *  ۴) قواعد کلیدی CSS: بدون سرریز افقی، فاصلهٔ ایمن، هدف لمسی، برگهٔ بلیط تاشو
 *     و دیده‌شدن پنل کناریِ فعال در کوچهٔ کلاسیک.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

const css = read('src/app/globals.css');
const layout = read('src/app/layout.tsx');
const roomPage = read('src/app/room/[code]/page.tsx');
const roomCss = read('src/app/room/[code]/page.module.css');
const alleyIntegration = read('src/components/alley/AlleyRoomThreeIntegration.tsx');
const darkScene = read('src/components/auditorium/DarkAuditoriumThreeScene.tsx');
const controls = read('src/engine3d/usePlayerControls.ts');
const touchModule = read('src/engine3d/touch-controls.ts');

describe('موبایل — viewport و قاب صحنه', () => {
  it('متا-ویوپورت برای لبه‌های ایمن و صفحه‌کلید موبایل تنظیم شده است', () => {
    expect(layout).toContain("viewportFit: 'cover'");
    expect(layout).toContain("interactiveWidget: 'resizes-content'");
    expect(layout).toContain("width: 'device-width'");
  });

  it('هیچ صحنهٔ سه‌بعدی دیگری minHeight ثابت ۶۰۰/۵۶۰px ندارد', () => {
    for (const source of [alleyIntegration, darkScene, roomPage]) {
      expect(source).not.toMatch(/minHeight:\s*60?0\b/);
      expect(source).not.toMatch(/minHeight:\s*560\b/);
    }
    expect(alleyIntegration).toContain('alley3d-stage');
    expect(darkScene).toContain('darkhall-stage');
  });

  it('قاب صحنه با dvh هم‌اندازهٔ دید گوشی است و نمای کلاسیک اسکرول‌پذیر می‌ماند', () => {
    expect(roomCss).toMatch(/\.stage\s*\{[^}]*height:\s*100dvh/s);
    expect(roomCss).toMatch(/\.stage\s*\{[^}]*overflow:\s*hidden/s);
    expect(roomCss).toContain('.stageScrollable');
    expect(roomPage).toContain('styles.stageScrollable');
  });
});

describe('موبایل — کنترل حرکت لمسی', () => {
  it('ماژول پد لمسی با پاک‌سازی کامل وجود دارد', () => {
    expect(touchModule).toContain('export function attachTouchControls');
    expect(touchModule).toContain('export function prefersTouchControls');
    expect(touchModule).toContain('touch-action');
    expect(touchModule).toContain('dispose');
  });

  it('حلقهٔ حرکت، ورودی کیبورد و پد لمسی را ترکیب می‌کند', () => {
    expect(controls).toContain('attachTouchControls');
    expect(controls).toContain('prefersTouchControls');
    expect(controls).toContain('touchMoveRef');
    expect(controls).toMatch(/forward:\s*keyboard\.forward\s*\|\|\s*touch\.forward/);
    expect(controls).toMatch(/sprint:\s*keyboard\.sprint\s*\|\|\s*touch\.sprint/);
  });

  it('پد لمسی فقط روی صفحهٔ لمسی ساخته می‌شود و پد را از پن‌کردن دوربین جدا می‌کند', () => {
    expect(controls).toMatch(/if \(!prefersTouchControls\(\)\) return;/);
    expect(touchModule).toContain('stopPropagation');
  });
});

describe('موبایل — قواعد CSS', () => {
  it('بوم صفحه در عرض کوچک سرریز افقی ندارد', () => {
    expect(css).toMatch(/body\s*\{[^}]*overflow-x:\s*clip/s);
    expect(css).toContain('@supports (overflow: clip)');
  });

  it('لایه‌های شناور فاصلهٔ ایمن بریدگی/نوار خانه را رعایت می‌کنند', () => {
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toContain('env(safe-area-inset-top');
    expect(css).toContain('env(safe-area-inset-right');
  });

  it('روی صفحهٔ لمسی راهنمای کیبورد پنهان و هدف لمس ۴۴px است', () => {
    expect(css).toMatch(/@media \(pointer: coarse\)\s*\{[\s\S]*?\.alley3d-desktop-only\s*\{[^}]*display:\s*none/s);
    expect(css).toMatch(/@media \(pointer: coarse\)\s*\{[\s\S]*?kbd\s*\{\s*display:\s*none/s);
    expect(css).toMatch(/\.touch-pad-button\s*\{[^}]*min-width:\s*44px/s);
    expect(css).toMatch(/\.touch-pad-button\s*\{[^}]*min-height:\s*44px/s);
  });

  it('پد حرکت فقط جای پایین-راست را می‌گیرد و HUD از آن فاصله دارد', () => {
    expect(css).toMatch(/\.touch-move-pad\s*\{[^}]*right:\s*calc\(env\(safe-area-inset-right/s);
    expect(css).toMatch(/@media \(max-width: 720px\)\s*\{[\s\S]*?\.darkhall-chat\s*\{[^}]*right:\s*calc\(env\(safe-area-inset-right/s);
  });

  it('برگهٔ بلیط روی گوشی پیش‌فرض بسته است و با دکمه باز می‌شود', () => {
    expect(css).toMatch(/@media \(max-width: 720px\)\s*\{[\s\S]*?\.alley3d-panels\s*\{\s*display:\s*none/s);
    expect(css).toContain('.alley3d-panels.is-open');
    expect(alleyIntegration).toContain('alley3d-tickets-toggle');
    expect(alleyIntegration).toContain('aria-expanded={ticketsOpen}');
  });

  it('در کوچهٔ کلاسیک، پنل کناریِ فعال روی گوشی دیده می‌شود', () => {
    expect(css).toContain('.alley-panorama.view-left .target-left');
    expect(css).toContain('.alley-panorama.view-right .target-right');
    expect(css).toMatch(/\.alley-panorama\.view-left \.target-center[\s\S]*?display:\s*none/);
  });

  it('صفحهٔ دعوت‌نامه روی صفحهٔ کوتاه جمع می‌شود', () => {
    expect(css).toContain('@media (max-width: 620px), (max-height: 700px)');
    expect(css).toMatch(/\.invitation-object\s*\{[^}]*height:\s*clamp\(270px, 52svh, 380px\)/s);
  });

  it('ورودی‌های چت روی iOS حداقل ۱۶px هستند تا زوم نکنند', () => {
    expect(css).toMatch(/\.darkhall-chat-input\s*\{\s*font-size:\s*var\(--text-base\)/);
  });
});

describe('موبایل — نبود رگرسیون در چیدمان قاب', () => {
  it('هر کلاس ارجاع‌شده در صفحهٔ اتاق واقعاً در CSS ماژول تعریف شده است', () => {
    /* اشتباه در نام کلاس CSS-module باعث می‌شود کلاس حذف شود و نوار ابزار
       از جریان absolute خارج و ۴۴px به ارتفاع صفحه اضافه شود. */
    const used = new Set(Array.from(roomPage.matchAll(/styles\.([A-Za-z0-9_]+)/g), (m) => m[1]));
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(roomCss, `کلاس «${name}» در page.module.css تعریف نشده`).toMatch(
        new RegExp(`\\.${name}\\b`),
      );
    }
  });

  it('نوار ابزار صحنه absolute است تا ارتفاع دید را نشکند', () => {
    expect(roomCss).toMatch(/\.sceneToolbar\s*\{[^}]*position:\s*absolute/s);
    expect(roomCss).toMatch(/\.sceneToolbar\s*\{[^}]*z-index:\s*50/s);
  });
});

/* -------------------------------------------------------------------------
 * پد حرکت لمسی — آزمون رفتار با یک DOM ساختگی سبک (بدون jsdom)
 * ---------------------------------------------------------------------- */
interface FakeEl {
  tagName: string;
  type?: string;
  className?: string;
  textContent?: string;
  style?: Record<string, string>;
  children: FakeEl[];
  attributes: Record<string, string>;
  listeners: Record<string, Array<(event: unknown) => void>>;
  appendChild: (child: FakeEl) => FakeEl;
  addEventListener: (name: string, fn: (event: unknown) => void) => void;
  dispatch: (name: string, event?: unknown) => void;
  remove: () => void;
  querySelector: (selector: string) => FakeEl | null;
  querySelectorAll: (selector: string) => FakeEl[];
  setAttribute: (name: string, value: string) => void;
  setPointerCapture?: () => void;
  classList: { add: (name: string) => void; remove: (name: string) => void };
  removed?: boolean;
}

function fakeElement(tagName: string): FakeEl {
  const classes = new Set<string>();
  const el: FakeEl = {
    tagName: tagName.toUpperCase(),
    children: [],
    attributes: {},
    listeners: {},
    appendChild(child) {
      el.children.push(child);
      return child;
    },
    addEventListener(name, fn) {
      (el.listeners[name] ??= []).push(fn);
    },
    dispatch(name, event = {}) {
      for (const fn of el.listeners[name] ?? []) fn({ preventDefault() {}, stopPropagation() {}, ...(event as object) });
    },
    remove() {
      el.removed = true;
    },
    querySelector(selector) {
      return el.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      const cls = selector.replace(/^\./, '');
      const out: FakeEl[] = [];
      const walk = (node: FakeEl) => {
        for (const child of node.children) {
          if (classesOf(child).has(cls)) out.push(child);
          walk(child);
        }
      };
      walk(el);
      return out;
    },
    setAttribute(name, value) {
      el.attributes[name] = value;
    },
    setPointerCapture() {},
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
  };
  Object.defineProperty(el, 'className', {
    get: () => Array.from(classes).join(' '),
    set: (value: string) => {
      classes.clear();
      value.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
    },
  });
  return el;
}

function classesOf(el: FakeEl): Set<string> {
  return new Set((el.className ?? '').split(/\s+/).filter(Boolean));
}

describe('پد حرکت لمسی — رفتار', () => {
  it('چهار جهت + دویدن می‌سازد، جهت را report می‌کند و با رها کردن صفر می‌شود', async () => {
    const container = fakeElement('div');
    const windowListeners: Record<string, Array<() => void>> = {};
    const fakeWindow = {
      addEventListener: (name: string, fn: () => void) => {
        (windowListeners[name] ??= []).push(fn);
      },
      removeEventListener: (name: string, fn: () => void) => {
        windowListeners[name] = (windowListeners[name] ?? []).filter((item) => item !== fn);
      },
      matchMedia: () => ({ matches: false }),
    };
    const globals = globalThis as unknown as Record<string, unknown>;
    const previousWindow = globals.window;
    const previousDocument = globals.document;
    globals.window = fakeWindow;
    globals.document = { createElement: (tag: string) => fakeElement(tag) };

    try {
      const { attachTouchControls } = await import('../../src/engine3d/touch-controls');
      const seen: Array<Record<string, boolean>> = [];
      const handle = attachTouchControls(container as unknown as HTMLElement, (vector) => {
        seen.push({ ...vector });
      });

      const pad = container.querySelector('.touch-move-pad') as FakeEl;
      expect(pad).not.toBeNull();
      const buttons = pad.querySelectorAll('.touch-pad-button');
      expect(buttons).toHaveLength(5);
      expect(buttons.map((button) => button.attributes['aria-label'])).toContain('جلو رفتن');

      const forward = buttons.find((button) => classesOf(button).has('touch-pad-up'))!;
      forward.dispatch('pointerdown', { pointerId: 1 });
      expect(seen.at(-1)).toMatchObject({ forward: true });

      forward.dispatch('pointerup', { pointerId: 1 });
      expect(seen.at(-1)).toMatchObject({ forward: false });

      const sprint = buttons.find((button) => classesOf(button).has('touch-pad-sprint'))!;
      sprint.dispatch('pointerdown', { pointerId: 2 });
      expect(seen.at(-1)).toMatchObject({ sprint: true });

      handle.dispose();
      expect(pad.removed).toBe(true);
    } finally {
      globals.window = previousWindow;
      globals.document = previousDocument;
    }
  });
});
