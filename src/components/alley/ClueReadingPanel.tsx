'use client';

import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  CLUE_META,
  actLabel,
  clueSummary,
  hasClueContent,
  readyTicketsText,
  shouldBlockGameKey,
  toPersianNumber,
  type ClueKind,
  type PlaybillClue,
  type RowChartClue,
} from './clue-reading-data';

export interface ClueReadingPanelProps {
  kind: ClueKind;
  open: boolean;
  playbill: readonly PlaybillClue[];
  rowChart: readonly RowChartClue[];
  punchedCount: number;
  playerCount: number;
  onClose: () => void;
}

const ROW_MARKS = ['✦', '✧', '❖', '✣', '❉', '✤', '❋', '✺'];

export default function ClueReadingPanel({
  kind,
  open,
  playbill,
  rowChart,
  punchedCount,
  playerCount,
  onClose,
}: ClueReadingPanelProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const meta = CLUE_META[kind];
  const data = { playbill, rowChart, punchedCount, playerCount };

  const handleClose = useCallback(() => {
    onClose();
    const target = restoreTo.current;
    restoreTo.current = null;
    if (target) window.setTimeout(() => target.focus({ preventScroll: true }), 0);
  }, [onClose]);

  // هنگام باز شدن: ذخیرهٔ فوکوس، آزادکردن نشانگر ماوس، فوکوس روی دکمهٔ بستن
  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (document.pointerLockElement) document.exitPointerLock?.();
    const timer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Esc برای بستن + جلوگیری از رسیدن کلیدهای حرکت به کنترلر بازی
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleClose();
        return;
      }
      if (!shouldBlockGameKey(event.code)) return;
      const target = event.target;
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      event.stopPropagation();
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, handleClose]);

  // فوکوس داخل پنل بماند (بدون قفل کردن تب روی صفحهٔ سه‌بعدی)
  function onSheetKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
    );
    if (focusables.length === 0) return;
    const current = focusables.indexOf(document.activeElement as HTMLElement);
    const step = event.shiftKey ? -1 : 1;
    const next = current === -1 ? (event.shiftKey ? focusables.length - 1 : 0) : (current + step + focusables.length) % focusables.length;
    event.preventDefault();
    focusables[next]?.focus();
  }

  if (!open) return null;

  const hasContent = hasClueContent(kind, data);

  return (
    <div className="clue-reading" role="presentation">
      <button type="button" className="clue-reading-scrim" aria-label={meta.closeLabel} onClick={handleClose} tabIndex={-1} />
      <div
        ref={sheetRef}
        className={`clue-sheet clue-sheet-${kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clue-reading-title"
        aria-describedby="clue-reading-summary"
        dir="rtl"
        onKeyDown={onSheetKeyDown}
      >
        <header className="clue-sheet-head">
          <span className="clue-sheet-icon" aria-hidden="true">{meta.icon}</span>
          <div className="clue-sheet-titles">
            <span className="clue-sheet-kicker">{meta.kicker}</span>
            <h2 id="clue-reading-title">{meta.title}</h2>
          </div>
          <button ref={closeRef} type="button" className="clue-sheet-close" onClick={handleClose} aria-label={meta.closeLabel}>
            ✕
          </button>
        </header>

        <p id="clue-reading-summary" className="clue-sheet-lede">
          {meta.lede}
        </p>

        {kind === 'playbill' && (
          <ol className="clue-acts">
            {playbill.map((act, index) => (
              <li className="clue-act" key={`${act.actNumber}-${act.sceneTitle}`}>
                <span className="clue-act-number" aria-hidden="true">{toPersianNumber(act.actNumber)}</span>
                <div className="clue-act-body">
                  <p className="clue-act-label">{actLabel(act.actNumber)}</p>
                  <h3 className="clue-act-title">{act.sceneTitle}</h3>
                  <p className="clue-act-description">{act.description}</p>
                </div>
                <span className="clue-act-mark" aria-hidden="true">{ROW_MARKS[index % ROW_MARKS.length]}</span>
              </li>
            ))}
          </ol>
        )}

        {kind === 'rowChart' && (
          <table className="clue-rows">
            <caption className="clue-rows-caption">{meta.foot}</caption>
            <thead>
              <tr>
                <th scope="col">ردیف صندلی</th>
                <th scope="col">کد ورود</th>
              </tr>
            </thead>
            <tbody>
              {rowChart.map((row, index) => (
                <tr className="clue-row" key={row.romanCode}>
                  <th scope="row">{row.rowTitle}</th>
                  <td>
                    <strong dir="ltr">{row.romanCode}</strong>
                    <span className="clue-row-mark" aria-hidden="true">{ROW_MARKS[index % ROW_MARKS.length]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!hasContent && <p className="clue-sheet-empty">{meta.emptyText}</p>}

        <p className="sr-only" aria-live="polite">
          {clueSummary(kind, data)}
        </p>

        <footer className="clue-sheet-foot">
          <span className="clue-sheet-progress">{readyTicketsText(data)}</span>
          <span className="clue-sheet-hint">
            <kbd>Esc</kbd> برای بازگشت به کوچه
          </span>
        </footer>
      </div>
    </div>
  );
}
