'use client';

import { useState } from 'react';

export interface ReservationInvite {
  seatIndex: number;
  playerName: string;
  seatLabel: string;
  seatToken: string;
  invitePath: string;
}

export interface HostReservationResult {
  roomCode: string;
  playerCount: number;
  invites: ReservationInvite[];
}

export default function InviteLinksDeck({ reservation, onReset, isDemo }: {
  reservation: HostReservationResult;
  onReset: () => void;
  isDemo: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const inviteUrl = (path: string) => typeof window === 'undefined'
    ? path
    : new URL(path, window.location.origin).toString();

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied('کپی خودکار در این مرورگر در دسترس نیست');
      window.setTimeout(() => setCopied(null), 2600);
    }
  }

  const allLinks = reservation.invites.map((invite) => `${invite.playerName}: ${inviteUrl(invite.invitePath)}`).join('\n');

  return (
    <section className="invite-deck" aria-live="polite">
      <div className="success-seal"><span>✓</span></div>
      <div className="deck-heading">
        <p className="eyebrow">رزرو شما آماده است</p>
        <h3>دعوت‌نامه‌ها صادر شدند</h3>
        <p>لینک هر صندلی را فقط برای همان مهمان بفرستید.</p>
      </div>
      {isDemo && <div className="demo-notice"><span>✳</span><span><strong>حالت پیش‌نمایش</strong> — سرویس رزرو هنوز متصل نیست؛ این لینک‌ها برای نمایش موج اول ساخته شده‌اند.</span></div>}
      <div className="room-code-line"><span>کد اتاق</span><strong dir="ltr">{reservation.roomCode}</strong><span>{reservation.playerCount.toLocaleString('fa')} مهمان</span></div>
      <div className="invite-list">
        {reservation.invites.map((invite) => (
          <article className="invite-card" key={invite.seatToken}>
            <div className="seat-number" aria-label={`صندلی ${invite.seatIndex + 1}`}>{String(invite.seatIndex + 1).padStart(2, '0')}</div>
            <div className="invite-details">
              <div className="invite-name-row"><strong>{invite.playerName}</strong><span>{invite.seatLabel}</span></div>
              <code dir="ltr">{inviteUrl(invite.invitePath)}</code>
            </div>
            <div className="invite-actions">
              <button className="icon-button" type="button" onClick={() => copy(inviteUrl(invite.invitePath), invite.seatToken)} aria-label={`کپی لینک دعوت ${invite.playerName}`} title="کپی لینک">
                {copied === invite.seatToken ? '✓' : '⧉'}
              </button>
              <a className="icon-button open-link" href={invite.invitePath} target="_blank" rel="noreferrer" aria-label={`باز کردن دعوت‌نامه ${invite.playerName} در تب جدید`} title="باز کردن در تب جدید">↗</a>
              {copied === invite.seatToken && <span className="copy-hint">کپی شد</span>}
            </div>
          </article>
        ))}
      </div>
      <div className="deck-actions">
        <button className="button button-gold" type="button" onClick={() => copy(allLinks, 'all')}>
          {copied === 'all' ? 'همهٔ لینک‌ها کپی شد ✓' : 'کپی همهٔ دعوت‌نامه‌ها'}
        </button>
        <button className="button button-quiet" type="button" onClick={onReset}>رزرو اتاق دیگر</button>
      </div>
      {copied && copied !== 'all' && !reservation.invites.some((invite) => invite.seatToken === copied) && <p className="copy-status">{copied}</p>}
    </section>
  );
}
