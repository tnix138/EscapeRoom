'use client';

import { clamp01, type JumpScareCue } from './horror-hud';

export interface JumpScareOverlayProps {
  /** کیوی فعال؛ `null` یعنی هیچ پرده‌ای دیده نمی‌شود. */
  cue: JumpScareCue | null;
  /** میلی‌ثانیهٔ باقی‌مانده تا بسته شدن پرده (برای نوار پیشرفت). */
  remainingMs?: number;
  /** در حالت کم‌حرکت پرده فقط ظاهر می‌شود، بدون حرکت یا فلاش. */
  reducedMotion?: boolean;
  /** دکمهٔ «رد کردن صحنه» (اختیاری؛ تنها کنترل قابل‌فوکوس این لایه). */
  onSkip?: () => void;
  className?: string;
}

/**
 * پردهٔ جامپ‌اسکر — سیاهی کوتاه با یک عنوان و یک جملهٔ فارسی.
 *
 * - `role="alert"` + `aria-live="assertive"` متن را یک بار برای صفحه‌خوان می‌خواند.
 * - پرده شفاف نیست که صحنه را پنهان کند: حداکثر ۲.۲ ثانیه و بدون فلاش نوری.
 * - `pointer-events: none` روی کل لایه است؛ فقط دکمهٔ اختیاری «رد کردن» کلیک‌پذیر است.
 * - هیچ پاسخ معمایی در متن کیوها نیست.
 */
export default function JumpScareOverlay({
  cue,
  remainingMs,
  reducedMotion = false,
  onSkip,
  className,
}: JumpScareOverlayProps) {
  if (!cue) return null;

  const hasTiming = typeof remainingMs === 'number' && Number.isFinite(remainingMs);
  const progress = hasTiming && cue.durationMs > 0
    ? clamp01(1 - remainingMs / cue.durationMs)
    : 0;

  return (
    <div
      key={cue.id}
      className={`jump-scare-overlay ${className ?? ''}`.trim()}
      data-kind={cue.kind}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="jump-scare-sheet">
        <p className="jump-scare-headline">{cue.headline}</p>
        <p className="jump-scare-subline">{cue.subline}</p>
        {onSkip && (
          <button type="button" className="jump-scare-skip" onClick={onSkip}>
            رد کردن صحنه
          </button>
        )}
        {hasTiming && (
          <div className="jump-scare-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
      </div>
    </div>
  );
}
