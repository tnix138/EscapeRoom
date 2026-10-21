'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import JumpScareOverlay from './JumpScareOverlay';
import {
  describeFearState,
  effectsAt,
  HORROR_CUES,
  type HorrorTone,
  type JumpScareCue,
} from './horror-hud';

export interface HorrorHudProps {
  /** زمان سپری‌شده از آغاز کات‌سین بر مبنای ساعت سرور (میلی‌ثانیه). */
  elapsedMs: number;
  /** کیوهای ترس؛ پیش‌فرض جدول هم‌تراز با تایم‌لاین ۷۴ ثانیه‌ای. */
  cues?: readonly JumpScareCue[];
  /** تحمیل حالت کم‌حرکت؛ اگر داده نشود از تنظیم سیستم خوانده می‌شود. */
  reducedMotion?: boolean;
  /** مقیاس لرزش ۰ تا ۱ برای هماهنگی با شدت صحنه (پیش‌فرض ۱). */
  shakeScale?: number;
  /** مخفی کردن کامل لایه (مثلاً هنگام مکث یا خروج از صحنه). */
  hidden?: boolean;
  className?: string;
}

/**
 * HUD ترس — مه تیره، دانهٔ فیلم، پالس قرمز، لرزش لبه‌ها و پردهٔ جامپ‌اسکر.
 *
 * - همه‌چیز از `elapsedMs` مشتق می‌شود؛ هیچ تایمر یا state محلی برای زمان نیست.
 * - لایه‌های تزئینی `aria-hidden` هستند و `pointer-events: none` دارند؛ هیچ
 *   کنترل بازی را نمی‌پوشانند و فوکوس صفحه‌کلید را نمی‌دزدند.
 * - تغییر حالت ترس فقط یک بار (آرام → دلواپس → وحشت) با `role="status"` اعلام می‌شود.
 * - در `prefers-reduced-motion: reduce` لرزش و فلاش صفر می‌شوند ولی متن‌ها می‌مانند.
 */
export default function HorrorHud({
  elapsedMs,
  cues = HORROR_CUES,
  reducedMotion,
  shakeScale = 1,
  hidden = false,
  className,
}: HorrorHudProps) {
  const systemReducedMotion = useSystemReducedMotion();
  const reduced = reducedMotion ?? systemReducedMotion;
  const effects = effectsAt(elapsedMs, { cues, reducedMotion: reduced, shakeScale });
  const [announcement, setAnnouncement] = useState('');
  const previousTone = useRef<HorrorTone | null>(null);

  // اعلام تغییر حالت فقط در گذر از یک آستانه؛ نه در هر فریم.
  useEffect(() => {
    if (previousTone.current === effects.tone) return;
    previousTone.current = effects.tone;
    setAnnouncement(describeFearState(effects));
  }, [effects]);

  if (hidden || !effects.visible) return null;

  const style = {
    '--horror-fear': effects.fear.toFixed(3),
    '--horror-shake': `${effects.shakePx.toFixed(2)}px`,
    '--horror-pulse': effects.pulseOpacity.toFixed(3),
    '--horror-vignette': effects.vignetteOpacity.toFixed(3),
    '--horror-grain': effects.grainOpacity.toFixed(3),
  } as CSSProperties;

  return (
    <>
      <div
        className={`horror-hud ${className ?? ''}`.trim()}
        data-tone={effects.tone}
        data-reduced-motion={reduced ? 'true' : 'false'}
        aria-hidden="true"
        style={style}
      >
        <span className="horror-vignette" />
        <span className="horror-pulse" />
        <span className="horror-grain" />
        <span className="horror-flash" style={{ opacity: effects.flashIntensity * 0.62 }} />
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {effects.overlay && (
        <JumpScareOverlay
          cue={effects.overlay.cue}
          remainingMs={effects.overlay.remainingMs}
          reducedMotion={reduced}
        />
      )}
    </>
  );
}

/** خواندن تنظیم «کم کردن حرکت» سیستم با گوش دادن به تغییرات آن. */
function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}
