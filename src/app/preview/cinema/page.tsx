'use client';

/**
 * /preview/cinema — پیش‌نمایش زنده علیرضا (موج ۲)
 * -------------------------------------------------------------
 * سینمای تست مستقل کات‌سین اول‌شخص بدون نیاز به بک‌اند توحید یا صحنه‌های امیرعلی:
 * دربان دم در (۰ تا ۱۱ ثانیه) + ورود به سالن ۲۰ نفره، نشستن هم‌تیمی‌ها، باز شدن پرده،
 * رقص بانوی ایتالیایی و مرد سیاه‌پوش سمت چپ (۱۱ تا ۴۰ ثانیه) با صدای فضایی موج ۱.
 * نوار تست زمان، دکمه‌های پرش و انتخاب تعداد پلیر فقط مخصوص Preview هستند و در
 * بازی واقعی وجود ندارند (TASKS-ALIREZA.md). نیمه وحشت ۴۰ تا ۷۴ (موج ۳) نیز کامل شده و ادامه سالن تاریک در /preview/auditorium است.
 */

import { useEffect, useMemo, useState } from 'react';
import { TOTAL_CUTSCENE_DURATION_MS } from '@/contracts/types';
import { createPreviewRoomState } from '@/client-sdk';
import FirstPersonCutsceneStage from '@/components/cinema/FirstPersonCutsceneStage';
import {
  CUTSCENE_BEAT_WINDOWS,
  beatFromElapsedMs,
} from '@/audio/theater-audio-engine';
import styles from './page.module.css';

/** ترتیب نام‌ها طوری است که بازیکن «من» در فیکسچر رسمی توحید، علیرضا باشد */
const ROTATED_NAMES = ['علیرضا', 'توحید', 'امیرعلی', 'سارا', 'مریم', 'نیما', 'لیلا', 'کیان'];

function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function formatClock(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return toFaDigits(`${mm}:${ss}`);
}

const JUMP_POINTS: Array<{ label: string; atMs: number }> = [
  { label: '🚪 آغاز در', atMs: 0 },
  { label: '🕯️ ظاهر شدن دربان', atMs: 4_800 },
  { label: '🎫 تحویل بلیط‌ها', atMs: 7_800 },
  { label: '🎭 ورود به سالن', atMs: 11_000 },
  { label: '💺 نشستن پلیرها', atMs: 19_000 },
  { label: '🦢 پرده و رقص بانو', atMs: 28_000 },
  { label: '🌑 مرد سیاه‌پوش در سایه', atMs: 35_500 },
  { label: '👏 نزدیک شدن و دست زدن مرد', atMs: 41_500 },
  { label: '✋ پس زدن دست', atMs: 49_300 },
  { label: '🩸 واژگونی سالن', atMs: 51_000 },
  { label: '💥 عقب راندن پلیرها', atMs: 53_800 },
  { label: '🌪️ کوبش‌ها در سالن', atMs: 57_500 },
  { label: '💎 سقوط لوستر', atMs: 65_200 },
  { label: '👻 غیب شدن و تاریکی', atMs: 68_800 },
];

export default function CinemaPreviewPage() {
  const [playerCount, setPlayerCount] = useState(4);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 4>(1);
  const [muted, setMuted] = useState(false);

  const room = useMemo(
    () => createPreviewRoomState('theater_cutscene', playerCount, ROTATED_NAMES),
    [playerCount],
  );

  const currentBeat = beatFromElapsedMs(elapsedMs);
  const currentBeatWindow = CUTSCENE_BEAT_WINDOWS.find(
    (w) => w.beat === currentBeat,
  );

  /* ساعت پیش‌نمایش: در بازی واقعی همین elapsedMs را useTheaterSession توحید از ساعت سرور می‌سازد */
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + 50 * speed;
        if (next >= TOTAL_CUTSCENE_DURATION_MS) {
          setPlaying(false);
          return TOTAL_CUTSCENE_DURATION_MS;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [playing, speed]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>پرده سرخ: تماشاخانه اُرفه‌ئو — Preview علیرضا (موج ۲ و ۳)</p>
          <h1 className={styles.title}>کات‌سین اول‌شخص: از دربان تماشاخانه تا اجرای اپرا</h1>
          <p className={styles.subtitle}>
            تو «{room.me.playerName}» هستی — {room.me.seatLabel} (داده رسمی createPreviewRoomState توحید).
            با ماوس، انگشت یا کلیدهای جهت‌نما فقط سرت را به چپ و راست بچرخان؛ هم‌تیمی‌هایت را کنار
            صندلی‌ات ببین و کل سکانس ۷۴ ثانیه‌ای — از دربان تا واژگونی و غیب شدن — را با هدفون تماشا کن 🎧
          </p>
        </div>
        <div className={styles.countBox}>
          <span>تعداد پلیرهای سالن:</span>
          <div className={styles.countRow}>
            {[3, 4, 5, 6, 7, 8].map((count) => (
              <button
                key={count}
                type="button"
                className={
                  count === playerCount ? styles.countActive : styles.button
                }
                onClick={() => setPlayerCount(count)}
              >
                {toFaDigits(count)}
              </button>
            ))}
          </div>
          <small>
            از {toFaDigits(20)} صندلی سالن فقط {toFaDigits(playerCount)} صندلی پر است؛ بقیه خالی‌اند.
          </small>
        </div>
      </header>

      {/* استیج اصلی کات‌سین (همان کامپوننت بازی واقعی) */}
      <div className={styles.stageWrap}>
        <FirstPersonCutsceneStage
          room={room}
          elapsedMs={elapsedMs}
          muted={muted}
          onToggleMute={() => setMuted((prev) => !prev)}
        />
      </div>

      {/* نوار تست زمان — فقط Preview */}
      <section className={styles.panel}>
        <h2>⏱️ نوار تست زمان کات‌سین — فقط Preview</h2>
        <p className={styles.panelHint}>
          بیت جاری: <strong>{currentBeatWindow?.labelFa}</strong>{' '}
          <code dir="ltr">({currentBeat})</code> — زمان: {formatClock(elapsedMs)} از{' '}
          {formatClock(TOTAL_CUTSCENE_DURATION_MS)}
          {elapsedMs >= 40_000 && elapsedMs < TOTAL_CUTSCENE_DURATION_MS && (
            <> — 🩸 نیمه وحشت موج ۳ در حال پخش است؛ برای ادامه در سالن تاریک به /preview/auditorium برو.</>
          )}
        </p>
        <input
          type="range"
          min={0}
          max={TOTAL_CUTSCENE_DURATION_MS}
          step={100}
          value={elapsedMs}
          onChange={(event) => setElapsedMs(Number(event.target.value))}
          className={styles.scrubber}
          aria-label="نوار تست زمان کات‌سین"
        />
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={() => {
              if (elapsedMs >= TOTAL_CUTSCENE_DURATION_MS) setElapsedMs(0);
              setPlaying((prev) => !prev);
            }}
          >
            {playing ? '⏸ توقف' : '▶ پخش کات‌سین'}
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
              setElapsedMs(0);
            }}
          >
            ⏮ از ابتدا
          </button>
        </div>
        <div className={styles.buttonRow}>
          {JUMP_POINTS.map((point) => (
            <button
              key={point.atMs}
              type="button"
              className={styles.button}
              onClick={() => setElapsedMs(point.atMs)}
            >
              {point.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>🎬 در کات‌سین کامل چه چیزی را باید ببینی؟</h2>
        <ul className={styles.checkList}>
          <li><strong>۰ تا ۱۱ ثانیه:</strong> دریچه چشمی و قفل سنگین در باز می‌شود، «سینیور مَتِئو» با فانوس ظاهر می‌شود، دست اول‌شخص تو بلیط پانچ‌شده با نام و صندلی خودت را تحویل می‌دهد، دربان سر تکان می‌دهد و هر دو لنگه در کاملاً باز می‌شود.</li>
          <li><strong>۱۱ تا ۲۱ ثانیه:</strong> وارد سالن ۲۰ نفره می‌شوی و روی صندلی خودت می‌نشینی؛ هم‌تیمی‌ها یکی‌یکی سر جایشان می‌نشینند و با چرخاندن سر به چپ و راست با برچسب نام دیده می‌شوند؛ روبه‌رو سه سِن با پرده قرمز، تابلوهای دو دیوار و لوستر کریستالی سقف است.</li>
          <li><strong>۲۱ تا ۴۰ ثانیه:</strong> سالن تاریک می‌شود، نورهای ضعیف روی پرده می‌افتد، پرده باز می‌شود و بانوی ایتالیایی می‌رقصد؛ از ثانیه ۳۱ مرد بلندقد سیاه‌پوش در سایه سمت چپ پیداست و هرچه بیشتر به چپ نگاه کنی چهره هولناکش نمایان‌تر می‌شود.</li>
          <li><strong>۴۰ تا ۵۰ ثانیه (موج ۳):</strong> مرد از سایه به پایین سِن می‌آید، دست می‌زند و دستش را دراز می‌کند؛ بانو آواز می‌خواند و در ثانیه ۴۹.۶ دستش را پس می‌زند.</li>
          <li><strong>۵۰ تا ۶۷ ثانیه (موج ۳):</strong> نور سرخ و صحنه کثیف و ترک‌خورده می‌شود، مرد به شما خیره می‌شود و همه روی صندلی به عقب رانده می‌شوید؛ بعد زن از گلو در هوا گرفته و به در، دو دیوار، زمین و سقف کوبیده می‌شود، سالن می‌لرزد، تابلوها کج می‌شوند و لوستر سقوط می‌کند و می‌شکند.</li>
          <li><strong>۶۷ تا ۷۴ ثانیه (موج ۳):</strong> در خاموشی لحظه‌ای هر دو غیب می‌شوند؛ سالن تاریک و ویران می‌ماند و آهنگ ترسناک ادامه دارد — ادامه بازی در <strong>/preview/auditorium</strong>.</li>
          <li>در تمام مدت هیچ دکمه حرکت/زوم/Skip وجود ندارد — فقط چرخش سر بین ‎-۴۲°‎ تا ‎+۴۲°‎ و صدای استریویی که با سرت می‌چرخد.</li>
        </ul>
      </section>

      <footer className={styles.footer}>
        <p>
          خروجی موج‌های ۲ و ۳ علیرضا: <code dir="ltr">FirstPersonCutsceneStage.tsx</code> +{' '}
          <code dir="ltr">UsherDoorCutsceneView.tsx</code> +{' '}
          <code dir="ltr">AuditoriumPerformanceView.tsx</code> +{' '}
          <code dir="ltr">cutscene-timing.ts</code> (همه در <code dir="ltr">src/components/cinema</code>) —
          بر پایه دوربین و موتور صدای موج ۱ و قرارداد منجمد <code dir="ltr">API-CONTRACT.md §۴٫۳</code>.
        </p>
      </footer>
    </main>
  );
}
