'use client';

import { useEffect, useState } from 'react';
import { PlayActNumber, RowRomanCode, THEATER_EMBLEMS, TheaterEmblemId, TicketPunchSelection } from './contracts';

interface HeldTicketsDrawerProps {
  ownerName: string;
  seatLabel: string;
  playTitle: string;
  alleyRowHintName: string;
  companionStub: { targetTeammateName: string; targetEmblem: TheaterEmblemId; targetActSceneTitle: string; whisperNote: string };
  initialSelection: TicketPunchSelection | null;
  isValidated: boolean;
  revealedDigit: number | null;
  isPunching: boolean;
  onPunch: (selection: TicketPunchSelection) => void;
  onShareStub: () => void;
}

const rowCodes: RowRomanCode[] = ['I', 'II', 'III', 'IV'];

export default function HeldTicketsDrawer({ ownerName, seatLabel, playTitle, alleyRowHintName, companionStub, initialSelection, isValidated, revealedDigit, isPunching, onPunch, onShareStub }: HeldTicketsDrawerProps) {
  const [showCouponBack, setShowCouponBack] = useState(false);
  const [emblem, setEmblem] = useState<TheaterEmblemId>(initialSelection?.emblem ?? 'mask');
  const [actNumber, setActNumber] = useState<PlayActNumber>(initialSelection?.actNumber ?? 1);
  const [rowCode, setRowCode] = useState<RowRomanCode>(initialSelection?.rowCode ?? 'I');

  useEffect(() => {
    if (!initialSelection) return;
    setEmblem(initialSelection.emblem);
    setActNumber(initialSelection.actNumber);
    setRowCode(initialSelection.rowCode);
  }, [initialSelection?.emblem, initialSelection?.actNumber, initialSelection?.rowCode]);

  function punch() {
    onPunch({ emblem, actNumber, rowCode });
  }

  return (
    <section className="held-tickets" aria-label="بلیط‌های در دست شما">
      <div className="ticket-hand hand-left" aria-hidden="true" /><div className="ticket-hand hand-right" aria-hidden="true" />
      <div className="tickets-header"><span className="ticket-header-line" /><span>مدارک ورود · {ownerName}</span><span className="ticket-header-line" /></div>
      <div className="held-tickets-scroll">
        <div className="ticket-pair">
          <article className={`main-ticket ${isValidated ? 'ticket-validated' : ''}`}>
            <div className="ticket-notch top" /><div className="main-ticket-inner">
              <div className="main-ticket-brand"><span>TEATRO ORFEO</span><span>۱۹۲۴</span></div>
              <div className="main-ticket-title"><small>بلیط ورود</small><h3>{playTitle || 'نمایش امشب'}</h3></div>
              <div className="ticket-owner"><span className="ticket-avatar">♙</span><span><small>دارندهٔ بلیط</small><strong>{ownerName}</strong></span><span className="ticket-seat-tag">{seatLabel}</span></div>
              <div className="ticket-perforation"><span>✦</span><i /><span>✦</span></div>
              <div className="punch-form">
                <p>سه نشانه را از سرنخ‌ها پیدا کنید</p>
                <label className="punch-select-label">نماد نمایش
                  <select value={emblem} onChange={(event) => setEmblem(event.target.value as TheaterEmblemId)} disabled={isValidated}>
                    {THEATER_EMBLEMS.map((item) => <option value={item.id} key={item.id}>{item.symbol} {item.label}</option>)}
                  </select>
                </label>
                <div className="punch-select-row">
                  <label className="punch-select-label">پرده
                    <select value={actNumber} onChange={(event) => setActNumber(Number(event.target.value) as PlayActNumber)} disabled={isValidated}>
                      {[1, 2, 3, 4].map((act) => <option key={act} value={act}>{act.toLocaleString('fa')}</option>)}
                    </select>
                  </label>
                  <label className="punch-select-label">ردیف · {alleyRowHintName || 'گیشه'}
                    <select value={rowCode} onChange={(event) => setRowCode(event.target.value as RowRomanCode)} disabled={isValidated}>
                      {rowCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                    </select>
                  </label>
                </div>
                <button className={`ticket-punch-button ${isValidated ? 'punched' : ''}`} type="button" onClick={punch} disabled={isPunching || isValidated}>
                  <span>{isPunching ? 'در حال پانچ…' : isValidated ? 'بلیط تأیید شد' : 'پانچ کردن بلیط من'}</span><span>{isValidated ? '✓' : '✣'}</span>
                </button>
                {revealedDigit !== null && <div className="revealed-digit"><span>رقم طلایی خط برش</span><strong>{revealedDigit.toLocaleString('fa')}</strong></div>}
              </div>
            </div>
            <div className="ticket-notch bottom" />
          </article>

          <article className={`companion-ticket ${showCouponBack ? 'coupon-flipped' : ''}`}>
            <div className="coupon-face coupon-front">
              <span className="coupon-topline">COUPON · نوبت شما</span><div className="coupon-stamp">✳</div>
              <h3>کوپنِ هم‌تیمی</h3><p>برای {companionStub.targetTeammateName}</p>
              <div className="coupon-clue"><span className="coupon-icon">{THEATER_EMBLEMS.find((item) => item.id === companionStub.targetEmblem)?.symbol ?? '✦'}</span><span><small>نماد بلیط او</small><strong>{THEATER_EMBLEMS.find((item) => item.id === companionStub.targetEmblem)?.label ?? 'راز'}</strong></span></div>
              <div className="coupon-clue"><span className="coupon-icon">☽</span><span><small>پردهٔ نمایش</small><strong>{companionStub.targetActSceneTitle}</strong></span></div>
              <p className="coupon-note">«{companionStub.whisperNote}»</p>
              <button className="coupon-flip-button" type="button" onClick={() => setShowCouponBack(true)}>دیدن پشت کوپن ↶</button>
            </div>
            <div className="coupon-face coupon-back">
              <span className="coupon-topline">یادداشت پنهان · فقط برای شما</span><div className="coupon-back-ornament">❧</div>
              <h3>سرنخِ حلقه</h3>
              <p>شما حلقهٔ معما را به بازیکن بعدی وصل می‌کنید.</p>
              <div className="coupon-recipient"><small>بلیطی که باید راهنمایی کنید</small><strong>{companionStub.targetTeammateName}</strong></div>
              <p className="coupon-note">{companionStub.whisperNote}</p>
              <button className="coupon-flip-button" type="button" onClick={() => setShowCouponBack(false)}>برگرداندن کوپن ↷</button>
              <button className="share-clue-button" type="button" onClick={onShareStub}>مخابرهٔ سرنخ به گروه <span>↗</span></button>
            </div>
          </article>
        </div>
        <p className="tickets-footnote"><span>✦</span> هر کوپن، کلیدی‌ست برای بلیطِ یکی از هم‌تیمی‌ها.</p>
      </div>
    </section>
  );
}
