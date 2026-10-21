'use client';

/**
 * FirstPersonCutsceneStage — کارگردان اصلی کات‌سین اول‌شخص ۷۴ ثانیه‌ای (علیرضا)
 * -----------------------------------------------------------------------------------
 * قرارداد رسمی: API-CONTRACT.md بخش ۴.۳ — امضای پراپ‌ها دقیقاً طبق سند است.
 * مسئولیت‌ها:
 *  - سوئیچ بین کات‌سین دربان (۰ تا ۱۱ ثانیه) و سالن تئاتر (۱۱ تا ۷۴ ثانیه) با فید سیاه سینمایی؛
 *  - اتصال دوربین محدود چرخش سر (usePovHeadPan) به هر دو صحنه و به پن استریوی موتور صدا؛
 *  - همگام‌سازی صدا با elapsedMs ساعت سرور (syncToElapsedMs) بدون هیچ تایمر محلی تصویری؛
 *  - قفل سخت‌گیرانه سناریو: در کل کات‌سین هیچ دکمه حرکت، زوم، Skip یا کلیک تعاملی وجود
 *    ندارد — تنها استثنا دکمه بی‌صدا کردن (طبق قرارداد) و دکمه «فعال‌کردن صدا» است که
 *    فقط تا لحظه آزاد شدن صدای مرورگر دیده می‌شود و بعد برای همیشه ناپدید می‌شود.
 *
 * موج ۲: بخش تصویری ثانیه ۰ تا ۴۰ (دربان + ورود و نشستن + اجرای اپرا و مرد سیاه‌پوش).
 * موج ۳: نیمه وحشت ۴۰ تا ۷۴ روی همین استیج و داخل AuditoriumPerformanceView تکمیل می‌شود.
 */

import { useEffect, useRef, useState } from 'react';
import {
  DOOR_CUTSCENE_DURATION_MS,
  TOTAL_CUTSCENE_DURATION_MS,
  type ClientRoomView,
} from '../../contracts/types';
import { TheaterAudioEngine } from '../../audio/theater-audio-engine';
import { usePovHeadPan } from './usePovHeadPan';
import { progressBetween } from './cutscene-timing';
import UsherDoorCutsceneView from './UsherDoorCutsceneView';
import AuditoriumPerformanceView from './AuditoriumPerformanceView';
import styles from './FirstPersonCutsceneStage.module.css';

export interface FirstPersonCutsceneStageProps {
  room: ClientRoomView;
  /** ۰ تا ۷۴٬۰۰۰ میلی‌ثانیه (०..۱۱٬۰۰۰ درب ورودی | ۱۱٬۰۰۰..۷۴٬۰۰۰ سالن تئاتر) */
  elapsedMs: number;
  muted: boolean;
  onToggleMute: () => void;
}

export default function FirstPersonCutsceneStage({
  room,
  elapsedMs,
  muted,
  onToggleMute,
}: FirstPersonCutsceneStageProps) {
  const engineRef = useRef<TheaterAudioEngine | null>(null);
  const prevElapsedRef = useRef(0);
  const [audioRunning, setAudioRunning] = useState(false);

  const { yaw, handlers } = usePovHeadPan({
    onYawChange: (nextYaw) => engineRef.current?.setHeadYaw(nextYaw),
  });

  const clampedElapsed = Math.min(
    Math.max(0, elapsedMs),
    TOTAL_CUTSCENE_DURATION_MS,
  );
  const inDoorScene = clampedElapsed < DOOR_CUTSCENE_DURATION_MS;

  const getEngine = (): TheaterAudioEngine => {
    engineRef.current ??= new TheaterAudioEngine();
    return engineRef.current;
  };

  const tryUnlockAudio = async () => {
    const engine = getEngine();
    await engine.init();
    engine.setMuted(muted);
    engine.setHeadYaw(yaw);
    engine.syncToElapsedMs(clampedElapsed);
    setAudioRunning(engine.contextState === 'running');
  };

  /* ساخت موتور صدا و تلاش برای فعال‌سازی (در جریان واقعی بازی، کلیک‌های قبلی
     بازیکن مثل پانچ بلیط معمولاً صدا را از قبل آزاد کرده‌اند) */
  useEffect(() => {
    let cancelled = false;
    const engine = getEngine();
    void engine.init().then(() => {
      if (!cancelled) setAudioRunning(engine.contextState === 'running');
    });
    engine.setMuted(muted);
    const watcher = setInterval(() => {
      setAudioRunning(engine.contextState === 'running');
    }, 900);
    return () => {
      cancelled = true;
      clearInterval(watcher);
      void engine.dispose();
      engineRef.current = null;
    };
    // فقط هنگام ماونت/آنماونت استیج
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* همگام‌سازی وضعیت بی‌صدا با قرارداد کامپوننت */
  useEffect(() => {
    engineRef.current?.setMuted(muted);
  }, [muted]);

  /* قلب همگام‌سازی صوتی: فقط elapsedMs سرور، بدون تایمر محلی */
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    // پرش به عقب فقط در اسکراب Preview رخ می‌دهد: لایه‌ها ریست و از بیت مقصد ادامه
    if (clampedElapsed < prevElapsedRef.current - 300) {
      engine.stopAll();
    }
    prevElapsedRef.current = clampedElapsed;
    engine.syncToElapsedMs(clampedElapsed);
  }, [clampedElapsed]);

  // فید سیاه سینمایی در مرز گذر از در به سالن (۱۰.۲ تا ۱۱.۹ ثانیه)
  const blackFade = inDoorScene
    ? progressBetween(clampedElapsed, 10_200, DOOR_CUTSCENE_DURATION_MS) * 0.92
    : (1 - progressBetween(clampedElapsed, DOOR_CUTSCENE_DURATION_MS, 11_900)) * 0.92;

  return (
    <section
      className={styles.stageRoot}
      aria-label="کات‌سین اول‌شخص تماشاخانه اُرفه‌ئو"
      {...handlers}
      onPointerDown={(event) => {
        handlers.onPointerDown(event);
        // هر لمس بازیکن یک فرصت قانونی برای آزاد کردن صدای مرورگر است (بدون هیچ تعامل گیم‌پلی)
        if (!audioRunning) void tryUnlockAudio();
      }}
    >
      {inDoorScene ? (
        <UsherDoorCutsceneView room={room} elapsedMs={clampedElapsed} yaw={yaw} />
      ) : (
        <AuditoriumPerformanceView room={room} elapsedMs={clampedElapsed} yaw={yaw} />
      )}

      {/* وینیت سینمایی + فید گذر بین سکانس‌ها */}
      <div className={styles.vignette} aria-hidden="true" />
      {blackFade > 0.01 && (
        <div
          className={styles.blackFade}
          style={{ opacity: blackFade }}
          aria-hidden="true"
        />
      )}

      {/* HUD مینیمال سینمایی — بدون هیچ کنترل گیم‌پلی */}
      <div className={styles.hud}>
        <div className={styles.playerChip}>
          🎭 {room.me.playerName} — {room.me.seatLabel}
        </div>
        <div
          className={styles.hintChip}
          style={{ opacity: clampedElapsed < 8_000 ? 0.95 : 0.4 }}
        >
          ↔ فقط سرت را به چپ و راست بچرخان
        </div>
        <button
          type="button"
          className={styles.muteButton}
          onClick={() => {
            if (!audioRunning) void tryUnlockAudio();
            onToggleMute();
          }}
          aria-label={muted ? 'باصدا کردن کات‌سین' : 'بی‌صدا کردن کات‌سین'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* تنها دکمه مجاز دیگر: آزاد کردن صدای مرورگر (به‌محض فعال شدن برای همیشه محو می‌شود) */}
      {!audioRunning && (
        <button
          type="button"
          className={styles.unlockButton}
          onClick={() => void tryUnlockAudio()}
        >
          🔊 فعال‌کردن صدای کات‌سین
        </button>
      )}
    </section>
  );
}
