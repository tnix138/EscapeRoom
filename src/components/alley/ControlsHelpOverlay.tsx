'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CONTROL_HELP_ROWS, isControlHelpRoute } from './controls-help-data';

const DISMISS_KEY = 'orfeo:controls-help-dismissed';
const SEEN_KEY = 'orfeo:controls-help-seen';

function readFlag(storage: Storage | null, key: string) {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export default function ControlsHelpOverlay() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const autoOpened = useRef(false);
  const [sceneReady, setSceneReady] = useState(false);
  const active = isControlHelpRoute(pathname);
  const enabled = active && sceneReady;

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback((focus: boolean) => {
    setOpen((value) => {
      setFocusOnOpen(!value && focus);
      return !value;
    });
  }, []);

  useEffect(() => {
    if (!active) {
      setSceneReady(false);
      return;
    }
    const detect = () =>
      setSceneReady(Boolean(document.querySelector('.alley-game-shell, .held-tickets')));
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      autoOpened.current = false;
      return;
    }
    if (autoOpened.current) return;
    autoOpened.current = true;
    let dismissed = false;
    let seen = false;
    try {
      dismissed = readFlag(window.localStorage, DISMISS_KEY);
      seen = readFlag(window.sessionStorage, SEEN_KEY);
    } catch {
      dismissed = false;
      seen = false;
    }
    if (dismissed || seen) return;
    const timer = window.setTimeout(() => {
      setOpen(true);
      try {
        window.sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* storage is optional */
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key.toLowerCase() !== 'h' || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      toggle(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, toggle]);

  useEffect(() => {
    if (!open || !focusOnOpen) return;
    closeRef.current?.focus({ preventScroll: true });
    setFocusOnOpen(false);
  }, [open, focusOnOpen]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.controls-help, .controls-help-trigger')) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function dismiss() {
    if (dontShowAgain) {
      try {
        window.localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* storage is optional */
      }
    }
    close();
  }

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className="controls-help-trigger"
        aria-expanded={open}
        aria-controls="controls-help-panel"
        onClick={() => toggle(true)}
        title="راهنمای کنترل‌ها (H)"
      >
        <span aria-hidden="true">؟</span>
        <span>راهنمای حرکت</span>
      </button>
      {open && (
        <div
          className="controls-help"
          id="controls-help-panel"
          role="dialog"
          aria-labelledby="controls-help-title"
          aria-describedby="controls-help-desc"
          dir="rtl"
        >
          <div className="controls-help-head">
            <h2 id="controls-help-title">راهنمای حرکت</h2>
            <button ref={closeRef} type="button" className="controls-help-close" onClick={close} aria-label="بستن راهنما">
              ✕
            </button>
          </div>
          <p id="controls-help-desc" className="controls-help-desc">
            با ماوس نگاه کن و با کلیدها راه برو؛ هر زمان راهنما را با کلید <kbd>H</kbd> دوباره باز کن.
          </p>
          <ul className="controls-help-list">
            {CONTROL_HELP_ROWS.map((row) => (
              <li key={row.label}>
                <span className="controls-help-keys">
                  {row.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
                <span className="controls-help-label">{row.label}</span>
              </li>
            ))}
          </ul>
          <p className="controls-help-note">
            اگر چرخش ماوس برایت تند است، ماوس را آهسته‌تر بکش یا از کلیدهای جهت استفاده کن.
          </p>
          <div className="controls-help-actions">
            <label className="controls-help-remember">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.target.checked)}
              />
              دیگر خودکار باز نشود
            </label>
            <button type="button" className="button button-gold controls-help-accept" onClick={dismiss}>
              فهمیدم
            </button>
          </div>
        </div>
      )}
    </>
  );
}
