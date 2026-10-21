'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AlleyRoomView } from './contracts';
import { normalizeDoorCode } from './puzzle';

interface TheaterDoorLockModalProps {
  room: AlleyRoomView;
  open: boolean;
  onClose: () => void;
  onUnlock: (code: string) => Promise<{ accepted: boolean; message: string }>;
}

export default function TheaterDoorLockModal({ room, open, onClose, onUnlock }: TheaterDoorLockModalProps) {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [opened, setOpened] = useState(false);
  const needed = room.alley.doorLockState.requiredCount || room.playerCount;

  useEffect(() => {
    if (!open) {
      setCode('');
      setFeedback('');
      setOpened(false);
    }
  }, [open]);

  if (!open) return null;

  function addDigit(digit: string) {
    setCode((current) => (normalizeDoorCode(current).length < needed ? current + digit : current));
    setFeedback('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = normalizeDoorCode(code);
    if (normalizedCode.length !== needed) {
      setFeedback(`قفل ${needed.toLocaleString('fa')} رقم می‌خواهد.`);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await onUnlock(normalizedCode);
      setFeedback(result.message);
      setOpened(result.accepted);
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'قفل تکان نخورد. دوباره امتحان کنید.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="door-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`door-modal ${opened ? 'door-opened' : ''}`} role="dialog" aria-modal="true" aria-labelledby="door-lock-title">
        <button className="door-modal-close" type="button" onClick={onClose} aria-label="بستن قفل">×</button>
        <div className="lock-emblem">{opened ? '✧' : '✣'}</div>
        <p className="eyebrow">تماشاخانهٔ اُرفه‌ئو</p>
        <h2 id="door-lock-title">{opened ? 'پرده بالا می‌رود…' : 'قفلِ گیشه'}</h2>
        <p className="door-modal-desc">{opened ? 'چفتِ برنجی با صدایی عمیق آزاد شد.' : 'ارقام طلاییِ نمایان‌شده روی خط برش بلیط‌ها را به ترتیب صندلی وارد کنید.'}</p>

        <div className="lock-team-status">
          <div className="lock-status-caption"><span>وضعیت بلیط‌ها</span><strong>{room.players.filter((player) => player.ticketPunched).length.toLocaleString('fa')} از {needed.toLocaleString('fa')}</strong></div>
          <div className="lock-status-lights">
            {room.players.slice(0, needed).map((player) => <div className={`lock-seat-light ${player.ticketPunched ? 'light-ready' : ''}`} key={player.playerId}><i /><span>{player.playerName}</span></div>)}
          </div>
        </div>

        {!opened && <form onSubmit={submit}>
          <label className="code-display-label" htmlFor="theater-door-code">رمز ورود · {needed.toLocaleString('fa')} رقم</label>
          <div className="code-display-row">
            <input id="theater-door-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={needed} value={code} onChange={(event) => { setCode(event.target.value.replace(/[^0-9۰-۹٠-٩]/g, '').slice(0, needed)); setFeedback(''); }} placeholder={'· '.repeat(needed)} aria-label="کد چندرقمی در تئاتر" />
            <button className="code-backspace" type="button" onClick={() => setCode((current) => current.slice(0, -1))} aria-label="حذف رقم آخر">⌫</button>
          </div>
          <div className="brass-keypad" aria-label="صفحه‌کلید ارقام">
            {['1','2','3','4','5','6','7','8','9','clear','0','delete'].map((key) => key === 'clear' ? <button className="keypad-util" type="button" key={key} onClick={() => setCode('')}>پاک</button> : key === 'delete' ? <button className="keypad-util" type="button" key={key} onClick={() => setCode((current) => current.slice(0, -1))}>⌫</button> : <button type="button" key={key} onClick={() => addDigit(key)}>{Number(key).toLocaleString('fa')}</button>)}
          </div>
          {feedback && <p className={`door-feedback ${opened ? 'feedback-success' : ''}`} role="status">{feedback}</p>}
          <button className="unlock-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'در حال چرخاندن قفل…' : 'چرخاندن قفل' } <span>⟲</span></button>
        </form>}
        {opened && <div className="door-success-actions"><p>درِ ورودی برای همهٔ بازیکنان باز شد.</p><button type="button" onClick={onClose}>ادامهٔ بازی <span>←</span></button></div>}
        <p className="lock-attempts">تلاش‌های ناموفق: {room.alley.doorLockState.attempts.toLocaleString('fa')}</p>
      </section>
    </div>
  );
}
