'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { announcePanelOpen, onOtherPanelOpen } from './panel-focus';
import {
  buildExplorationState,
  compactSummary,
  describeNote,
  describeProgress,
  type ExplorationInput,
  type ExplorationState,
  type TrailState,
} from './exploration-hud';

export interface ExplorationHudProps {
  input: ExplorationInput;
  /** باز کردن پنل گفتگوی گروهی (اختیاری). */
  onOpenChat?: () => void;
  /** پنل در شروع باز باشد؛ پیش‌فرض بسته تا دید صحنه باز بماند. */
  defaultOpen?: boolean;
  className?: string;
}

type HudMode = 'collapsed' | 'open' | 'hidden';

const TRAIL_MARK: Record<TrailState, string> = {
  done: '✓',
  current: '◈',
  pending: '○',
};

/**
 * HUD کاوش — اهداف، یادداشت‌های بررسی، مسیر بازیکن و میان‌بر گفتگو.
 *
 * - پیش‌فرض بسته است و هیچ بخشی از مرکز صحنه را نمی‌پوشاند؛ با «پنهان کردن» به یک
 *   دکمهٔ کوچک تبدیل می‌شود تا دید کاملاً آزاد بماند.
 * - وضعیت هر هدف و هر یادداشت با **متن** هم بیان می‌شود (نه فقط رنگ/آیکن).
 * - همهٔ متن‌ها ≥۱۴px و هدف لمسی ≥۴۴px؛ بدون نیاز به زوم.
 * - هیچ داده‌ای واکشی نمی‌کند و پاسخ معمایی نشان نمی‌دهد.
 */
export default function ExplorationHud({ input, onOpenChat, defaultOpen = false, className }: ExplorationHudProps) {
  const [mode, setMode] = useState<HudMode>(defaultOpen ? 'open' : 'collapsed');
  const [announcement, setAnnouncement] = useState('');
  const state: ExplorationState = buildExplorationState(input);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const previousProgress = useRef(state.progress.label);

  // تغییر پیشرفت یا تغییر هدف را یک بار اعلام می‌کنیم؛ نه در هر رندر.
  useEffect(() => {
    if (state.progress.label === previousProgress.current) return;
    previousProgress.current = state.progress.label;
    setAnnouncement(describeProgress(state));
  }, [state]);

  // Esc پنل را می‌بندد و فوکوس را به دکمهٔ اصلی برمی‌گرداند.
  useEffect(() => {
    if (mode !== 'open') return undefined;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMode('collapsed');
      window.setTimeout(() => toggleRef.current?.focus({ preventScroll: true }), 0);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  // باز شدن پنل دیگر (نجوا/همراه) این پنل را جمع می‌کند تا روی صحنه نیفتد.
  useEffect(() => onOtherPanelOpen('exploration', () => setMode((value) => (value === 'open' ? 'collapsed' : value))), []);

  const togglePanel = useCallback(() => {
    setMode((value) => {
      if (value === 'open') return 'collapsed';
      announcePanelOpen('exploration');
      return 'open';
    });
  }, []);

  if (!state.visible) return null;

  if (mode === 'hidden') {
    return (
      <div className={`exploration-hud is-hidden ${className ?? ''}`.trim()}>
        <button
          className="exploration-restore"
          type="button"
          onClick={() => setMode('collapsed')}
          aria-label={`نمایش اهداف کاوش — ${state.progress.label} کامل شده`}
          title="نمایش اهداف کاوش"
        >
          <span aria-hidden="true">◈</span>
          <span className="exploration-restore-count">{compactSummary(state)}</span>
        </button>
        {announcement && <p className="sr-only" role="status" aria-live="polite">{announcement}</p>}
      </div>
    );
  }

  const isOpen = mode === 'open';

  return (
    <div className={`exploration-hud ${isOpen ? 'is-open' : ''} ${className ?? ''}`.trim()}>
      <button
        ref={toggleRef}
        className="exploration-toggle"
        type="button"
        onClick={togglePanel}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="exploration-toggle-mark" aria-hidden="true">◈</span>
        <span className="exploration-toggle-text">
          <strong>{state.allTasksDone ? 'همهٔ اهداف کامل شد' : state.title}</strong>
          <small>{state.chapterLabel} · {state.progress.label}</small>
        </span>
        <span className="exploration-toggle-progress" aria-hidden="true">{compactSummary(state)}</span>
        <span className={`exploration-toggle-chevron ${isOpen ? 'turned' : ''}`} aria-hidden="true">⌃</span>
      </button>

      {/* پنل همیشه در DOM است تا aria-controls همیشه به یک مقصد معتبر اشاره کند. */}
      <div className="exploration-panel" id={panelId} hidden={!isOpen}>
        <div className="exploration-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.progress.percent} aria-label={`پیشرفت کاوش: ${state.progress.label}`}>
          <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, state.progress.percent / 100))})` }} />
        </div>

        <p className="exploration-position">
          <span aria-hidden="true">◎</span>
          <span>{state.positionLabel}</span>
        </p>

        <section className="exploration-section" aria-labelledby={`${panelId}-objectives`}>
          <h3 id={`${panelId}-objectives`}>
            اهداف <span className="exploration-count">{state.progress.label}</span>
          </h3>
          <ul className="exploration-objectives">
            {state.objectives.map((objective) => (
              <li
                key={objective.id}
                className={`exploration-objective ${objective.done ? 'is-done' : ''} ${objective.countsForProgress ? '' : 'is-lead'}`}
              >
                <span className="objective-mark" aria-hidden="true">{objective.done ? '✓' : objective.countsForProgress ? '○' : '✦'}</span>
                <span className="objective-body">
                  <strong>{objective.label}</strong>
                  <small>{objective.detail}</small>
                  {objective.hint && <em>{objective.hint}</em>}
                </span>
                <span className="objective-state">{objective.done ? 'کامل' : objective.countsForProgress ? 'باز' : 'سرنخ'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="exploration-section" aria-labelledby={`${panelId}-notes`}>
          <h3 id={`${panelId}-notes`}>یادداشت‌های بررسی</h3>
          <ul className="exploration-notes">
            {state.notes.map((note) => (
              <li key={note.id} className={`exploration-note ${note.inspected ? 'is-inspected' : ''}`} aria-label={describeNote(note)}>
                <span className="note-mark" aria-hidden="true">{note.inspected ? '✓' : '·'}</span>
                <span className="note-body">
                  <strong>{note.title}</strong>
                  <small>{note.hint}</small>
                </span>
                <span className="note-state">{note.statusLabel}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="exploration-section" aria-labelledby={`${panelId}-trail`}>
          <h3 id={`${panelId}-trail`}>مسیر شما</h3>
          <ol className="exploration-trail">
            {state.trail.map((step) => (
              <li key={step.id} className={`trail-step is-${step.state}`}>
                <span className="trail-mark" aria-hidden="true">{TRAIL_MARK[step.state]}</span>
                <span className="trail-label">{step.label}</span>
                <span className="trail-state">{step.state === 'done' ? 'انجام شد' : step.state === 'current' ? 'اینجا' : 'بعد'}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="exploration-chat" aria-labelledby={`${panelId}-chat`}>
          <h3 id={`${panelId}-chat`}>گفتگوی گروهی</h3>
          {state.chat.hasMessages ? (
            <p className="exploration-chat-last">
              <strong>{state.chat.lastSender}</strong>
              <span>{state.chat.lastText}</span>
              <small>{state.chat.total.toLocaleString('fa')} پیام</small>
            </p>
          ) : (
            <p className="exploration-chat-empty">هنوز گفتگویی شروع نشده است.</p>
          )}
          {onOpenChat && (
            <button className="exploration-chat-button" type="button" onClick={onOpenChat}>
              باز کردن گفتگوی گروهی
            </button>
          )}
        </section>

        <button className="exploration-hide" type="button" onClick={() => setMode('hidden')}>
          پنهان کردن برای دید بهتر صحنه
        </button>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}
