'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { announcePanelOpen, onOtherPanelOpen } from './panel-focus';
import { useSwipeDismiss } from './use-swipe-dismiss';
import {
  buildRoster,
  describeRosterEntry,
  isCueDismissed,
  presenceSummary,
  storyCueFor,
  type RosterPlayerInput,
  type StoryCueStats,
} from './theater-roster';

export interface TheaterCompanionHudProps extends StoryCueStats {
  players: readonly RosterPlayerInput[];
  meId: string;
  phase: string;
  /** پنل در شروع باز باشد (پیش‌فرض: بسته تا دید صحنه باز بماند). */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * همراهِ تماشاخانه — فهرست هم‌تیمی‌ها، برچسب صندلی و نشانهٔ داستان.
 *
 * کم‌مزاحمت: به‌صورت پیش‌فرض بسته است، گوشهٔ بالا-چپ می‌نشیند و هرگز وسط صحنه
 * را نمی‌پوشاند. هیچ داده‌ای واکشی نمی‌کند و فقط از view سرور تغذیه می‌شود.
 */
export default function TheaterCompanionHud({
  players,
  meId,
  phase,
  punchedCount,
  inspectedCount,
  hotspotTotal,
  defaultOpen = false,
  className,
}: TheaterCompanionHudProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const togglePanel = useCallback(() => {
    setIsOpen((value) => {
      if (!value) announcePanelOpen('companion');
      return !value;
    });
  }, []);

  // باز شدن پنل دیگر (نجوا/کاوش) این پنل را جمع می‌کند.
  useEffect(() => onOtherPanelOpen('companion', () => setIsOpen(false)), []);

  /* کشیدنِ سربرگ به سمت لبهٔ راست (فلشِ تب) پنل را می‌بندد. */
  const swipe = useSwipeDismiss(isOpen, () => setIsOpen(false), 'end');

  const roster = useMemo(() => buildRoster(players, meId), [players, meId]);
  const cue = useMemo(
    () => storyCueFor(phase, { punchedCount, inspectedCount, hotspotTotal }),
    [phase, punchedCount, inspectedCount, hotspotTotal],
  );
  const summary = presenceSummary(roster);
  const cueVisible = !isCueDismissed(cue.id, dismissed);

  return (
    <>
      {/* پردهٔ پشت باید بیرون از بخش باشد: backdrop-filter پنل، آن را به دامنهٔ
          خودش محدود می‌کند و روی محتوای خودِ پنل می‌افتد. */}
      {isOpen && <div className="panel-scrim" aria-hidden="true" onClick={() => setIsOpen(false)} />}
      <section
        className={`theater-companion-hud ${isOpen ? 'is-open' : ''} ${className ?? ''}`.trim()}
        aria-label="همراه تماشاخانه"
      >
        <button
        className="companion-toggle"
        type="button"
        onClick={togglePanel}
        aria-expanded={isOpen}
        aria-controls="companion-body"
        {...swipe}
      >
        <span className="companion-crest" aria-hidden="true">❧</span>
        <span className="companion-toggle-text">
          <strong>هم‌سفران تماشاخانه</strong>
          <small>{summary}</small>
        </span>
        <span className={`companion-chevron ${isOpen ? 'turned' : ''}`} aria-hidden="true">⌃</span>
      </button>

      {isOpen && (
        <div className="companion-body" id="companion-body">
          {cueVisible && (
            <article className="story-cue" aria-live="polite">
              <div className="story-cue-head">
                <span className="story-cue-chapter">{cue.chapter}</span>
                <button
                  className="story-cue-dismiss"
                  type="button"
                  onClick={() => setDismissed((previous) => [...previous, cue.id])}
                  aria-label="بستن نشانهٔ داستان"
                >
                  ×
                </button>
              </div>
              <h3>{cue.title}</h3>
              <p>{cue.body}</p>
            </article>
          )}

          {roster.length === 0 ? (
            <p className="companion-empty">هنوز هم‌تیمی‌ای در این اتاق ثبت نشده است.</p>
          ) : (
            <ul className="companion-roster" aria-label="فهرست هم‌تیمی‌ها و صندلی‌ها">
              {roster.map((entry) => (
                <li
                  className={`companion-row ${entry.isMe ? 'is-me' : ''} ${entry.isOnline ? '' : 'is-offline'}`}
                  key={entry.playerId}
                  aria-label={describeRosterEntry(entry)}
                >
                  <span className="companion-avatar" aria-hidden="true">{entry.initial}</span>
                  <span className="companion-identity">
                    <strong>{entry.name}{entry.isMe ? ' (شما)' : ''}</strong>
                    <small>{entry.seatLabel}</small>
                  </span>
                  <span className="companion-state">
                    <span className={`companion-dot ${entry.isOnline ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
                    <span className="companion-status">{entry.statusLabel}</span>
                    <span className="companion-progress">{entry.progressLabel}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </section>
    </>
  );
}
