'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AlleyRoomView } from './contracts';
import {
  KEYPAD_KEYS,
  describeDigitProgress,
  describeTeamReadiness,
  doorCodeProgress,
  keypadKeyLabel,
  sanitizeDoorCode,
  teamTicketSummary,
  toPersianNumber,
} from './puzzle-rules';

interface TheaterDoorLockModalProps {
  room: AlleyRoomView;
  open: boolean;
  onClose: () => void;
  onUnlock: (code: string) => Promise<{ accepted: boolean; message: string }>;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function TheaterDoorLockModal({ room, open, onClose, onUnlock }: TheaterDoorLockModalProps) {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [opened, setOpened] = useState(false);
  const modalRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const successRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const required = Math.min(8, Math.max(1, room.alley.doorLockState.requiredCount || room.playerCount || 1));
  const progress = doorCodeProgress(code, required);
  const team = teamTicketSummary(room.players, room.playerCount);
  const teamMessage = describeTeamReadiness(team);
  const attempts = room.alley.doorLockState.attempts;

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previouslyFocused = openerRef.current;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    const lastFeedback = room.alley.doorLockState.lastAttemptFeedback;
    if (lastFeedback) {
      setFeedback(lastFeedback);
      setFeedbackKind('error');
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
    // فقط با باز/بسته شدن مودال؛ feedback سرور نباید فوکوس را از نو بگیرد.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCode('');
      setFeedback('');
      setFeedbackKind('neutral');
      setOpened(false);
      setIsSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (opened) successRef.current?.focus({ preventScroll: true });
  }, [opened]);

  if (!open) return null;

  function setDigits(next: string) {
    setCode(sanitizeDoorCode(next, required));
    setFeedback('');
    setFeedbackKind('neutral');
  }

  function addDigit(digit: string) {
    if (opened) return;
    setDigits(progress.code + digit);
  }

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (opened || isSubmitting) return;
    if (!progress.complete) {
      setFeedback(`قفل ${toPersianNumber(required)} رقم می‌خواهد؛ هنوز ${toPersianNumber(required - progress.filled)} رقم مانده است.`);
      setFeedbackKind('error');
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    setIsSubmitting(true);
    setFeedback('');
    setFeedbackKind('neutral');
    try {
      const result = await onUnlock(progress.code);
      setFeedback(result.message);
      setFeedbackKind(result.accepted ? 'success' : 'error');
      setOpened(result.accepted);
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'قفل تکان نخورد. دوباره امتحان کنید.');
      setFeedbackKind('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const descriptionId = 'door-lock-desc';
  const statusId = 'door-lock-status';
  const feedbackId = 'door-lock-feedback';

  return (
    <div
      className="door-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={modalRef}
        className={`door-modal ${opened ? 'door-opened' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="door-lock-title"
        aria-describedby={`${descriptionId} ${statusId}`}
      >
        <button className="door-modal-close" type="button" onClick={onClose} aria-label="بستن قفل">×</button>
        <div className="lock-emblem" aria-hidden="true">{opened ? '✧' : '✣'}</div>
        <p className="eyebrow">تماشاخانهٔ اُرفه‌ئو</p>
        <h2 id="door-lock-title">{opened ? 'پرده بالا می‌رود…' : 'قفلِ گیشه'}</h2>
        <p className="door-modal-desc" id={descriptionId}>
          {opened
            ? 'چفتِ برنجی با صدایی عمیق آزاد شد؛ درِ ورودی برای همهٔ هم‌تیمی‌ها باز است.'
            : 'ارقام طلاییِ هر بلیط را به ترتیب شمارهٔ صندلی کنار هم بگذارید و روی قفل وارد کنید.'}
        </p>

        {!opened && (
          <div className="lock-team-status">
            <div className="lock-status-caption">
              <span>وضعیت بلیط‌ها</span>
              <strong>{toPersianNumber(team.punched)} از {toPersianNumber(team.total)}</strong>
            </div>
            <div className="lock-status-lights" role="list" aria-label="وضعیت پانچ بلیط هم‌تیمی‌ها">
              {room.players.slice(0, Math.max(required, team.total)).map((player) => (
                <div
                  className={`lock-seat-light ${player.ticketPunched ? 'light-ready' : ''}`}
                  key={player.playerId}
                  role="listitem"
                  aria-label={`${player.playerName}: ${player.ticketPunched ? 'بلیط پانچ شده' : 'در انتظار پانچ'}`}
                >
                  <i aria-hidden="true" />
                  <span>{player.playerName}</span>
                  <b aria-hidden="true">{player.ticketPunched ? '✓' : '•'}</b>
                </div>
              ))}
            </div>
            <p className={`lock-team-message ${team.allReady ? 'is-ready' : ''}`}>{teamMessage}</p>
          </div>
        )}

        {!opened && (
          <form onSubmit={submit}>
            <label className="code-display-label" htmlFor="theater-door-code">
              رمز ورود · {toPersianNumber(required)} رقم
            </label>
            <div className="lock-slots" aria-hidden="true">
              {progress.slots.map((filled, index) => (
                <span className={`lock-slot ${filled ? 'is-filled' : ''}`} key={index}>
                  {filled ? toPersianNumber(progress.code[index]) : '·'}
                </span>
              ))}
            </div>
            <div className="code-display-row">
              <input
                ref={inputRef}
                id="theater-door-code"
                dir="ltr"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                enterKeyHint="go"
                value={progress.code}
                onChange={(event) => setDigits(event.target.value)}
                aria-describedby={`${statusId} ${feedbackId}`}
                aria-invalid={feedbackKind === 'error' ? true : undefined}
                maxLength={required}
                placeholder={'·'.repeat(required)}
                aria-label={`کد ${toPersianNumber(required)} رقمی قفل تماشاخانه`}
              />
              <button
                className="code-backspace"
                type="button"
                onClick={() => setDigits(progress.code.slice(0, -1))}
                aria-label="حذف رقم آخر"
                disabled={progress.filled === 0}
              >
                ⌫
              </button>
            </div>
            <p className={`lock-progress ${progress.complete ? 'is-complete' : ''}`} id={statusId} aria-live="polite">
              {describeDigitProgress(progress)}
            </p>

            <div className="brass-keypad" role="group" aria-label="صفحه‌کلید ارقام قفل">
              {KEYPAD_KEYS.map((key) => {
                if (key === 'clear') {
                  return (
                    <button className="keypad-util" type="button" key={key} onClick={() => setDigits('')} aria-label={keypadKeyLabel(key)}>
                      پاک
                    </button>
                  );
                }
                if (key === 'delete') {
                  return (
                    <button className="keypad-util" type="button" key={key} onClick={() => setDigits(progress.code.slice(0, -1))} aria-label={keypadKeyLabel(key)}>
                      ⌫
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => addDigit(key)}
                    aria-label={keypadKeyLabel(key)}
                    disabled={progress.complete}
                  >
                    {toPersianNumber(key)}
                  </button>
                );
              })}
            </div>

            <p className={`door-feedback ${feedbackKind === 'success' ? 'feedback-success' : ''} ${feedbackKind === 'error' ? 'feedback-error' : ''}`} id={feedbackId} role="status" aria-live="polite">
              {feedback}
            </p>

            <button className="unlock-button" type="submit" disabled={isSubmitting || !progress.complete}>
              {isSubmitting ? 'در حال چرخاندن قفل…' : 'چرخاندن قفل'}
              <span aria-hidden="true">⟲</span>
            </button>
          </form>
        )}

        {opened && (
          <div className="door-success-actions">
            <p role="status">{feedback || 'درِ ورودی برای همهٔ بازیکنان باز شد.'}</p>
            <button ref={successRef} type="button" onClick={onClose}>ادامهٔ بازی <span aria-hidden="true">←</span></button>
          </div>
        )}
        <p className="lock-attempts">تلاش‌های ناموفق این اتاق: {toPersianNumber(attempts)}</p>
      </section>
    </div>
  );
}
