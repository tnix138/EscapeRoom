'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CUTSCENE_DURATION_MS,
  CUTSCENE_CUES,
  chapterLabel,
  cueAt,
  formatClock,
  phaseNotice,
  type NarrationCue,
} from './narration/narration-track';
import {
  DEFAULT_PREFERENCES,
  describeAudioState,
  describeCaptionState,
  isAudible,
  readPreferences,
  resolveAudioShortcut,
  stepVolume,
  toggleMute,
  volumePercentLabel,
  writePreferences,
  type AudioPreferences,
} from './narration/audio-preferences';

export interface NarrationLayerProps {
  /** زمان سپری‌شده از شروع صحنه (میلی‌ثانیه، بر مبنای ساعت سرور). */
  elapsedMs: number;
  /** خط روایت؛ پیش‌فرض خط کات‌سین ۷۴ ثانیه‌ای. */
  track?: readonly NarrationCue[];
  /** طول صحنه؛ پیش‌فرض طول همان خط. */
  durationMs?: number;
  /** وضعیت بی‌صدا؛ اگر داده شود لایه کنترل صدا را نشان می‌دهد. */
  muted?: boolean;
  onToggleMute?: () => void;
  /** بلندی صدا (۰ تا ۱). */
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  /** نمایش اعلان شروع/پایان صحنه. */
  showPhaseNotices?: boolean;
  /** حالت فشرده برای صحنه‌های سه‌بعدی. */
  variant?: 'default' | 'compact';
  /** ذخیرهٔ ترجیحات در مرورگر (پیش‌فرض: روشن). */
  persistPreferences?: boolean;
  className?: string;
}

/**
 * لایهٔ روایت — زیرنویس زمان‌بندی‌شده + کنترل صدا + اعلان شروع/پایان.
 *
 * - زیرنویس با `role="status"` و `aria-live="polite"` فقط با تغییر کات اعلام می‌شود.
 * - کلید `C` زیرنویس را روشن/خاموش و کلید `M` صدا را بی‌صدا/باصدا می‌کند.
 * - فلش بالا/پایین بلندی صدا را ۱۰٪ تغییر می‌دهد؛ در فیلدهای متنی هیچ کلیدی گرفته نمی‌شود.
 * - هیچ داده‌ای واکشی نمی‌کند و هیچ پاسخ معمایی در متن‌ها نیست.
 */
export default function NarrationLayer({
  elapsedMs,
  track = CUTSCENE_CUES,
  durationMs,
  muted,
  onToggleMute,
  volume,
  onVolumeChange,
  showPhaseNotices = false,
  variant = 'default',
  persistPreferences = true,
  className,
}: NarrationLayerProps) {
  const [preferences, setPreferences] = useState<AudioPreferences>(() => ({ ...DEFAULT_PREFERENCES }));
  const [hydrated, setHydrated] = useState(false);

  // ترجیحات فقط بعد از mount خوانده می‌شوند تا رندر سرور و کلاینت یکسان بماند.
  useEffect(() => {
    if (persistPreferences) setPreferences(readPreferences(window.localStorage));
    setHydrated(true);
  }, [persistPreferences]);

  const storage = persistPreferences && typeof window !== 'undefined' ? window.localStorage : null;

  const captionsOn = preferences.captions;
  const effectiveVolume = volume !== undefined ? volume : preferences.volume;
  const effectiveMuted = muted !== undefined ? muted : preferences.muted;
  const audioVisible = onToggleMute !== undefined || onVolumeChange !== undefined;

  const duration = durationMs ?? (track === CUTSCENE_CUES ? CUTSCENE_DURATION_MS : (track[track.length - 1]?.endMs ?? 0));
  const cue = useMemo(() => cueAt(track, elapsedMs), [track, elapsedMs]);
  const notice = useMemo(
    () => (showPhaseNotices ? phaseNotice(elapsedMs, duration) : null),
    [showPhaseNotices, elapsedMs, duration],
  );

  const commit = useCallback((next: AudioPreferences) => {
    setPreferences(next);
    if (storage) writePreferences(storage, next);
  }, [storage]);

  const handleToggleCaptions = useCallback(() => {
    commit({ ...preferences, captions: !preferences.captions });
  }, [commit, preferences]);

  const handleToggleMute = useCallback(() => {
    if (onToggleMute) {
      onToggleMute();
      return;
    }
    commit(toggleMute({ ...preferences, volume: effectiveVolume }));
  }, [commit, onToggleMute, preferences, effectiveVolume]);

  const handleVolume = useCallback((next: number) => {
    const clamped = stepVolume(next, 0);
    if (onVolumeChange) onVolumeChange(clamped);
    commit({ ...preferences, volume: clamped, muted: clamped === 0 ? preferences.muted : false });
    // بالا بردن صدا در حالت بی‌صدا خودش یک حرکت کاربر است؛ همان‌جا صدا را باز می‌کنیم.
    if (clamped > 0 && effectiveMuted && onToggleMute) onToggleMute();
  }, [commit, onVolumeChange, preferences, effectiveMuted, onToggleMute]);

  // میان‌برهای صفحه‌کلید در سطح پنجره؛ ورودی‌های متنی دست‌نخورده می‌مانند.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const action = resolveAudioShortcut(
        {
          key: event.key,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          target: event.target as { tagName?: string; isContentEditable?: boolean } | null,
        },
        { muted: effectiveMuted, volume: effectiveVolume, captions: captionsOn },
      );
      if (!action) return;
      event.preventDefault();
      if (action.type === 'toggle-mute') handleToggleMute();
      else if (action.type === 'toggle-captions') handleToggleCaptions();
      else if (action.type === 'volume') handleVolume(action.volume);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [captionsOn, effectiveMuted, effectiveVolume, handleToggleCaptions, handleToggleMute, handleVolume]);

  // اعلام وضعیت صدا/زیرنویس در ناحیهٔ زنده، جدا از متن کات.
  const [status, setStatus] = useState('');
  const statusTimer = useRef<number | null>(null);
  const announce = useCallback((text: string) => {
    setStatus(text);
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(''), 2600);
  }, []);
  useEffect(() => () => {
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
  }, []);

  const mutedNow = effectiveMuted || stepVolume(effectiveVolume, 0) === 0;

  return (
    <div className={`narration-layer narration-${variant} ${className ?? ''}`.trim()} data-hydrated={hydrated ? 'true' : 'false'}>
      {cue && captionsOn && (
        <p className="narration-caption" role="status" aria-live="polite" aria-atomic="true">
          <span className="narration-chapter">{chapterLabel(cue.chapter)}</span>
          <span className="narration-text">{cue.text}</span>
          <span className="narration-clock" aria-hidden="true">{formatClock(elapsedMs)}</span>
        </p>
      )}

      {notice && (
        <p className={`narration-phase-notice tone-${notice.tone}`} role="status" aria-live="polite">
          <strong>{notice.text}</strong>
          <span>{notice.detail}</span>
        </p>
      )}

      <div className="narration-controls">
        <button
          className="narration-button"
          type="button"
          onClick={() => {
            handleToggleCaptions();
            announce(describeCaptionState(!captionsOn));
          }}
          aria-pressed={captionsOn}
          aria-label={captionsOn ? 'خاموش کردن زیرنویس (کلید C)' : 'روشن کردن زیرنویس (کلید C)'}
          title="زیرنویس (C)"
        >
          <span className="narration-button-text">{captionsOn ? 'زیرنویس روشن' : 'زیرنویس خاموش'}</span>
          <kbd aria-hidden="true">C</kbd>
        </button>

        {audioVisible && (
          <>
            <button
              className="narration-button"
              type="button"
              onClick={() => {
                if (stepVolume(effectiveVolume, 0) === 0) {
                  handleVolume(0.5);
                  announce(describeAudioState({ muted: false, volume: 0.5, captions: captionsOn }));
                  return;
                }
                const nextMuted = !mutedNow;
                handleToggleMute();
                announce(describeAudioState({ muted: nextMuted, volume: effectiveVolume, captions: captionsOn }));
              }}
              aria-pressed={!mutedNow}
              aria-label={mutedNow ? 'روشن کردن صدا (کلید M)' : 'بی‌صدا کردن (کلید M)'}
              title="صدا (M)"
            >
              <span aria-hidden="true">{mutedNow ? '🔇' : '🔊'}</span>
              <span className="narration-button-text">{mutedNow ? 'صدا خاموش' : 'صدا روشن'}</span>
              <kbd aria-hidden="true">M</kbd>
            </button>

            <label className="narration-volume">
              <span className="narration-volume-label">بلندی صدا</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={stepVolume(effectiveVolume, 0)}
                onChange={(event) => handleVolume(Number(event.target.value))}
                aria-label="بلندی صدا؛ با کلیدهای بالا و پایین تغییر می‌کند"
                aria-valuetext={volumePercentLabel(effectiveVolume)}
              />
              <span className={`narration-volume-value ${isAudible({ muted: effectiveMuted, volume: effectiveVolume, captions: captionsOn }) ? '' : 'is-off'}`}>
                {mutedNow ? 'بی‌صدا' : volumePercentLabel(effectiveVolume)}
              </span>
            </label>
          </>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">{status}</p>
    </div>
  );
}
