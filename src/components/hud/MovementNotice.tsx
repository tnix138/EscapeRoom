'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MOVEMENT_RELEASE_WINDOW_MS,
  movementNotice,
  resolveMovementMode,
  type MovementMode,
} from './narration/movement-notice';

export interface MovementNoticeProps {
  /** کات‌سین یا صحنهٔ سینمایی در جریان است. */
  cinematic?: boolean;
  /** پنل/مودالی باز است که حرکت را می‌بندد. */
  modalOpen?: boolean;
  /** ماوس قفل شده است. */
  pointerLocked?: boolean;
  /** تغییر حالت را به‌صورت متن هم نشان بده (پیش‌فرض: بله). */
  showDetail?: boolean;
  className?: string;
}

/**
 * اعلان وضعیت حرکت — وقتی حرکت قفل می‌شود یا آزاد می‌شود، بازیکن دلیل را
 * می‌بیند و راه آزادکردن را می‌داند. اعلان «آزاد شد» چند ثانیه‌ای محو می‌شود.
 */
export default function MovementNotice({
  cinematic = false,
  modalOpen = false,
  pointerLocked = false,
  showDetail = true,
  className,
}: MovementNoticeProps) {
  const mode: MovementMode = resolveMovementMode({ cinematic, modalOpen, pointerLocked });
  const previousMode = useRef<MovementMode>(mode);
  const [releasedAtMs, setReleasedAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  // رهاسازی قید → ثبت زمان برای اعلان کوتاه «حرکت آزاد شد».
  useEffect(() => {
    const previous = previousMode.current;
    previousMode.current = mode;
    if (previous !== 'free' && mode === 'free') {
      setReleasedAtMs(Date.now());
    }
    if (mode !== 'free') setReleasedAtMs(null);
  }, [mode]);

  useEffect(() => {
    if (releasedAtMs === null) return undefined;
    setNowMs(Date.now());
    const timer = window.setTimeout(() => setReleasedAtMs(null), MOVEMENT_RELEASE_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [releasedAtMs]);

  const notice = movementNotice({ mode, releasedAtMs }, nowMs || Date.now());
  if (!notice) return null;

  return (
    <div className={`movement-notice tone-${notice.tone} ${className ?? ''}`.trim()} role="status" aria-live="polite">
      <span className="movement-notice-icon" aria-hidden="true">
        {notice.tone === 'ready' ? '✦' : notice.tone === 'info' ? '◎' : '⌘'}
      </span>
      <span className="movement-notice-text">
        <strong>{notice.text}</strong>
        {showDetail && notice.detail ? <small>{notice.detail}</small> : null}
      </span>
    </div>
  );
}
