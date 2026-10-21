'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InvitationCardVideo from './InvitationCardVideo';

interface InvitationGateProps {
  code: string;
  seatToken: string;
  requestedName: string;
  requestedSeat: string;
  requestedSeatIndex: number;
}

type GateState = 'loading' | 'watching' | 'already-watched' | 'preview-complete';

export default function InvitationGate({ code, seatToken, requestedName, requestedSeat, requestedSeatIndex }: InvitationGateProps) {
  const router = useRouter();
  const [state, setState] = useState<GateState>('loading');
  const [playerName, setPlayerName] = useState(requestedName || 'مهمان تماشاخانه');
  const [seatLabel, setSeatLabel] = useState(requestedSeat || 'صندلی شما');
  const [seatIndex, setSeatIndex] = useState(requestedSeatIndex);
  const [isPreview, setIsPreview] = useState(Boolean(requestedName));
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      // The room route reads a per-tab token so separate invitees can share this browser.
      sessionStorage.setItem(`seat:${code}`, seatToken);
      sessionStorage.setItem(`orfeo:${code}:${seatToken}`, seatToken);
      localStorage.setItem(`orfeo:${code}:${seatToken}`, seatToken);
    } catch {
      // Storage is a convenience; the current invitation still has its token in memory.
    }

    async function loadSeat() {
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
          headers: { 'X-Seat-Token': seatToken },
          cache: 'no-store',
        });
        if (response.ok) {
          const payload = await response.json();
          const data = payload?.data ?? payload;
          const room = data?.roomView ?? data;
          const me = room?.me;
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
        // The visual invitation can run independently before the room API is available.
      }
      if (!cancelled) setState('watching');
    }
    void loadSeat();
    return () => { cancelled = true; };
  }, [code, seatToken]);

  async function completeInvitation() {
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Seat-Token': seatToken },
        body: JSON.stringify({ type: 'COMPLETE_INVITATION_VIDEO' }),
      });
      if (response.ok) {
        router.replace(`/room/${encodeURIComponent(code)}`);
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
    return <main className="invitation-loading"><span className="loading-seal">✳</span><p>در حال یافتن صندلی شما…</p><span className="loading-line" /></main>;
  }

  if (state === 'already-watched') {
    return <main className="invitation-loading"><span className="loading-seal">✦</span><p>این دعوت‌نامه پیش‌تر گشوده شده است.</p><button className="invitation-secondary" onClick={() => router.replace(`/room/${encodeURIComponent(code)}`)}>بازگشت به اتاق</button></main>;
  }

  if (state === 'preview-complete') {
    return <main className="invitation-finish"><span className="finish-ornament">✳</span><p className="invitation-kicker"><span /> {playerName} · {seatLabel}</p><h1>دعوت‌نامه پذیرفته شد.</h1><p>پیش‌درآمد شما به پایان رسید. وقتی سرویس اتاق فعال شود، از همین لینک وارد کوچهٔ تماشاخانه می‌شوید.</p><div className="finish-actions"><a className="invitation-primary" href={`/preview/alley?name=${encodeURIComponent(playerName)}&seat=${encodeURIComponent(seatLabel)}&seatIndex=${seatIndex}`}>ادامه به کوچهٔ تماشاخانه</a><a className="invitation-secondary" href="/">بازگشت به صفحهٔ رزرو</a><button className="invitation-secondary" onClick={() => { setError(''); setState('watching'); }}>بازپخش دعوت‌نامه</button></div></main>;
  }

  return <>
    {isPreview && <div className="preview-ribbon">حالت پیش‌نمایش · لینک دعوت نمایشی</div>}
    <InvitationCardVideo playerName={playerName} seatLabel={seatLabel} onComplete={() => { void completeInvitation(); }} />
    {sending && <div className="invitation-overlay"><span className="loading-seal">✳</span><p>دعوت‌نامه پذیرفته شد؛ درها گشوده می‌شوند…</p></div>}
    {error && <div className="invitation-error" role="alert">{error}<button onClick={() => setError('')}>بستن</button></div>}
  </>;
}
