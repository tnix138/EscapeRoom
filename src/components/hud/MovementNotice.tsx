'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import {
  MOVEMENT_POINTER_HINT_MS,
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
 * می‌بیند و راه آزادکردن را می‌داند.
 *
 * - «حرکت آزاد شد» و «ماوس قفل شده» **گذرا** هستند: چند ثانیه بعد خودشان محو
 *   می‌شوند. در بازی ماوس تقریباً همیشه قفل است و اعلان دائمی وسط صفحه دیده را
 *   می‌بست (باگ گزارش‌شده در بازبینی UI).
 * - «حرکت قفل شد» وقتی مودال باز است یا کات‌سین در جریان است می‌ماند، چون آن
 *   لحظه بازیکن واقعاً نمی‌تواند حرکت کند و باید علت را بداند.
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
  const lockStartedAt = useRef<number | null>(null);
  const [releasedAtMs, setReleasedAtMs] = useState<number | null>(null);
  // شمارندهٔ رندر: بعد از پایان پنجرهٔ راهنما یک‌بار رندر تازه می‌گیریم تا اعلان پنهان شود.
  const [, refresh] = useReducer((value: number) => value + 1, 0);

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
    const timer = window.setTimeout(() => setReleasedAtMs(null), MOVEMENT_RELEASE_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [releasedAtMs]);

  // قفل ماوس → راهنما فقط یک پنجرهٔ کوتاه، بعد سکوت تا دوباره آزاد و قفل شود.
  useEffect(() => {
    if (mode !== 'pointer-lock') {
      lockStartedAt.current = null;
      return undefined;
    }
    if (lockStartedAt.current === null) lockStartedAt.current = Date.now();
    const remaining = MOVEMENT_POINTER_HINT_MS - (Date.now() - lockStartedAt.current);
    if (remaining <= 0) return undefined;
    const timer = window.setTimeout(refresh, remaining + 16);
    return () => window.clearTimeout(timer);
  }, [mode]);

  // `Date.now()` در رندر بی‌خطر است: در حالت اولیه/SSR همهٔ مسیرها null
  // برمی‌گردانند و هیچ خروجی HTML وابسته به زمان ساخته نمی‌شود.
  const notice = movementNotice(
    { mode, releasedAtMs, pointerLockedAtMs: lockStartedAt.current },
    Date.now(),
  );
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
