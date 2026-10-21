'use client';

/**
 * /preview/cinema — پیش‌نمایش زنده علیرضا (موج ۱)
 * -------------------------------------------------------------
 * اتاق تست مستقل «دوربین اول‌شخص محدود چپ/راست + موتور صدای فضایی» بدون نیاز به
 * بک‌اند توحید یا صحنه‌های امیرعلی (توسعه ۱۰۰٪ موازی طبق TEAM.md).
 * در موج ۲ و ۳ همین صفحه به پیش‌نمایش کات‌سین کامل ۷۴ ثانیه‌ای ارتقا پیدا می‌کند؛
 * نوار تست زمان (Scrub/Play بیت‌ها) طبق TASKS-ALIREZA.md فقط مخصوص حالت Preview است
 * و در بازی واقعی وجود ندارد.
 */

import { useEffect, useRef, useState } from 'react';
import {
  TOTAL_CUTSCENE_DURATION_MS,
  type CutsceneBeatId,
} from '@/contracts/types';
import {
  getPovCameraStyle,
  usePovHeadPan,
} from '@/components/cinema/usePovHeadPan';
import {
  CUTSCENE_BEAT_WINDOWS,
  TheaterAudioEngine,
  beatFromElapsedMs,
  type SlamSurface,
} from '@/audio/theater-audio-engine';
import styles from './page.module.css';

function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function formatClock(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return toFaDigits(`${mm}:${ss}`);
}

const SLAM_BUTTONS: Array<{ surface: SlamSurface; label: string }> = [
  { surface: 'door', label: 'کوبش به در' },
  { surface: 'left-wall', label: 'کوبش به دیوار چپ' },
  { surface: 'right-wall', label: 'کوبش به دیوار راست' },
  { surface: 'floor', label: 'کوبش به زمین' },
  { surface: 'ceiling', label: 'کوبش به سقف' },
];

export default function CinemaPreviewPage() {
  const engineRef = useRef<TheaterAudioEngine | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [musicStateLabel, setMusicStateLabel] = useState('silent');

  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4>(1);
  const elapsedRef = useRef(0);
  const prevBeatRef = useRef<CutsceneBeatId | null>(null);

  const { yaw, normalizedYaw, handlers, reset } = usePovHeadPan({
    onYawChange: (nextYaw) => engineRef.current?.setHeadYaw(nextYaw),
  });

  const currentBeat = beatFromElapsedMs(elapsedMs);
  const currentBeatWindow = CUTSCENE_BEAT_WINDOWS.find(
    (w) => w.beat === currentBeat,
  );

  const getEngine = (): TheaterAudioEngine => {
    engineRef.current ??= new TheaterAudioEngine();
    return engineRef.current;
  };

  const refreshStateLabel = () => {
    if (engineRef.current) setMusicStateLabel(engineRef.current.musicState);
  };

  /* فعال‌سازی صدا باید از دل کلیک کاربر باشد (قانون Autoplay مرورگرها) */
  const handleUnlockAudio = async () => {
    const engine = getEngine();
    const ok = await engine.init();
    if (ok) {
      engine.setHeadYaw(yaw);
      engine.syncToElapsedMs(elapsedRef.current);
      setAudioReady(true);
      refreshStateLabel();
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  };

  /* همگام‌سازی صدا با بیت جاری تایملاین + شلیک توالی کوبش در نقش «لایه تصویر» */
  useEffect(() => {
    elapsedRef.current = elapsedMs;
    if (!audioReady || !engineRef.current) return;
    const beat = engineRef.current.syncToElapsedMs(elapsedMs);
    if (beat === 'choke_slams_shake_chandelier' && prevBeatRef.current !== beat) {
      // در بازی واقعی، AuditoriumPerformanceView (موج ۳) کوبش‌ها را روی فریم برخورد صدا می‌زند
      engineRef.current.playSlamSequence();
    }
    prevBeatRef.current = beat;
    refreshStateLabel();
  }, [elapsedMs, audioReady]);

  /* پخش تایملاین تستی ۷۴ ثانیه‌ای */
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + 100 * speed;
        if (next >= TOTAL_CUTSCENE_DURATION_MS) {
          setPlaying(false);
          return TOTAL_CUTSCENE_DURATION_MS;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [playing, speed]);

  /* نمایش زنده وضعیت موسیقی موتور صدا */
  useEffect(() => {
    const timer = setInterval(refreshStateLabel, 700);
    return () => clearInterval(timer);
  }, []);

  /* پاک‌سازی هنگام خروج از صفحه پیش‌نمایش */
  useEffect(() => {
    return () => {
      void engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleScrub = (value: number) => {
    // اسکراب به عقب در Preview: لایه‌ها ریست می‌شوند تا از بیت مقصد تمیز ادامه دهند
    if (value < elapsedRef.current) {
      engineRef.current?.stopAll();
      prevBeatRef.current = null;
    }
    setElapsedMs(value);
  };

  const gaugePercent = ((normalizedYaw + 1) / 2) * 100;
  const audioDisabledHint = !audioReady;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>پرده سرخ: تماشاخانه اُرفه‌ئو — Preview علیرضا (موج ۱)</p>
          <h1 className={styles.title}>اتاق تست دوربین اول‌شخص و موتور صدای فضایی</h1>
          <p className={styles.subtitle}>
            سرت را فقط به چپ و راست بچرخان (ماوس، کشیدن انگشت یا کلیدهای جهت‌نما) و با هدفون 🎧
            تغییر جهت صدای سِن را بشنو. انیمیشن کامل کات‌سین در موج ۲ و ۳ روی همین زیرساخت سوار می‌شود.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.button} onClick={reset}>
            ↩ برگرداندن سر به مرکز
          </button>
          <button type="button" className={styles.button} onClick={handleToggleMute}>
            {muted ? '🔇 باصدا کن' : '🔊 بی‌صدا کن'}
          </button>
        </div>
      </header>

      {/* ---------------- صحنه اول‌شخص شماتیک (پانورامای سالن) ---------------- */}
      <section className={styles.stage} {...handlers} aria-label="صحنه اول‌شخص سالن تئاتر">
        <div className={styles.panorama} style={getPovCameraStyle(yaw)}>
          <div className={`${styles.zone} ${styles.zoneWall}`}>
            <span className={styles.zoneIcon}>🖼️</span>
            <span>دیوار چپ سالن</span>
            <small>تابلوها + سایه مرد سیاه‌پوش</small>
          </div>
          <div className={`${styles.zone} ${styles.zoneStageSide}`}>
            <span className={styles.zoneIcon}>🎭</span>
            <span>سِن چپ</span>
            <small>پرده قرمز بلند</small>
          </div>
          <div className={`${styles.zone} ${styles.zoneStageMain}`}>
            <span className={styles.zoneIcon}>🦢</span>
            <span>سِن اصلی (مرکز)</span>
            <small>جای رقص و آواز اپرا — موج ۲</small>
          </div>
          <div className={`${styles.zone} ${styles.zoneStageSide}`}>
            <span className={styles.zoneIcon}>🎻</span>
            <span>سِن راست</span>
            <small>پرده قرمز بلند</small>
          </div>
          <div className={`${styles.zone} ${styles.zoneWall}`}>
            <span className={styles.zoneIcon}>🖼️</span>
            <span>دیوار راست سالن</span>
            <small>تابلوهای قاب‌دار</small>
          </div>
          <div className={styles.chandelier}>✦ لوستر کریستالی ✦</div>
        </div>
        <div className={styles.vignette} />
        <div className={styles.seats}>▟ صندلی تو — نمای چشم بازیکن (POV) ▙</div>

        {/* نشانگر زاویه سر */}
        <div className={styles.gauge}>
          <span>چپ {toFaDigits('42')}°-</span>
          <div className={styles.gaugeTrack}>
            <div className={styles.gaugeNeedle} style={{ insetInlineStart: `${gaugePercent}%` }} />
          </div>
          <span>راست {toFaDigits('42')}°+</span>
          <strong className={styles.gaugeValue}>
            {toFaDigits(yaw.toFixed(1))}°
          </strong>
        </div>
      </section>

      {/* ---------------- نوار تست زمان کات‌سین (فقط Preview) ---------------- */}
      <section className={styles.panel}>
        <h2>⏱️ نوار تست زمان کات‌سین — فقط Preview</h2>
        <p className={styles.panelHint}>
          بیت جاری: <strong>{currentBeatWindow?.labelFa}</strong>{' '}
          <code dir="ltr">({currentBeat})</code> — زمان: {formatClock(elapsedMs)} از{' '}
          {formatClock(TOTAL_CUTSCENE_DURATION_MS)} — وضعیت موسیقی:{' '}
          <code dir="ltr">{musicStateLabel}</code>
        </p>
        <input
          type="range"
          min={0}
          max={TOTAL_CUTSCENE_DURATION_MS}
          step={100}
          value={elapsedMs}
          onChange={(event) => handleScrub(Number(event.target.value))}
          className={styles.scrubber}
          aria-label="نوار تست زمان کات‌سین"
        />
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={() => {
              if (elapsedMs >= TOTAL_CUTSCENE_DURATION_MS) handleScrub(0);
              setPlaying((prev) => !prev);
            }}
          >
            {playing ? '⏸ توقف تایملاین' : '▶ پخش تایملاین ۷۴ ثانیه‌ای'}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => setSpeed((prev) => (prev === 1 ? 4 : 1))}
          >
            سرعت: {toFaDigits(speed)}×
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setPlaying(false);
              handleScrub(0);
            }}
          >
            ⏮ از ابتدا
          </button>
        </div>
      </section>

      {/* ---------------- کنسول تست موتور صدا ---------------- */}
      <section className={styles.panel}>
        <h2>🎚️ کنسول تست موتور صدا (Web Audio Procedural)</h2>
        {!audioReady && (
          <p className={styles.warning}>
            ⚠️ مرورگرها صدا را فقط بعد از تعامل کاربر آزاد می‌کنند؛ اول روی «فعال‌سازی صدا» کلیک کن.
            در بازی واقعی، همین فعال‌سازی روی کلیک پانچ بلیط/باز کردن قفل انجام می‌شود.
          </p>
        )}
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={handleUnlockAudio}
            disabled={audioReady}
          >
            {audioReady ? '✅ صدا فعال است' : '🔓 فعال‌سازی صدا'}
          </button>
        </div>

        <h3>قطعات موسیقی</h3>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => { getEngine().startClassical(); refreshStateLabel(); }}>
            🎼 قطعه ۱: کلاسیک ایتالیایی
          </button>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => { getEngine().startSoprano(); refreshStateLabel(); }}>
            🎤 قطعه ۲: افزودن سوپرانو
          </button>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => { getEngine().stopSoprano(); refreshStateLabel(); }}>
            توقف سوپرانو
          </button>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => { getEngine().startHorrorAmbience(1); refreshStateLabel(); }}>
            🌑 قطعه ۷: آهنگ ترسناک ماندگار
          </button>
          <button type="button" className={styles.buttonDanger} disabled={audioDisabledHint}
            onClick={() => { getEngine().stopAll(); refreshStateLabel(); }}>
            ⛔ توقف همه لایه‌ها
          </button>
        </div>

        <h3>افکت‌های سینمایی</h3>
        <div className={styles.buttonRow}>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => getEngine().playSlowClaps()}>
            👏 افکت ۳: دست زدن مرد سیاه‌پوش
          </button>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => { getEngine().playHandRejection(); refreshStateLabel(); }}>
            ✋ افکت ۴: پس زدن دست + واژگونی صدا
          </button>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => getEngine().playSeatShockwave()}>
            💥 افکت ۵: موج شوک عقب راندن پلیرها
          </button>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => getEngine().playChandelierFall()}>
            🕯️ سقوط و شکستن لوستر
          </button>
          <button type="button" className={styles.button} disabled={audioDisabledHint}
            onClick={() => { getEngine().startRoomRumble(); window.setTimeout(() => engineRef.current?.stopRoomRumble(), 4000); }}>
            📳 غرش لرزش سالن (۴ ثانیه)
          </button>
        </div>

        <h3>افکت ۶: کوبیده شدن به سطوح سالن (با هدفون، جهت هر ضربه را بشنو)</h3>
        <div className={styles.buttonRow}>
          {SLAM_BUTTONS.map(({ surface, label }) => (
            <button
              key={surface}
              type="button"
              className={styles.button}
              disabled={audioDisabledHint}
              onClick={() => getEngine().playBodySlam(surface)}
            >
              {label}
            </button>
          ))}
          <button type="button" className={styles.buttonPrimary} disabled={audioDisabledHint}
            onClick={() => { getEngine().startRoomRumble(); getEngine().playSlamSequence(); window.setTimeout(() => engineRef.current?.stopRoomRumble(), 11_000); }}>
            🎬 توالی کامل کوبش‌ها + لوستر (۱۱ ثانیه)
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>
          راهنمای کنترل — دسکتاپ: حرکت ماوس روی صحنه یا کلیدهای → و ← | موبایل: کشیدن انگشت روی
          صحنه. محدودیت سناریو: در کات‌سین واقعی هیچ دکمه، حرکت آزاد یا Skip وجود ندارد؛ فقط همین
          چرخش سر بین ‎-۴۲°‎ تا ‎+۴۲°‎.
        </p>
        <p>
          خروجی موج ۱ علیرضا: <code dir="ltr">src/components/cinema/usePovHeadPan.ts</code> +{' '}
          <code dir="ltr">src/audio/theater-audio-engine.ts</code> + تست‌های{' '}
          <code dir="ltr">tests/alireza</code>
        </p>
      </footer>
    </main>
  );
}
