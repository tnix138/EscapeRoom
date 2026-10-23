'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isWellFormedSeatToken, normalizeSeatToken } from '../../contracts/seat-token-format';
import InvitationCardVideo from './InvitationCardVideo';
import { rememberSeatToken } from './seat-storage';

interface InvitationGateProps {
  code: string;
  seatToken: string;
  requestedName: string;
  requestedSeat: string;
  requestedSeatIndex: number;
}

type GateState = 'loading' | 'watching' | 'already-watched' | 'preview-complete' | 'invalid-link';

const FALLBACK_SEAT_ERROR =
  'لینک دعوت شما معتبر نیست؛ از میزبان بخواهید لینک صندلی‌تان را دوباره بفرستد.';

export default function InvitationGate({ code, seatToken, requestedName, requestedSeat, requestedSeatIndex }: InvitationGateProps) {
  const router = useRouter();
  const [state, setState] = useState<GateState>('loading');
  const [playerName, setPlayerName] = useState(requestedName || 'مهمان تماشاخانه');
  const [seatLabel, setSeatLabel] = useState(requestedSeat || 'صندلی شما');
  const [seatIndex, setSeatIndex] = useState(requestedSeatIndex);
  const [isPreview, setIsPreview] = useState(Boolean(requestedName));
  const [error, setError] = useState('');
  const [seatError, setSeatError] = useState('');
  const [sending, setSending] = useState(false);
  const primaryActionRef = useRef<HTMLAnchorElement | null>(null);
  const retryActionRef = useRef<HTMLButtonElement | null>(null);
  // آخرین درخواست برنده است؛ پاسخ درخواست کهنه وضعیت را بازنویسی نمی‌کند.
  const requestRef = useRef(0);

  // توکن از آدرس می‌آید و ممکن است هنگام کپی در چت نویسهٔ پنهان یا encode گرفته باشد.
  const token = normalizeSeatToken(seatToken);
  const tokenLooksValid = isWellFormedSeatToken(token);

  const loadSeat = useCallback(async () => {
    const requestId = (requestRef.current += 1);
    const isStale = () => requestRef.current !== requestId;
    setState('loading');
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
        headers: { 'X-Seat-Token': token },
        cache: 'no-store',
      });
      // ۴۰۱ یعنی این لینک به هیچ صندلی در اتاق نمی‌خورد؛ بازیکن باید همان‌جا بفهمد،
      // نه بعد از تماشای دعوت‌نامه و تلاش برای ورود به کوچه.
      if (response.status === 401) {
        const payload = await response.json().catch(() => null);
        if (isStale()) return;
        setSeatError(payload?.error?.message ?? FALLBACK_SEAT_ERROR);
        setState('invalid-link');
        return;
      }
      if (response.ok) {
        const payload = await response.json();
        const data = payload?.data ?? payload;
        const room = data?.roomView ?? data;
        const me = room?.me;
        if (isStale()) return;
        if (me?.playerName) setPlayerName(me.playerName);
        if (me?.seatLabel) setSeatLabel(me.seatLabel);
        if (Number.isInteger(me?.seatIndex)) setSeatIndex(me.seatIndex);
        setIsPreview(false);
        if (me?.hasWatchedInvitation) {
          setState('already-watched');
          return;
        }
      }
    } catch {
      // دعوت‌نامهٔ بصری مستقل از API هم قابل نمایش است.
    }
    if (isStale()) return;
    setState('watching');
  }, [code, token]);

  useEffect(() => {
    // قرارداد ذخیرهٔ توکن: `seat:<code>` و `orfeo:<code>:<token>` — مسیر اتاق همین‌ها را می‌خواند.
    // مقدار ذخیره‌شده نسخهٔ نرمال‌شده است تا توکن آلوده در storage ماندگار نماند.
    try {
      rememberSeatToken(code, token, [window.sessionStorage, window.localStorage]);
    } catch {
      // storage اختیاری است؛ توکن در حافظهٔ همین صفحه باقی می‌ماند.
    }
    void loadSeat();
    return () => {
      requestRef.current += 1;
    };
  }, [code, token, loadSeat]);

  // در حالت‌های پایانی، فوکوس روی اقدام اصلی می‌رود تا کاربر با کیبورد گیر نکند.
  useEffect(() => {
    const target =
      state === 'invalid-link' ? retryActionRef : state === 'already-watched' || state === 'preview-complete' ? primaryActionRef : null;
    if (!target) return undefined;
    const timer = window.setTimeout(() => target.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function completeInvitation() {
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Seat-Token': token },
        body: JSON.stringify({ type: 'COMPLETE_INVITATION_VIDEO' }),
      });
      if (response.ok) {
        router.replace(`/room/${encodeURIComponent(code)}`);
        return;
      }
      if (response.status === 401) {
        const payload = await response.json().catch(() => null);
        setSeatError(payload?.error?.message ?? FALLBACK_SEAT_ERROR);
        setState('invalid-link');
        return;
      }
      if (response.status !== 404) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? payload?.message ?? 'ورود به اتاق انجام نشد. دوباره تلاش کنید.');
      }
      setState('preview-complete');
    } catch (cause) {
      if (cause instanceof TypeError) {
        setState('preview-complete');
      } else {
        setError(cause instanceof Error ? cause.message : 'ارتباط با اتاق برقرار نشد.');
      }
    } finally {
      setSending(false);
    }
  }

  if (state === 'loading') {
    return (
      <main className="invitation-loading" aria-busy="true">
        <span className="loading-seal" aria-hidden="true">✳</span>
        <p role="status">در حال یافتن صندلی شما…</p>
        <span className="loading-line" />
      </main>
    );
  }

  if (state === 'invalid-link') {
    return (
      <main className="invitation-loading">
        <span className="loading-seal" aria-hidden="true">✕</span>
        <h1>این لینک دعوت کار نمی‌کند</h1>
        <p role="alert">{seatError || FALLBACK_SEAT_ERROR}</p>
        <p>
          کد اتاق: <strong dir="ltr">{code}</strong>
          {!tokenLooksValid && (
            <>
              {' '}
              — به‌نظر می‌رسد لینک هنگام کپی ناقص شده است؛ آن را کامل از پیام اصلی باز کنید.
            </>
          )}
        </p>
        <div className="finish-actions">
          <button
            ref={retryActionRef}
            className="invitation-primary"
            type="button"
            onClick={() => { void loadSeat(); }}
          >
            تلاش دوباره
          </button>
          <a className="invitation-secondary" href="/">
            رزرو اتاق تازه
          </a>
        </div>
      </main>
    );
  }

  if (state === 'already-watched') {
    return (
      <main className="invitation-loading">
        <span className="loading-seal" aria-hidden="true">✦</span>
        <p>این دعوت‌نامه پیش‌تر گشوده شده است.</p>
        <a
          ref={primaryActionRef}
          className="invitation-secondary"
          href={`/room/${encodeURIComponent(code)}`}
          onClick={(event) => {
            event.preventDefault();
            router.replace(`/room/${encodeURIComponent(code)}`);
          }}
        >
          بازگشت به اتاق
        </a>
      </main>
    );
  }

  if (state === 'preview-complete') {
    return (
      <main className="invitation-finish">
        <span className="finish-ornament" aria-hidden="true">✳</span>
        <p className="invitation-kicker"><span /> {playerName} · {seatLabel}</p>
        <h1>دعوت‌نامه پذیرفته شد.</h1>
        <p>
          صندلی شما در همین مرورگر ذخیره شد. با فعال‌شدن سرویس اتاق، از همین لینک مستقیم وارد کوچهٔ
          تماشاخانه می‌شوید؛ نیازی به فرستادن دوبارهٔ لینک نیست.
        </p>
        <div className="finish-actions">
          <a
            ref={primaryActionRef}
            className="invitation-primary"
            href={`/preview/alley?name=${encodeURIComponent(playerName)}&seat=${encodeURIComponent(seatLabel)}&seatIndex=${seatIndex}`}
          >
            ادامه به کوچهٔ تماشاخانه
          </a>
          <a className="invitation-secondary" href="/">بازگشت به صفحهٔ رزرو</a>
          <button className="invitation-secondary" type="button" onClick={() => { setError(''); setState('watching'); }}>
            بازپخش دعوت‌نامه
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {isPreview && <div className="preview-ribbon">حالت پیش‌نمایش · لینک دعوت نمایشی</div>}
      <InvitationCardVideo
        playerName={playerName}
        seatLabel={seatLabel}
        onComplete={() => { void completeInvitation(); }}
      />
      {sending && (
        <div className="invitation-overlay" role="status" aria-live="polite" aria-busy="true">
          <span className="loading-seal" aria-hidden="true">✳</span>
          <p>دعوت‌نامه پذیرفته شد؛ درها گشوده می‌شوند…</p>
        </div>
      )}
      {error && (
        <div className="invitation-error" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>بستن</button>
        </div>
      )}
    </>
  );
}
