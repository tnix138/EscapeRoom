'use client';

import { FormEvent, useMemo, useState } from 'react';
import InviteLinksDeck, { HostReservationResult } from './InviteLinksDeck';
import { validateGuestNames } from './validation';

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const SAMPLE_NAMES = ['توحید', 'امیرعلی', 'علیرضا', 'سارا', 'آرمان', 'نورا', 'مانی', 'رها'];

function createPreviewReservation(names: string[]): HostReservationResult {
  const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    roomCode,
    playerCount: names.length,
    invites: names.map((playerName, seatIndex) => {
      const seatToken = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replaceAll('-', '')
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      return {
        seatIndex,
        playerName,
        seatLabel: `صندلی ${String(seatIndex + 1).padStart(2, '۰')}`,
        seatToken,
        invitePath: `/invite/${roomCode}/${seatToken}?name=${encodeURIComponent(playerName)}&seat=${encodeURIComponent(`صندلی ${String(seatIndex + 1).padStart(2, '۰')}`)}&seatIndex=${seatIndex}`,
      };
    }),
  };
}

export default function ReservationForm() {
  const [playerCount, setPlayerCount] = useState(3);
  const [names, setNames] = useState<string[]>(SAMPLE_NAMES.slice(0, 3));
  const [reservation, setReservation] = useState<HostReservationResult | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameError = useMemo(() => validateGuestNames(names), [names]);

  function changeCount(count: number) {
    setPlayerCount(count);
    setNames((previous) => Array.from({ length: count }, (_, index) => previous[index] ?? ''));
    setError('');
  }

  function fillSampleNames() {
    setNames(SAMPLE_NAMES.slice(0, playerCount));
    setError('');
  }

  function updateName(index: number, value: string) {
    setNames((previous) => previous.map((name, current) => current === index ? value : name));
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameError) {
      setError(nameError);
      return;
    }
    setError('');
    setIsSubmitting(true);
    const cleanNames = names.map((name) => name.trim().replace(/\s+/g, ' '));
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
        // Wave-one visual preview until Toheed's reservation API is merged.
        setReservation(createPreviewReservation(cleanNames));
        setIsDemo(true);
      } else {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? payload?.message ?? 'رزرو اتاق انجام نشد. کمی بعد دوباره تلاش کنید.');
      }
    } catch (cause) {
      if (cause instanceof TypeError) {
        // Keep the first-wave UI independently previewable before the API exists.
        setReservation(createPreviewReservation(cleanNames));
        setIsDemo(true);
      } else {
        setError(cause instanceof Error ? cause.message : 'خطایی پیش آمد. دوباره تلاش کنید.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (reservation) {
    return <InviteLinksDeck reservation={reservation} isDemo={isDemo} onReset={() => { setReservation(null); setIsDemo(false); setError(''); }} />;
  }

  return (
    <div className="reservation-layout">
      <form className="reservation-form" onSubmit={submit} noValidate>
        <div className="form-topline"><span>ترکیب گروه</span><span className="count-label">{playerCount.toLocaleString('fa')} <small>نفر</small></span></div>
        <fieldset className="count-picker" aria-label="تعداد مهمان‌ها">
          <legend className="sr-only">تعداد بازیکنان را انتخاب کنید</legend>
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, offset) => MIN_PLAYERS + offset).map((count) => (
            <button key={count} type="button" className={`count-option ${playerCount === count ? 'selected' : ''}`} onClick={() => changeCount(count)} aria-pressed={playerCount === count}>
              <span>{count.toLocaleString('fa')}</span><small>نفر</small>
            </button>
          ))}
        </fieldset>

        <div className="guest-heading">
          <div><span className="gold-rule" /><h3>نام هم‌سفرها</h3></div>
          <button type="button" className="sample-button" onClick={fillSampleNames}>پر کردن نمونه</button>
        </div>
        <div className="guest-grid">
          {names.map((name, index) => (
            <label className="guest-field" key={index}>
              <span className="guest-seat">صندلی {String(index + 1).padStart(2, '۰')}</span>
              <span className="input-wrap"><span className="guest-icon" aria-hidden="true">♙</span><input value={name} onChange={(event) => updateName(index, event.target.value)} maxLength={32} placeholder={`نام مهمان ${(index + 1).toLocaleString('fa')}`} autoComplete="off" /></span>
            </label>
          ))}
        </div>
        {error && <p className="form-error" role="alert"><span>!</span>{error}</p>}
        <div className="form-bottom">
          <p><span>✦</span> لینک هر صندلی منحصربه‌فرد است؛ نام‌ها را دقیق وارد کنید.</p>
          <button className="button button-gold reserve-button" type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'در حال آماده‌سازی…' : 'رزرو و ساخت دعوت‌نامه‌ها'}</span><span className="button-arrow" aria-hidden="true">←</span>
          </button>
        </div>
      </form>

      <aside className="reservation-aside">
        <div className="aside-ornament">❧</div>
        <p className="eyebrow">پیش از رزرو</p>
        <h3>هیچ‌کس تماشاگرِ تنها نیست.</h3>
        <p>هر بازیکن سرنخی منحصربه‌فرد در دست دارد. برای گشودن درِ تماشاخانه، به همهٔ دوستانتان نیاز خواهید داشت.</p>
        <div className="aside-divider"><span>✳</span></div>
        <ul><li><span>۰۱</span> نام مهمان‌ها را ثبت کنید</li><li><span>۰۲</span> دعوت‌نامه‌ها را بفرستید</li><li><span>۰۳</span> کنار هم، پرده را بالا ببرید</li></ul>
        <span className="aside-footnote">یک تجربهٔ بهتر با هدفون</span>
      </aside>
    </div>
  );
}
