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
 * موج ۳: نیمه وحشت ۴۰ تا ۷۴ + شلیک دقیق افکت‌های صوتی برخورد (پس زدن دست، کوبش‌ها و
 * سقوط لوستر روی کی‌فریم‌های cutscene-timing) و خاموشی لحظه غیب شدن کاراکترها.
 */

import { useEffect, useRef, useState } from 'react';
import {
  DOOR_CUTSCENE_DURATION_MS,
  TOTAL_CUTSCENE_DURATION_MS,
  type ClientRoomView,
} from '../../contracts/types';
import { TheaterAudioEngine } from '../../audio/theater-audio-engine';
import { usePovHeadPan } from './usePovHeadPan';
import {
  CHANDELIER_FALL_AT_MS,
  HAND_REJECTION_AT_MS,
  SLAM_IMPACTS,
  progressBetween,
} from './cutscene-timing';
import UsherDoorCutsceneView from './UsherDoorCutsceneView';
import AuditoriumPerformanceView from './AuditoriumPerformanceView';
import ThreeCutsceneView from './ThreeCutsceneView';
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
  const [threeReady, setThreeReady] = useState(false);

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

  /* رویدادهای صوتی یک‌باره موج ۳ که زمان‌بندی شده‌اند (برای جلوگیری از شلیک دوباره در هر فریم) */
  const scheduledOneShotsRef = useRef<Set<string>>(new Set());

  /* قلب همگام‌سازی صوتی: فقط elapsedMs سرور، بدون تایمر محلی */
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const prev = prevElapsedRef.current;
    // پرش به عقب فقط در اسکراب Preview رخ می‌دهد: لایه‌ها ریست و از بیت مقصد ادامه
    if (clampedElapsed < prev - 300) {
      engine.stopAll();
      scheduledOneShotsRef.current.clear();
    }
    prevElapsedRef.current = clampedElapsed;
    engine.syncToElapsedMs(clampedElapsed);

    /* --- شلیک دقیق افکت‌های موج ۳ روی فریم انیمیشن متناظر --- */
    // لحظه پس زدن دست مرد توسط زن (عبور رو به جلو از آستانه)
    if (prev < HAND_REJECTION_AT_MS && clampedElapsed >= HAND_REJECTION_AT_MS) {
      engine.playHandRejection();
    }
    // کوبش‌ها و سقوط لوستر با تأخیر صوتی دقیق نسبت به کی‌فریم برخورد تصویر
    if (clampedElapsed >= 55_000 && clampedElapsed < 67_500) {
      for (const impact of SLAM_IMPACTS) {
        const key = `slam-${impact.atMs}`;
        if (impact.atMs >= clampedElapsed && !scheduledOneShotsRef.current.has(key)) {
          engine.playBodySlam(impact.surface, (impact.atMs - clampedElapsed) / 1000);
          scheduledOneShotsRef.current.add(key);
        }
      }
      if (
        CHANDELIER_FALL_AT_MS >= clampedElapsed &&
        !scheduledOneShotsRef.current.has('chandelier')
      ) {
        engine.playChandelierFall((CHANDELIER_FALL_AT_MS - clampedElapsed) / 1000);
        scheduledOneShotsRef.current.add('chandelier');
      }
    }
  }, [clampedElapsed]);

  // فید سیاه سینمایی در مرز گذر از در به سالن (۱۰.۲ تا ۱۱.۹ ثانیه)
  const doorFade = inDoorScene
    ? progressBetween(clampedElapsed, 10_200, DOOR_CUTSCENE_DURATION_MS) * 0.92
    : (1 - progressBetween(clampedElapsed, DOOR_CUTSCENE_DURATION_MS, 11_900)) * 0.92;
  // خاموشی لحظه‌ای غیب شدن هر دو کاراکتر (۶۶.۸ تا ۶۸.۶ ثانیه — موج ۳)
  const vanishBlackout =
    Math.sin(progressBetween(clampedElapsed, 66_800, 68_600) * Math.PI) * 0.96;
  const blackFade = Math.max(doorFade, vanishBlackout);

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
      <ThreeCutsceneView elapsedMs={clampedElapsed} yaw={yaw} onReady={setThreeReady} />
      <div
        className={styles.cssFallback}
        style={{ display: threeReady ? 'none' : undefined }}
        aria-hidden={threeReady}
      >
        {!threeReady && (inDoorScene ? (
          <UsherDoorCutsceneView room={room} elapsedMs={clampedElapsed} yaw={yaw} />
        ) : (
          <AuditoriumPerformanceView room={room} elapsedMs={clampedElapsed} yaw={yaw} />
        ))}
      </div>

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
