'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  HORROR_LEVEL_STYLE,
  describeHorrorLevel,
  horrorLevelChangeMessage,
  horrorSignalCssVars,
  normalizeHorrorLevel,
  type HorrorIntensity,
} from './horror-signal';

export interface HorrorSignalHudProps {
  /**
   * سیگنال ترس از موتور/سرور: `calm` | `tense` | `panic`.
   * هر مقدار ناشناخته‌ای به «آرام» تبدیل می‌شود (fail-safe).
   */
  level: HorrorIntensity | string | null | undefined;
  /** تحمیل حالت کم‌حرکت؛ اگر داده نشود از تنظیم سیستم خوانده می‌شود. */
  reducedMotion?: boolean;
  /** نمایش نشانگر متنی گوشهٔ صفحه (پیش‌فرض: روشن). */
  showBadge?: boolean;
  /** مخفی کردن کامل لایه. */
  hidden?: boolean;
  className?: string;
}

/**
 * HUD ترسِ سه‌سطحی — نسخهٔ قراردادی فاز ۰۷-ب (Issue #91).
 *
 * - فقط یک prop می‌گیرد (`level`) و **هیچ import ای از `src/engine3d/**`
 *   ندارد؛ موتور سه‌بعدی/صدای علیرضا سیگنال را می‌دهد.
 * - سطح ناشناخته → «آرام» (بازیکن هرگز در وحشت گیر نمی‌افتد).
 * - تغییر سطح یک‌بار با `role="status"` اعلام می‌شود، نه در هر رندر.
 * - لایهٔ تزئینی `aria-hidden` و `pointer-events: none` است؛ هیچ کنترل بازی را
 *   نمی‌پوشاند و فوکوس نمی‌دزدد.
 * - در `prefers-reduced-motion` لرزش و تپش متوقف می‌شود ولی متن و لبهٔ قرمز
 *   باقی می‌ماند.
 */
export default function HorrorSignalHud({
  level,
  reducedMotion,
  showBadge = true,
  hidden = false,
  className,
}: HorrorSignalHudProps) {
  const systemReducedMotion = useSystemReducedMotion();
  const reduced = reducedMotion ?? systemReducedMotion;
  const safeLevel = normalizeHorrorLevel(level);
  const style = HORROR_LEVEL_STYLE[safeLevel];

  const [announcement, setAnnouncement] = useState('');
  const previousLevel = useRef<HorrorIntensity | null>(null);

  useEffect(() => {
    if (previousLevel.current === safeLevel) return;
    const message = horrorLevelChangeMessage(previousLevel.current, safeLevel);
    previousLevel.current = safeLevel;
    if (message) setAnnouncement(message);
  }, [safeLevel]);

  if (hidden) return null;

  // همان تابعی که تست می‌سنجد؛ تا «استایل درست هر سطح» در تست و رندر یکی باشد.
  const cssVars = horrorSignalCssVars(safeLevel) as CSSProperties;

  return (
    <>
      <div
        className={`horror-signal ${className ?? ''}`.trim()}
        data-level={safeLevel}
        data-reduced-motion={reduced ? 'true' : 'false'}
        style={cssVars}
        aria-hidden="true"
      >
        <span className="horror-signal-vignette" />
        <span className="horror-signal-pulse" />
        <span className="horror-signal-grain" />
        {showBadge && (
          <span className="horror-signal-badge">
            <span className="horror-signal-dot" />
            <span>{style.label}</span>
          </span>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement || describeHorrorLevel(safeLevel)}
      </p>
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
