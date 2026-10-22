import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SIDE_DRAWER_HINT,
  SIDE_DRAWER_ITEM_STAGGER_MS,
  SIDE_DRAWER_PANEL_ID,
  SIDE_DRAWER_TRANSITION_MS,
  SIDE_DRAWER_WIDTH,
  drawerItemStyle,
  drawerPanelClass,
  drawerRootClass,
  drawerRootStyle,
  drawerStateMessage,
  drawerTabClass,
  drawerTabIcon,
  drawerTabLabel,
  drawerTabText,
  isDrawerCloseKey,
  nextDrawerIndex,
} from '../../src/components/hud/side-drawer';

/**
 * منوی کشویی لبهٔ راست — بازبینی UI امیرعلی
 * ---------------------------------------------------------------------------
 * باگ/درخواست: «یک دکمهٔ کشو باشد که با زدنش بسته شود و برود سمت راست، با
 * انیمیشن باز و بسته شدن، و به تم سایت بخورد.»
 *
 * این فایل هم منطق خالص را می‌سنجد، هم ساختار دسترس‌پذیر کامپوننت را، هم
 * قواعد CSS انیمیشن (بسته = بیرون از دید سمت راست) را، هم اتصال به هر دو
 * نمای بازی.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const logicSource = read('../../src/components/hud/side-drawer.ts');
const component = read('../../src/components/hud/SideDrawer.tsx');
const css = read('../../src/app/globals.css');
const scene3d = read('../../src/components/alley/AlleyRoomThreeIntegration.tsx');
const sceneClassic = read('../../src/components/alley/AlleyFirstPersonScene.tsx');

const MARKER = 'بازبینی امیرعلی — منوی کشویی لبهٔ راست (SideDrawer)';
const start = css.indexOf(MARKER);
const nextSection = css.indexOf('\n/* ====', start + 1);
const drawerCss = start >= 0 ? css.slice(start, nextSection > 0 ? nextSection : undefined) : '';
const PERSIAN = /[\u0600-\u06FF]/;

describe('منوی کشویی — منطق خالص', () => {
  it('در حالت بسته پنل کلاس is-closed و در حالت باز is-open می‌گیرد', () => {
    expect(drawerPanelClass(false)).toContain('is-closed');
    expect(drawerPanelClass(true)).toContain('is-open');
    expect(drawerPanelClass(true)).not.toContain('is-closed');
    expect(drawerRootClass(false)).toContain('is-closed');
    expect(drawerRootClass(true)).toContain('is-open');
    expect(drawerTabClass(false)).toContain('is-closed');
    expect(drawerTabClass(true)).toContain('is-open');
  });

  it('برچسب و متن دکمه برای هر دو وضعیت فارسی و متمایز است', () => {
    expect(drawerTabLabel(true)).toBe('بستن منو');
    expect(drawerTabLabel(false)).toBe('باز کردن منو');
    expect(drawerTabText(true)).toBe('بستن');
    expect(drawerTabText(false)).toBe('منو');
    for (const text of [drawerTabLabel(true), drawerTabLabel(false), drawerTabText(true), drawerTabText(false)]) {
      expect(text).toMatch(PERSIAN);
      expect(text).not.toMatch(/[A-Za-z]/);
    }
  });

  it('نشانهٔ دکمه با باز شدن عوض می‌شود (☰ ↔ ✕)', () => {
    expect(drawerTabIcon(false)).toBe('☰');
    expect(drawerTabIcon(true)).toBe('✕');
  });

  it('اعلان صفحه‌خوان برای باز و بسته شدن فارسی است', () => {
    expect(drawerStateMessage(true)).toMatch(PERSIAN);
    expect(drawerStateMessage(false)).toMatch(PERSIAN);
    expect(drawerStateMessage(true)).not.toBe(drawerStateMessage(false));
  });

  it('Escape کشو را می‌بندد و کلیدهای دیگر نه', () => {
    expect(isDrawerCloseKey('Escape')).toBe(true);
    for (const key of ['Esc', 'Enter', 'e', 'Tab', 'ArrowDown']) {
      expect(isDrawerCloseKey(key), key).toBe(false);
    }
  });

  it('پیمایش با ↑ ↓ دور می‌زند و Home/End درست می‌روند', () => {
    expect(nextDrawerIndex(0, 4, 'ArrowDown')).toBe(1);
    expect(nextDrawerIndex(3, 4, 'ArrowDown')).toBe(0);
    expect(nextDrawerIndex(0, 4, 'ArrowUp')).toBe(3);
    expect(nextDrawerIndex(2, 4, 'ArrowUp')).toBe(1);
    expect(nextDrawerIndex(2, 4, 'Home')).toBe(0);
    expect(nextDrawerIndex(1, 4, 'End')).toBe(3);
    expect(nextDrawerIndex(1, 4, 'Tab')).toBeNull();
    expect(nextDrawerIndex(1, 4, 'Enter')).toBeNull();
  });

  it('ورودی نامعتبر پیمایش را نمی‌شکند', () => {
    expect(nextDrawerIndex(0, 0, 'ArrowDown')).toBeNull();
    expect(nextDrawerIndex(Number.NaN, Number.NaN, 'ArrowDown')).toBeNull();
    expect(nextDrawerIndex(Number.NaN, 3, 'ArrowDown')).toBe(1);
    expect(nextDrawerIndex(-1, 3, 'ArrowDown')).toBe(1);
  });

  it('استایل پلکانی فقط متغیر CSS می‌دهد و سقف دارد', () => {
    expect(drawerItemStyle(0)).toEqual({ '--drawer-item-index': '0' });
    expect(drawerItemStyle(3)).toEqual({ '--drawer-item-index': '3' });
    expect(drawerItemStyle(-2)).toEqual({ '--drawer-item-index': '0' });
    expect(drawerItemStyle(Number.NaN)).toEqual({ '--drawer-item-index': '0' });
    expect(drawerItemStyle(99)['--drawer-item-index']).toBe('20');
  });

  it('متغیرهای ریشه با CSS هم‌خوان‌اند', () => {
    const style = drawerRootStyle();
    expect(style['--side-drawer-w']).toBe(SIDE_DRAWER_WIDTH);
    expect(style['--side-drawer-ms']).toBe(`${SIDE_DRAWER_TRANSITION_MS}ms`);
    expect(style['--side-drawer-stagger']).toBe(`${SIDE_DRAWER_ITEM_STAGGER_MS}ms`);
    expect(drawerCss).toContain(`--side-drawer-ms: ${SIDE_DRAWER_TRANSITION_MS}ms`);
    expect(drawerCss).toContain(`--side-drawer-stagger: ${SIDE_DRAWER_ITEM_STAGGER_MS}ms`);
  });

  it('مدت انیمیشن طبیعی است (نه صفر، نه کند)', () => {
    expect(SIDE_DRAWER_TRANSITION_MS).toBeGreaterThanOrEqual(220);
    expect(SIDE_DRAWER_TRANSITION_MS).toBeLessThanOrEqual(450);
    expect(SIDE_DRAWER_ITEM_STAGGER_MS).toBeGreaterThan(0);
    expect(SIDE_DRAWER_ITEM_STAGGER_MS).toBeLessThanOrEqual(60);
  });

  it('راهنمای پایین پنل فارسی و کوتاه است', () => {
    expect(SIDE_DRAWER_HINT).toMatch(PERSIAN);
    expect(SIDE_DRAWER_HINT).not.toMatch(/[A-Za-z]{2,}/);
    expect(logicSource).not.toContain("from 'react'");
  });
});

describe('منوی کشویی — دسترس‌پذیری و رفتار کامپوننت', () => {
  it('دکمهٔ کشو وضعیت و کنترل خود را اعلام می‌کند', () => {
    expect(component).toContain('aria-expanded={open}');
    expect(component).toContain('aria-controls={SIDE_DRAWER_PANEL_ID}');
    expect(component).toContain('aria-label={drawerTabLabel(open)}');
    expect(component).toContain('id={SIDE_DRAWER_PANEL_ID}');
    expect(SIDE_DRAWER_PANEL_ID).toBe('side-drawer-panel');
    expect(component).toContain('type="button"');
  });

  it('کلیک روی زبانه وضعیت را برمی‌گرداند (باز ⇄ بسته)', () => {
    expect(component).toContain('const toggle = () => {');
    expect(component).toContain('setOpen((value) => !value);');
    expect(component).toContain('onClick={toggle}');
  });

  it('Esc، کلیک پرده و انتخاب گزینه کشو را می‌بندند', () => {
    expect(component).toContain('isDrawerCloseKey(event.key)');
    expect(component).toContain("document.addEventListener('keydown', onKeyDown)");
    expect(component).toContain('className="side-drawer-scrim"');
    expect(component).toContain('onClick={() => close(true)}');
    expect(component).toContain('item.onSelect?.();');
    expect(component).toContain('closeAfterSelect();');
  });

  it('فوکوس با باز شدن به اولین گزینه و با بستن به زبانه برمی‌گردد', () => {
    expect(component).toContain('first?.focus({ preventScroll: true })');
    expect(component).toContain('window.setTimeout(() => tabRef.current?.focus({ preventScroll: true }), 0)');
    expect(component).toContain("itemRefs.current[index] = element;");
  });

  it('انتخاب گزینه، فوکوس سرگردان را به زبانه برمی‌گرداند', () => {
    expect(component).toContain('ref={panelRef}');
    expect(component).toContain("active === document.body || Boolean(panelRef.current?.contains(active))");
    // اگر خود گزینه فوکوس را به مودال/ورودی منتقل کرده باشد، دست نمی‌زنیم.
    expect(component).toContain("if (stranded) tabRef.current?.focus({ preventScroll: true });");
  });

  it('پیمایش با کیبورد به منطق خالص وصل است', () => {
    expect(component).toContain('nextDrawerIndex(current, enabled.length, event.key)');
    expect(component).toContain('event.preventDefault();');
    expect(component).toContain('itemRefs.current[targetIndex]?.focus({ preventScroll: true });');
  });

  it('گزینه‌های غیرفعال از پیمایش کنار گذاشته می‌شوند', () => {
    expect(component).toContain('filter((entry) => !entry.disabled)');
    expect(component).toContain('disabled={item.disabled}');
  });

  it('در حالت بسته پنل از صفحه‌خوان و فوکوس پنهان است', () => {
    expect(component).toContain('aria-hidden={!open}');
    expect(component).toContain('data-open={open ? \'true\' : \'false\'}');
  });

  it('وضعیت باز/بسته با اعلان زنده هم گفته می‌شود', () => {
    expect(component).toContain('role="status"');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain('{drawerStateMessage(open)}');
  });

  it('هیچ داده‌ای واکشی نمی‌کند و به موتور سه‌بعدی وابسته نیست', () => {
    for (const forbidden of ['fetch(', 'EventSource', 'localStorage', "from '@/engine3d", 'useThree']) {
      expect(component, forbidden).not.toContain(forbidden);
    }
  });

  it('پنل عنوان و راهنما دارد و فهرست نقش list دارد', () => {
    expect(component).toContain('<h2 className="side-drawer-title">{title}</h2>');
    expect(component).toContain('role="list"');
    expect(component).toContain('<p className="side-drawer-hint">{SIDE_DRAWER_HINT}</p>');
    expect(component).toContain('side-drawer-topline');
  });
});

describe('منوی کشویی — انیمیشن و تم در CSS', () => {
  it('در حالت بسته پنل کامل به سمت راست بیرون است', () => {
    expect(drawerCss).toMatch(/\.side-drawer\s*\{[^}]*transform:\s*translateX\(100%\)/s);
    expect(drawerCss).toMatch(/\.side-drawer\.is-open\s*\{[^}]*transform:\s*translateX\(0\)/s);
  });

  it('انتقال با مدت و منحنی نرم تعریف شده و در حالت بسته visibility پنهان است', () => {
    expect(drawerCss).toContain('transition: transform var(--side-drawer-ms) var(--side-drawer-ease), visibility 0s linear var(--side-drawer-ms);');
    expect(drawerCss).toMatch(/\.side-drawer\s*\{[^}]*visibility:\s*hidden/s);
    expect(drawerCss).toMatch(/\.side-drawer\.is-open\s*\{[^}]*visibility:\s*visible/s);
    expect(drawerCss).toContain('--side-drawer-ease: cubic-bezier(0.22, 0.8, 0.28, 1);');
  });

  it('زبانه هم با پنل حرکت می‌کند (حس کشیدن کشو)', () => {
    expect(drawerCss).toMatch(/\.side-drawer-tab\.is-open\s*\{[^}]*transform:\s*translate\(calc\(-1 \* var\(--side-drawer-w\)\), -50%\)/s);
  });

  it('آیتم‌ها با پلکان وارو می‌آیند و در حالت بسته جابه‌جا و شفاف‌اند', () => {
    expect(drawerCss).toMatch(/\.side-drawer-item\s*\{[^}]*opacity:\s*0/s);
    expect(drawerCss).toMatch(/\.side-drawer-item\s*\{[^}]*transform:\s*translateX\(18px\)/s);
    expect(drawerCss).toContain('transition-delay: calc(var(--drawer-item-index, 0) * var(--side-drawer-stagger));');
  });

  it('پردهٔ تیره فقط در حالت باز کلیک‌پذیر و دیده می‌شود', () => {
    expect(drawerCss).toMatch(/\.side-drawer-scrim\s*\{[^}]*opacity:\s*0/s);
    expect(drawerCss).toContain(".side-drawer-root[data-open='true'] .side-drawer-scrim");
    expect(drawerCss).toMatch(/\.side-drawer-scrim\s*\{[^}]*pointer-events:\s*none/s);
  });

  it('تم سایت رعایت شده: مخمل تیره، طلایی و وزیرمتن', () => {
    expect(drawerCss).toContain('var(--gold)');
    expect(drawerCss).toContain('var(--text-primary)');
    expect(drawerCss).toContain('var(--leading-relaxed)');
    expect(drawerCss).toContain('border-inline-start: 1px solid rgba(212, 175, 99, 0.32);');
    expect(drawerCss).toContain('backdrop-filter: blur(10px);');
  });

  it('هدف لمسی زبانه و آیتم‌ها ≥ ۴۴px است', () => {
    expect(drawerCss).toMatch(/\.side-drawer-item\s*\{[^}]*min-height:\s*56px/s);
    expect(drawerCss).toMatch(/\.side-drawer-tab\s*\{[^}]*width:\s*46px/s);
    expect(drawerCss).toMatch(/\.side-drawer-tab\s*\{[^}]*height:\s*108px/s);
    expect(drawerCss).toContain(':focus-visible');
  });

  it('با prefers-reduced-motion هیچ حرکتی انجام نمی‌شود', () => {
    const mediaIndex = drawerCss.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(mediaIndex).toBeGreaterThan(-1);
    const block = drawerCss.slice(mediaIndex);
    expect(block).toContain('transition: none !important;');
    expect(block).toContain('animation: none !important;');
    expect(block).toContain('.side-drawer-tab.is-open');
  });

  it('فونت‌ها از توکن‌های سایت می‌آیند (هیچ اندازهٔ زیر ۱۲px)', () => {
    const sizes = [...drawerCss.matchAll(/font-size:\s*([^;]+);/g)].map((match) => match[1].trim());
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      expect(['var(--text-xs)', 'var(--text-sm)', 'var(--text-base)', 'var(--text-lg)', '1.25rem']).toContain(size);
    }
  });
});

describe('منوی کشویی — اتصال به نمای بازی', () => {
  it('در نمای سه‌بعدی کوچه mount شده و گزینه‌های واقعی دارد', () => {
    expect(scene3d).toContain("import SideDrawer, { type SideDrawerItem } from '../hud/SideDrawer';");
    expect(scene3d).toContain('<SideDrawer items={drawerItems} />');
    expect(scene3d).toContain('const drawerItems = useMemo<SideDrawerItem[]>');
    for (const action of ['setTicketsOpen(true)', 'setChatOpen(true)', 'setShowPlaybill(true)', 'setShowRowChart(true)', 'setDoorModalOpen(true)']) {
      expect(scene3d, action).toContain(action);
    }
  });

  it('در نمای کلاسیک کوچه هم mount شده است', () => {
    expect(sceneClassic).toContain("import SideDrawer, { type SideDrawerItem } from '../hud/SideDrawer';");
    expect(sceneClassic).toContain('<SideDrawer items={drawerItems} />');
    expect(sceneClassic).toContain("onSelect: () => openCluePanel('playbill')");
    expect(sceneClassic).toContain('onSelect: () => onReplayInvitation()');
  });

  it('گزینه‌ها متن فارسی و توضیح کوتاه دارند', () => {
    for (const scene of [scene3d, sceneClassic]) {
      const labels = [...scene.matchAll(/label: '([^']+)'/g)].map((match) => match[1]);
      expect(labels.length).toBeGreaterThanOrEqual(5);
      for (const label of labels) expect(label).toMatch(PERSIAN);
      const hints = [...scene.matchAll(/hint: '([^']+)'/g)].map((match) => match[1]);
      expect(hints.length).toBeGreaterThanOrEqual(5);
      for (const hint of hints) expect(hint).toMatch(PERSIAN);
    }
  });
});
