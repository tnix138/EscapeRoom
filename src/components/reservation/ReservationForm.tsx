'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import InviteLinksDeck, { HostReservationResult } from './InviteLinksDeck';
import {
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  guestCountLabel,
  normalizeGuestName,
  seatLabelForIndex,
  toPersianDigits,
  validateReservation,
} from './reservation-rules';

const SAMPLE_NAMES = ['توحید', 'امیرعلی', 'علیرضا', 'سارا', 'آرمان', 'نورا', 'مانی', 'رها'];
const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, offset) => MIN_PLAYERS + offset);

function createPreviewReservation(names: string[]): HostReservationResult {
  const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    roomCode,
    playerCount: names.length,
    invites: names.map((playerName, seatIndex) => {
      const seatToken = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replaceAll('-', '')
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const seatLabel = seatLabelForIndex(seatIndex);
      return {
        seatIndex,
        playerName,
        seatLabel,
        seatToken,
        invitePath: `/invite/${roomCode}/${seatToken}?name=${encodeURIComponent(playerName)}&seat=${encodeURIComponent(seatLabel)}&seatIndex=${seatIndex}`,
      };
    }),
  };
}

export default function ReservationForm() {
  const [playerCount, setPlayerCount] = useState(MIN_PLAYERS);
  const [names, setNames] = useState<string[]>(SAMPLE_NAMES.slice(0, MIN_PLAYERS));
  const [reservation, setReservation] = useState<HostReservationResult | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const countRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const validation = useMemo(() => validateReservation(names), [names]);
  const showErrors = submitAttempted && !validation.ok;
  const visibleMessage = serverError || (showErrors ? validation.message : null);

  function changeCount(count: number) {
    setPlayerCount(count);
    setNames((previous) => Array.from({ length: count }, (_, index) => previous[index] ?? ''));
    setServerError('');
  }

  function moveCount(count: number, delta: number) {
    const next = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count + delta));
    if (next === count) return;
    changeCount(next);
    countRefs.current[next]?.focus();
  }

  function onCountKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, count: number) {
    // در RTL، چپ به عدد بزرگ‌تر و راست به عدد کوچک‌تر می‌رود.
    const delta =
      event.key === 'ArrowLeft' ? 1
        : event.key === 'ArrowRight' ? -1
          : event.key === 'ArrowUp' ? 1
            : event.key === 'ArrowDown' ? -1
              : 0;
    if (!delta) return;
    event.preventDefault();
    moveCount(count, delta);
  }

  function fillSampleNames() {
    setNames(SAMPLE_NAMES.slice(0, playerCount));
    setServerError('');
  }

  function updateName(index: number, value: string) {
    setNames((previous) => previous.map((name, current) => current === index ? value : name));
    setServerError('');
  }

  function focusFirstProblem() {
    if (validation.countError) {
      countRefs.current[playerCount]?.focus();
      return;
    }
    const index = validation.firstInvalidField;
    if (index !== null) inputRefs.current[index]?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setServerError('');
    if (!validation.ok) {
      focusFirstProblem();
      return;
    }

    setIsSubmitting(true);
    const cleanNames = names.map((name) => normalizeGuestName(name));
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount, playerNames: cleanNames }),
      });
      if (response.ok) {
        const payload = await response.json();
        const data = payload?.data ?? payload;
        if (!data?.roomCode || !Array.isArray(data?.invites)) throw new Error('پاسخ سرویس رزرو معتبر نیست.');
        setReservation(data as HostReservationResult);
        setIsDemo(false);
      } else if (response.status === 404) {
        // پیش‌نمایش بصری تا وقتی سرویس رزرو در دسترس نیست.
        setReservation(createPreviewReservation(cleanNames));
        setIsDemo(true);
      } else {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? payload?.message ?? 'رزرو اتاق انجام نشد. کمی بعد دوباره تلاش کنید.');
      }
    } catch (cause) {
      if (cause instanceof TypeError) {
        // شبکه در دسترس نیست؛ پیش‌نمایش باید کار کند.
        setReservation(createPreviewReservation(cleanNames));
        setIsDemo(true);
      } else {
        setServerError(cause instanceof Error ? cause.message : 'خطایی پیش آمد. دوباره تلاش کنید.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (reservation) {
    return (
      <InviteLinksDeck
        reservation={reservation}
        isDemo={isDemo}
        onReset={() => {
          setReservation(null);
          setIsDemo(false);
          setServerError('');
          setSubmitAttempted(false);
        }}
      />
    );
  }

  return (
    <div className="reservation-layout">
      <form
        className="reservation-form"
        onSubmit={submit}
        noValidate
        aria-busy={isSubmitting}
      >
        <div className="form-topline">
          <span>ترکیب گروه</span>
          <span className="count-label">{toPersianDigits(playerCount)} <small>نفر</small></span>
        </div>

        <fieldset className="count-picker" aria-describedby={showErrors && validation.countError ? 'count-error' : undefined}>
          <legend className="sr-only">تعداد بازیکنان را انتخاب کنید؛ بین ۳ تا ۸ نفر</legend>
          {COUNTS.map((count) => (
            <button
              key={count}
              ref={(node) => { countRefs.current[count] = node; }}
              type="button"
              className={`count-option ${playerCount === count ? 'selected' : ''}`}
              onClick={() => changeCount(count)}
              onKeyDown={(event) => onCountKeyDown(event, count)}
              aria-pressed={playerCount === count}
              aria-label={`${toPersianDigits(count)} نفر`}
            >
              <span>{toPersianDigits(count)}</span><small>نفر</small>
            </button>
          ))}
        </fieldset>
        {showErrors && validation.countError && (
          <p className="field-error" id="count-error" role="alert">{validation.countError}</p>
        )}

        <div className="guest-heading">
          <div><span className="gold-rule" /><h3>نام هم‌سفرها</h3></div>
          <button type="button" className="sample-button" onClick={fillSampleNames}>پر کردن نمونه</button>
        </div>

        <div className="guest-grid">
          {names.map((name, index) => {
            const fieldError = showErrors ? validation.fieldErrors[index] : null;
            const errorId = `guest-error-${index}`;
            const label = seatLabelForIndex(index);
            return (
              <div className={`guest-field ${fieldError ? 'has-error' : ''}`} key={index}>
                <label className="guest-seat" htmlFor={`guest-name-${index}`}>{label}</label>
                <span className="input-wrap">
                  <span className="guest-icon" aria-hidden="true">♙</span>
                  <input
                    id={`guest-name-${index}`}
                    ref={(node) => { inputRefs.current[index] = node; }}
                    value={name}
                    onChange={(event) => updateName(index, event.target.value)}
                    maxLength={MAX_NAME_LENGTH}
                    placeholder={`نام مهمان ${toPersianDigits(index + 1)}`}
                    autoComplete="off"
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? errorId : undefined}
                  />
                </span>
                {fieldError && <span className="field-error" id={errorId}>{fieldError}</span>}
              </div>
            );
          })}
        </div>

        <p className="guest-count-note" aria-live="polite">
          {guestCountLabel(names.length)} انتخاب شده؛ لینک هر صندلی منحصربه‌فرد است.
        </p>

        {visibleMessage && (
          <p className="form-error" role="alert"><span aria-hidden="true">!</span>{visibleMessage}</p>
        )}

        <div className="form-bottom">
          <p><span aria-hidden="true">✦</span> نام‌ها را دقیق وارد کنید؛ هر مهمان لینک اختصاصی خودش را می‌گیرد.</p>
          <button className="button button-gold reserve-button" type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'در حال آماده‌سازی…' : 'رزرو و ساخت دعوت‌نامه‌ها'}</span>
            <span className="button-arrow" aria-hidden="true">←</span>
          </button>
        </div>
      </form>

      <aside className="reservation-aside">
        <div className="aside-ornament">❧</div>
        <p className="eyebrow">پیش از رزرو</p>
        <h3>هیچ‌کس تماشاگرِ تنها نیست.</h3>
        <p>هر بازیکن سرنخی منحصربه‌فرد در دست دارد. برای گشودن درِ تماشاخانه، به همهٔ دوستانتان نیاز خواهید داشت.</p>
        <div className="aside-divider"><span>✳</span></div>
        <ul>
          <li><span>۰۱</span> نام مهمان‌ها را ثبت کنید</li>
          <li><span>۰۲</span> دعوت‌نامه‌ها را بفرستید</li>
          <li><span>۰۳</span> کنار هم، پرده را بالا ببرید</li>
        </ul>
        <span className="aside-footnote">یک تجربهٔ بهتر با هدفون</span>
      </aside>
    </div>
  );
}
