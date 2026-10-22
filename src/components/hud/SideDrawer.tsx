'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  SIDE_DRAWER_HINT,
  SIDE_DRAWER_PANEL_ID,
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
} from './side-drawer';

export interface SideDrawerItem {
  id: string;
  /** برچسب کوتاه و فارسی. */
  label: string;
  /** یک خط توضیح زیر برچسب (اختیاری). */
  hint?: string;
  /** نشانهٔ تصویری؛ فقط تزئینی است. */
  icon: string;
  /** کاری که با انتخاب این گزینه انجام می‌شود. */
  onSelect?: () => void;
  /** برچسب کوچک وضعیت، مثلاً «باز». */
  badge?: string;
  disabled?: boolean;
}

export interface SideDrawerProps {
  items: SideDrawerItem[];
  title?: string;
  subtitle?: string;
  /** باز بودن در اولین رندر (پیش‌فرض: بسته). */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * منوی کشویی لبهٔ راست صفحه — تماشاخانهٔ اُرفه‌ئو.
 *
 * رفتار:
 *  - زبانهٔ «منو» روی لبهٔ راست است؛ با کلیک، پنل از راست به داخل می‌آید و
 *    خودِ زبانه هم با پنل به سمت چپ می‌رود (حس کشیدنِ کشو).
 *  - کلیک دوباره، `Esc`، کلیک روی پردهٔ تیره یا انتخاب هر گزینه، پنل را به
 *    سمت راست بیرون می‌برد (همان انیمیشن، در جهت مخالف).
 *  - در حالت بسته پنل `visibility: hidden` است تا هیچ‌وقت فوکوس یا کلیک نگیرد.
 *  - با `prefers-reduced-motion` هیچ حرکتی انجام نمی‌شود؛ باز/بسته شدن فوری است.
 *
 * این کامپوننت هیچ داده‌ای واکشی نمی‌کند و هیچ خط پایانی به بازی ندارد؛
 * صحنهٔ بازی فقط فهرست گزینه‌ها را می‌دهد.
 */
export default function SideDrawer({
  items,
  title = 'منوی بازی',
  subtitle = 'تماشاخانهٔ اُرفه‌ئو',
  defaultOpen = false,
  className,
}: SideDrawerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const tabRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => tabRef.current?.focus({ preventScroll: true }), 0);
  }, []);

  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) focusTab();
    },
    [focusTab],
  );

  /**
   * بستن بعد از انتخاب یک گزینه: اگر خودِ گزینه مقصد فوکوس جدیدی باز نکرده
   * باشد (مثلاً مودالی با ورودی)، فوکوس را به زبانه برمی‌گرداند تا کاربر
   * کیبوردی روی `body` سرگردان نماند.
   */
  const closeAfterSelect = useCallback(() => {
    setOpen(false);
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      const active = document.activeElement;
      const stranded = !active || active === document.body || Boolean(panelRef.current?.contains(active));
      if (stranded) tabRef.current?.focus({ preventScroll: true });
    }, 0);
  }, []);

  // Esc در هر جای صفحه، کشو را می‌بندد (فقط وقتی باز است).
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isDrawerCloseKey(event.key)) return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  // با باز شدن، فوکوس روی اولین گزینه می‌رود تا با کیبورد قابل استفاده باشد.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => {
      const first = itemRefs.current.find((element) => element && !element.disabled);
      first?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const enabled = items.map((item, index) => ({ index, disabled: Boolean(item.disabled) })).filter((entry) => !entry.disabled);
    if (enabled.length === 0) return;
    const activeIndex = enabled.findIndex((entry) => entry.index === itemRefs.current.findIndex((element) => element === document.activeElement));
    const current = activeIndex === -1 ? 0 : activeIndex;
    const next = nextDrawerIndex(current, enabled.length, event.key);
    if (next === null) return;
    event.preventDefault();
    const targetIndex = enabled[next]?.index;
    if (targetIndex === undefined) return;
    itemRefs.current[targetIndex]?.focus({ preventScroll: true });
  };

  const toggle = () => {
    setOpen((value) => !value);
  };

  return (
    <div className={`${drawerRootClass(open)} ${className ?? ''}`.trim()} data-open={open ? 'true' : 'false'} style={drawerRootStyle()}>
      {/* پردهٔ تیره؛ فقط در حالت باز کلیک‌پذیر است. */}
      <div className="side-drawer-scrim" aria-hidden="true" onClick={() => close(true)} />

      <aside
        ref={panelRef}
        id={SIDE_DRAWER_PANEL_ID}
        className={drawerPanelClass(open)}
        aria-hidden={!open}
        aria-label={title}
      >
        <div className="side-drawer-topline" aria-hidden="true" />
        <header className="side-drawer-head">
          <p className="side-drawer-eyebrow">
            <span aria-hidden="true">✳</span> {subtitle}
          </p>
          <h2 className="side-drawer-title">{title}</h2>
          <p className="side-drawer-lede">هر بخش را از همین‌جا باز کنید؛ بازی همان‌جا منتظرتان می‌ماند.</p>
        </header>

        <ul className="side-drawer-list" role="list" onKeyDown={onListKeyDown}>
          {items.map((item, index) => (
            <li key={item.id} className="side-drawer-row" style={drawerItemStyle(index)}>
              <button
                type="button"
                className="side-drawer-item"
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                disabled={item.disabled}
                onClick={() => {
                  item.onSelect?.();
                  closeAfterSelect();
                }}
              >
                <span className="side-drawer-item-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="side-drawer-item-text">
                  <strong>{item.label}</strong>
                  {item.hint ? <small>{item.hint}</small> : null}
                </span>
                {item.badge ? <span className="side-drawer-item-badge">{item.badge}</span> : null}
                <span className="side-drawer-item-arrow" aria-hidden="true">
                  ‹
                </span>
              </button>
            </li>
          ))}
        </ul>

        <footer className="side-drawer-foot">
          <p className="side-drawer-hint">{SIDE_DRAWER_HINT}</p>
        </footer>
      </aside>

      <button
        type="button"
        ref={tabRef}
        className={drawerTabClass(open)}
        aria-expanded={open}
        aria-controls={SIDE_DRAWER_PANEL_ID}
        aria-label={drawerTabLabel(open)}
        title={drawerTabLabel(open)}
        onClick={toggle}
      >
        <span className="side-drawer-tab-icon" aria-hidden="true">
          {drawerTabIcon(open)}
        </span>
        <span className="side-drawer-tab-text">{drawerTabText(open)}</span>
      </button>

      <p className="sr-only" role="status" aria-live="polite">
        {drawerStateMessage(open)}
      </p>
    </div>
  );
}
