'use client';

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  DEFAULT_FOV_Y_DEG,
  buildPresenceMarkers,
  presenceSummaryLabel,
  shouldShowPresence,
  type LocalViewer,
  type PresenceMarker,
} from './presence-hud';

export interface PresenceHudProps {
  /** موقعیت و جهت نگاه بازیکن محلی (ارتفاع چشم در y). */
  local: LocalViewer | null;
  /** snapshotهای خام هم‌تیمی‌ها؛ هر دو شکل فاز ۰۴ و قرارداد ۲ پذیرفته می‌شود. */
  players: readonly unknown[] | null | undefined;
  /** شناسهٔ بازیکن محلی تا از فهرست حذف شود. */
  localPlayerId?: string;
  /** نام نمایشی هم‌تیمی‌ها از view اتاق؛ اولویت دارد بر نام داخل snapshot. */
  names?: Readonly<Record<string, string>> | null;
  /** زمان اکنون (ms) برای محاسبهٔ کهنگی؛ پیش‌فرض ساعت مرورگر. */
  now?: number;
  /** میدان دید عمودی دوربین (درجه)؛ پیش‌فرض موتور ۶۸. */
  fovYDeg?: number;
  /** حداکثر برچسب نامِ هم‌زمان (پیش‌فرض ۴). */
  maxNameplates?: number;
  /** مخفی کردن کامل لایه. */
  hidden?: boolean;
  className?: string;
}

/**
 * HUD حضور در جهان سه‌بعدی — نام هم‌تیمی بالای سر و فلش جهت برای افراد بیرون از دید.
 *
 * - همه‌چیز از `local` + snapshotها محاسبه می‌شود؛ هیچ واکشی شبکه‌ای در این
 *   کامپوننت نیست (ارسال/دریافت با `usePresence` فاز ۰۴ است).
 * - لایهٔ بصری `aria-hidden` و `pointer-events: none` است: هیچ کنترل بازی را
 *   نمی‌پوشاند و فوکوس صفحه‌کلید را نمی‌دزدد.
 * - فهرست کامل «نام — جهت — فاصله» به‌صورت `sr-only` و یک اعلان مؤدبانه فقط
 *   هنگام تغییر تعداد هم‌تیمی‌های در دید خوانده می‌شود.
 * - برای FPS: نشانگرها با `transform` جابه‌جا می‌شوند، رندر با `memo` و
 *   محاسبه با `useMemo` مهار شده و حداکثر ۴ برچسب نام هم‌زمان دیده می‌شود.
 * - شفافیت با پلهٔ ۵۰۰ms به‌روز می‌شود تا در هر فریم، کار اضافه نکنیم.
 */
function PresenceHud({
  local,
  players,
  localPlayerId,
  names,
  now,
  fovYDeg = DEFAULT_FOV_Y_DEG,
  maxNameplates,
  hidden = false,
  className,
}: PresenceHudProps) {
  const viewport = useViewport();
  const clock = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  // پلهٔ ۵۰۰ms: فقط برای کهنگی و شفافیت؛ موقعیت‌ها بدون تأخیر به‌روز می‌شوند.
  const nowBucket = Math.floor(clock / 500) * 500;

  const markers = useMemo(
    () =>
      buildPresenceMarkers(local, players, {
        widthPx: viewport.width,
        heightPx: viewport.height,
        fovYDeg,
      }, {
        now: nowBucket,
        localPlayerId,
        maxNameplates,
        names,
      }),
    [local, players, viewport.width, viewport.height, fovYDeg, nowBucket, localPlayerId, maxNameplates, names],
  );

  const summary = presenceSummaryLabel(markers);
  const visibleCount = markers.filter((marker) => marker.kind === 'nameplate').length;
  const [announcement, setAnnouncement] = useState('');
  const previousVisible = useRef<number | null>(null);

  // فقط وقتی تعداد هم‌تیمی‌های در دید عوض شود اعلام می‌کنیم؛ نه در هر فریم.
  useEffect(() => {
    if (previousVisible.current === visibleCount) return;
    previousVisible.current = visibleCount;
    setAnnouncement(summary);
  }, [visibleCount, summary]);

  if (hidden || !shouldShowPresence(local, markers)) {
    return (
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    );
  }

  return (
    <>
      <div
        className={`presence-hud ${className ?? ''}`.trim()}
        data-count={markers.length}
        aria-hidden="true"
      >
        {markers.map((marker) => (
          <PresenceMarkerView key={marker.playerId} marker={marker} />
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <ul className="sr-only" aria-label="هم‌تیمی‌های اطراف">
        {markers.map((marker) => (
          <li key={marker.playerId}>{marker.announcement}</li>
        ))}
      </ul>
    </>
  );
}

function PresenceMarkerView({ marker }: { marker: PresenceMarker }) {
  const style = {
    '--presence-x': `${marker.xPct.toFixed(2)}%`,
    '--presence-y': `${marker.yPct.toFixed(2)}%`,
    '--presence-angle': `${marker.angleDeg.toFixed(1)}deg`,
    '--presence-opacity': marker.opacity.toFixed(2),
    left: `${marker.xPct.toFixed(2)}%`,
    top: `${marker.yPct.toFixed(2)}%`,
    opacity: marker.opacity,
  } as CSSProperties;

  if (marker.kind === 'nameplate') {
    return (
      <span className="presence-nameplate" style={style}>
        <span className="presence-nameplate-initial" aria-hidden="true">
          {marker.initial}
        </span>
        <span className="presence-nameplate-text">
          <strong>{marker.label}</strong>
          <small>{marker.distanceLabel}</small>
        </span>
      </span>
    );
  }

  return (
    <span className="presence-arrow" style={style}>
      <span className="presence-arrow-glyph" style={{ transform: `rotate(${marker.angleDeg.toFixed(1)}deg)` }} aria-hidden="true">
        ▲
      </span>
      <span className="presence-arrow-label">{marker.label}</span>
    </span>
  );
}

interface ViewportSize {
  width: number;
  height: number;
}

/** اندازهٔ ناحیهٔ دید؛ در سرور با مقدار پیش‌فرض تا رندر اول و کلاینت یکی باشد. */
function useViewport(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>({ width: 1280, height: 720 });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const read = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    read();
    window.addEventListener('resize', read, { passive: true });
    window.addEventListener('orientationchange', read);
    return () => {
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', read);
    };
  }, []);

  return size;
}

export default memo(PresenceHud);
