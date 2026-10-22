'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayActNumber, RowRomanCode, THEATER_EMBLEMS, TheaterEmblemId, TicketPunchSelection } from './contracts';
import {
  ACT_LABELS,
  ACT_NUMBERS,
  DIGIT_PENDING_MESSAGE,
  PUZZLE_PANEL_ID,
  ROW_CODES,
  ROW_LABELS,
  describePunchSelection,
  isPunchSelectionComplete,
  puzzleToggleHint,
  puzzleToggleIcon,
  puzzleToggleLabel,
  toPersianNumber,
} from './puzzle-rules';

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

export default function HeldTicketsDrawer({
  ownerName,
  seatLabel,
  playTitle,
  alleyRowHintName,
  companionStub,
  initialSelection,
  isValidated,
  revealedDigit,
  isPunching,
  onPunch,
  onShareStub,
}: HeldTicketsDrawerProps) {
  const [showCouponBack, setShowCouponBack] = useState(false);
  // پاسخ معما (نماد/پرده/ردیف) پیش‌فرض باز است؛ بازیکن با دکمهٔ کنارش جمعش می‌کند.
  const [puzzleOpen, setPuzzleOpen] = useState(true);
  const [sharedNote, setSharedNote] = useState(false);
  const [emblem, setEmblem] = useState<TheaterEmblemId>(initialSelection?.emblem ?? 'mask');
  const [actNumber, setActNumber] = useState<PlayActNumber>(initialSelection?.actNumber ?? 1);
  const [rowCode, setRowCode] = useState<RowRomanCode>(initialSelection?.rowCode ?? 'I');
  const backHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const flipButtonRef = useRef<HTMLButtonElement | null>(null);
  const shareTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!initialSelection) return;
    setEmblem(initialSelection.emblem);
    setActNumber(initialSelection.actNumber);
    setRowCode(initialSelection.rowCode);
  }, [initialSelection?.emblem, initialSelection?.actNumber, initialSelection?.rowCode]);

  useEffect(() => {
    if (showCouponBack) backHeadingRef.current?.focus({ preventScroll: true });
    else flipButtonRef.current?.focus({ preventScroll: true });
  }, [showCouponBack]);

  useEffect(() => () => {
    if (shareTimer.current !== null) window.clearTimeout(shareTimer.current);
  }, []);

  const selection: TicketPunchSelection = { emblem, actNumber, rowCode };
  const complete = isPunchSelectionComplete(selection);
  const emblemLabel = THEATER_EMBLEMS.find((item) => item.id === emblem)?.label ?? 'نماد';
  const summary = describePunchSelection(selection, emblemLabel);
  const companionEmblem = THEATER_EMBLEMS.find((item) => item.id === companionStub.targetEmblem);

  function punch() {
    if (isValidated || isPunching || !complete) return;
    onPunch(selection);
  }

  function shareStub() {
    onShareStub();
    setSharedNote(true);
    if (shareTimer.current !== null) window.clearTimeout(shareTimer.current);
    shareTimer.current = window.setTimeout(() => setSharedNote(false), 3200);
  }

  return (
    <section className="held-tickets" aria-label={`بلیط‌های در دست ${ownerName}`}>
      <div className="ticket-hand hand-left" aria-hidden="true" />
      <div className="ticket-hand hand-right" aria-hidden="true" />
      <div className="tickets-header">
        <span className="ticket-header-line" />
        <span>مدارک ورود · {ownerName}</span>
        <span className="ticket-header-line" />
      </div>

      <div className="held-tickets-scroll">
        <div className="ticket-pair">
          <article className={`main-ticket ${isValidated ? 'ticket-validated' : ''}`}>
            <div className="ticket-notch top" />
            <div className="main-ticket-inner">
              <div className="main-ticket-brand"><span>TEATRO ORFEO</span><span>۱۹۲۴</span></div>
              <div className="main-ticket-title"><small>بلیط ورود</small><h3>{playTitle || 'نمایش امشب'}</h3></div>
              <div className="ticket-owner">
                <span className="ticket-avatar" aria-hidden="true">♙</span>
                <span><small>دارندهٔ بلیط</small><strong>{ownerName}</strong></span>
                <span className="ticket-seat-tag">{seatLabel}</span>
              </div>
              <div className="ticket-perforation" aria-hidden="true"><span>✦</span><i /><span>✦</span></div>

              {/* کارت «پاسخ معما» — هم‌تم با پنل سرنخ‌های کوچه و جمع‌شدنی. */}
              <section className={`punch-card ${puzzleOpen ? 'is-open' : 'is-collapsed'}`} aria-labelledby="punch-card-title">
                <header className="punch-card-head">
                  <span className="punch-card-crest" aria-hidden="true">✦</span>
                  <div className="punch-card-titles">
                    <span className="punch-card-kicker">سرنخ‌های کوچه</span>
                    <h4 className="punch-card-title" id="punch-card-title">پاسخ معما</h4>
                  </div>
                  <button
                    type="button"
                    className="punch-card-toggle"
                    aria-expanded={puzzleOpen}
                    aria-controls={PUZZLE_PANEL_ID}
                    aria-label={puzzleToggleLabel(puzzleOpen)}
                    title={puzzleToggleHint(puzzleOpen)}
                    onClick={() => setPuzzleOpen((value) => !value)}
                  >
                    <span className="punch-card-toggle-icon" aria-hidden="true">{puzzleToggleIcon(puzzleOpen)}</span>
                    <span className="punch-card-toggle-text">{puzzleToggleLabel(puzzleOpen)}</span>
                  </button>
                </header>

                <div className="punch-card-body" id={PUZZLE_PANEL_ID} hidden={!puzzleOpen}>
                  <p className="punch-card-lede" id={`punch-hint-${ownerName}`}>سه نشانه را از سرنخ‌ها پیدا کنید؛ هر سه باید با کوپن و دیوارهای کوچه بخوانند.</p>
                  <div className="punch-form">

                <fieldset className="punch-group" disabled={isValidated}>
                  <legend className="punch-legend">نماد نمایش</legend>
                  <div className="emblem-grid">
                    {THEATER_EMBLEMS.map((item) => (
                      <label className={`emblem-option ${emblem === item.id ? 'is-selected' : ''}`} key={item.id}>
                        <input
                          className="punch-radio"
                          type="radio"
                          name="ticket-emblem"
                          value={item.id}
                          checked={emblem === item.id}
                          onChange={() => setEmblem(item.id)}
                          disabled={isValidated}
                        />
                        <span className="emblem-symbol" aria-hidden="true">{item.symbol}</span>
                        <span className="emblem-label">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="punch-group" disabled={isValidated}>
                  <legend className="punch-legend">پردهٔ نمایش</legend>
                  <div className="segmented-row">
                    {ACT_NUMBERS.map((act) => (
                      <label className={`segment-option ${actNumber === act ? 'is-selected' : ''}`} key={act}>
                        <input
                          className="punch-radio"
                          type="radio"
                          name="ticket-act"
                          value={act}
                          checked={actNumber === act}
                          onChange={() => setActNumber(act)}
                          disabled={isValidated}
                        />
                        <strong>{toPersianNumber(act)}</strong>
                        <span>{ACT_LABELS[act]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="punch-group" disabled={isValidated}>
                  <legend className="punch-legend">
                    ردیف · {alleyRowHintName || 'گیشه'}
                  </legend>
                  <div className="segmented-row row-segments">
                    {ROW_CODES.map((code) => (
                      <label className={`segment-option ${rowCode === code ? 'is-selected' : ''}`} key={code}>
                        <input
                          className="punch-radio"
                          type="radio"
                          name="ticket-row"
                          value={code}
                          checked={rowCode === code}
                          onChange={() => setRowCode(code)}
                          disabled={isValidated}
                        />
                        <strong>{code}</strong>
                        <span>{ROW_LABELS[code]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <p className="punch-summary" id="punch-summary" aria-live="polite">
                  <span>انتخاب شما</span>
                  <strong>{summary}</strong>
                </p>

                {isValidated ? (
                  <div className="ticket-punch-success" role="status">
                    <span className="punch-success-seal" aria-hidden="true">✓</span>
                    <div>
                      <strong>بلیط شما تأیید شد</strong>
                      {revealedDigit !== null ? (
                        <p className="revealed-digit">
                          <span>رقم طلایی خط برش شما</span>
                          <strong>{toPersianNumber(revealedDigit)}</strong>
                        </p>
                      ) : (
                        <p className="revealed-digit-pending">{DIGIT_PENDING_MESSAGE}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    className="ticket-punch-button"
                    type="button"
                    onClick={punch}
                    disabled={isPunching || !complete}
                    aria-busy={isPunching}
                    aria-describedby="punch-summary"
                  >
                    <span>{isPunching ? 'در حال پانچ…' : 'پانچ کردن بلیط من'}</span>
                    <span aria-hidden="true">✣</span>
                  </button>
                )}
                  </div>
                </div>
              </section>
            </div>
            <div className="ticket-notch bottom" />
          </article>

          <article className={`companion-ticket ${showCouponBack ? 'coupon-flipped' : ''}`}>
            <div className="coupon-face coupon-front" aria-hidden={showCouponBack}>
              <span className="coupon-topline">COUPON · نوبت شما</span>
              <div className="coupon-stamp" aria-hidden="true">✳</div>
              <h3>کوپنِ هم‌تیمی</h3>
              <p>برای {companionStub.targetTeammateName}</p>
              <div className="coupon-clue">
                <span className="coupon-icon" aria-hidden="true">{companionEmblem?.symbol ?? '✦'}</span>
                <span><small>نماد بلیط او</small><strong>{companionEmblem?.label ?? 'راز'}</strong></span>
              </div>
              <div className="coupon-clue">
                <span className="coupon-icon" aria-hidden="true">☽</span>
                <span><small>پردهٔ نمایش</small><strong>{companionStub.targetActSceneTitle}</strong></span>
              </div>
              <p className="coupon-note">«{companionStub.whisperNote}»</p>
              <button
                ref={flipButtonRef}
                className="coupon-flip-button"
                type="button"
                onClick={() => setShowCouponBack(true)}
                aria-expanded={showCouponBack}
                aria-controls="coupon-back"
              >
                دیدن پشت کوپن ↶
              </button>
            </div>

            <div className="coupon-face coupon-back" id="coupon-back" aria-hidden={!showCouponBack}>
              <span className="coupon-topline">یادداشت پنهان · فقط برای شما</span>
              <div className="coupon-back-ornament" aria-hidden="true">❧</div>
              <h3 ref={backHeadingRef} tabIndex={-1}>سرنخِ حلقه</h3>
              <p>شما حلقهٔ معما را به بازیکن بعدی وصل می‌کنید.</p>
              <div className="coupon-recipient">
                <small>بلیطی که باید راهنمایی کنید</small>
                <strong>{companionStub.targetTeammateName}</strong>
              </div>
              <p className="coupon-note">{companionStub.whisperNote}</p>
              <button className="coupon-flip-button" type="button" onClick={() => setShowCouponBack(false)}>
                برگرداندن کوپن ↷
              </button>
              <button className="share-clue-button" type="button" onClick={shareStub}>
                مخابرهٔ سرنخ به گروه <span aria-hidden="true">↗</span>
              </button>
              <p className="share-clue-status" role="status">
                {sharedNote ? 'کوپن شما در نجوای گروهی فرستاده شد.' : ''}
              </p>
            </div>
          </article>
        </div>
        <p className="tickets-footnote"><span aria-hidden="true">✦</span> هر کوپن، کلیدی‌ست برای بلیطِ یکی از هم‌تیمی‌ها.</p>
      </div>
    </section>
  );
}
