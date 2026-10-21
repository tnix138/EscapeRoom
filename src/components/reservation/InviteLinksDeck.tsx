'use client';

import { useEffect, useRef, useState } from 'react';
import { copyText } from './clipboard';
import {
  buildInviteShareText,
  describeCopyFailure,
  guestCountLabel,
  resolveInviteUrl,
  toPersianDigits,
} from './reservation-rules';

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

interface ManualCopyState {
  id: string;
  text: string;
  label: string;
}

export default function InviteLinksDeck({ reservation, onReset, isDemo }: {
  reservation: HostReservationResult;
  onReset: () => void;
  isDemo: boolean;
}) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manual, setManual] = useState<ManualCopyState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // آدرس مطلق فقط بعد از mount ساخته می‌شود تا SSR و کلاینت یکسان بمانند.
  useEffect(() => {
    setOrigin(window.location.origin);
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const inviteUrl = (path: string) => resolveInviteUrl(path, origin);

  async function copy(text: string, id: string, successMessage: string, label: string) {
    const result = await copyText(text);
    if (result.ok) {
      setCopiedId(id);
      setManual(null);
      setAnnouncement(successMessage);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2200);
      return;
    }
    setCopiedId(null);
    setManual({ id, text, label });
    setAnnouncement(describeCopyFailure(result.reason));
    window.setTimeout(() => manualInputRef.current?.focus(), 0);
  }

  function copyOne(invite: ReservationInvite) {
    const url = inviteUrl(invite.invitePath);
    void copy(
      url,
      invite.seatToken,
      `لینک ${invite.playerName} کپی شد.`,
      `کپی دستی لینک ${invite.playerName}`,
    );
  }

  function copyAll() {
    const text = buildInviteShareText(reservation.roomCode, reservation.invites, origin);
    void copy(text, 'all', 'همهٔ دعوت‌نامه‌ها با کد اتاق کپی شدند.', 'کپی دستی همهٔ دعوت‌نامه‌ها');
  }

  return (
    <section className="invite-deck" aria-labelledby="deck-title">
      <div className="success-seal" aria-hidden="true"><span>✓</span></div>
      <div className="deck-heading">
        <p className="eyebrow">رزرو شما آماده است</p>
        <h3 id="deck-title" ref={headingRef} tabIndex={-1}>دعوت‌نامه‌ها صادر شدند</h3>
        <p>لینک هر صندلی را فقط برای همان مهمان بفرستید.</p>
      </div>

      {isDemo && (
        <div className="demo-notice">
          <span aria-hidden="true">✳</span>
          <span>
            <strong>حالت پیش‌نمایش</strong> — سرویس رزرو هنوز متصل نیست؛ این لینک‌ها فقط برای دیدن جریان کار ساخته شده‌اند.
          </span>
        </div>
      )}

      <div className="room-code-line">
        <span>کد اتاق</span>
        <strong dir="ltr">{reservation.roomCode}</strong>
        <span>{guestCountLabel(reservation.playerCount)}</span>
      </div>

      <div className="invite-list">
        {reservation.invites.map((invite) => {
          const url = inviteUrl(invite.invitePath);
          const isManual = manual?.id === invite.seatToken;
          return (
            <article className="invite-card" key={invite.seatToken}>
              <div className="seat-number" aria-hidden="true">
                {toPersianDigits(String(invite.seatIndex + 1).padStart(2, '0'))}
              </div>
              <div className="invite-details">
                <div className="invite-name-row">
                  <strong>{invite.playerName}</strong>
                  <span>{invite.seatLabel}</span>
                </div>
                <code dir="ltr" title={url}>{url}</code>
              </div>
              <div className="invite-actions">
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => copyOne(invite)}
                  aria-label={`کپی لینک دعوت ${invite.playerName}`}
                  title="کپی لینک"
                >
                  <span aria-hidden="true">{copiedId === invite.seatToken ? '✓' : '⧉'}</span>
                </button>
                <a
                  className="icon-button open-link"
                  href={invite.invitePath}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`باز کردن دعوت‌نامهٔ ${invite.playerName} در تب جدید`}
                  title="باز کردن در تب جدید"
                >
                  <span aria-hidden="true">↗</span>
                </a>
                {copiedId === invite.seatToken && <span className="copy-hint" aria-hidden="true">کپی شد</span>}
              </div>
              {isManual && (
                <div className="invite-manual">
                  <label className="invite-manual-label" htmlFor={`manual-${invite.seatToken}`}>
                    {manual.label}
                  </label>
                  <input
                    ref={manualInputRef}
                    id={`manual-${invite.seatToken}`}
                    className="invite-manual-input"
                    dir="ltr"
                    readOnly
                    value={manual.text}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                  />
                  <span className="invite-manual-hint">Ctrl+C</span>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="deck-actions">
        <button className="button button-gold" type="button" onClick={copyAll}>
          {copiedId === 'all' ? 'همهٔ لینک‌ها کپی شد ✓' : 'کپی همهٔ دعوت‌نامه‌ها'}
        </button>
        <button className="button button-quiet" type="button" onClick={onReset}>رزرو اتاق دیگر</button>
      </div>

      {manual?.id === 'all' && (
        <div className="invite-manual invite-manual-all">
          <label className="invite-manual-label" htmlFor="manual-all">
            {manual.label}
          </label>
          <textarea
            id="manual-all"
            className="invite-manual-input"
            dir="ltr"
            readOnly
            rows={5}
            value={manual.text}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
          />
          <span className="invite-manual-hint">Ctrl+C</span>
        </div>
      )}

      <p className="sr-only" aria-live="polite" role="status">{announcement}</p>
    </section>
  );
}
