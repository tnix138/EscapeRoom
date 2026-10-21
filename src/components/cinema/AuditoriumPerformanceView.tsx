/**
 * AuditoriumPerformanceView — کات‌سین POV داخل سالن تئاتر (از ثانیه ۱۱ تا ۷۴) — علیرضا
 * ----------------------------------------------------------------------------------------
 * منبع: TASKS-ALIREZA.md موج ۲ بندهای ۲ و ۳ + موج ۳ بندهای ۱ تا ۳ + PROJECT.md گام ۵
 * موج ۲: ورود به سالن ۲۰ نفره ← نشستن فقط پلیرهای اتاق ← سه سِن قرمز، تابلوها و لوستر
 *        ← نور ضعیف و باز شدن پرده ← رقص بانوی ایتالیایی ← مرد سیاه‌پوش در سایه چپ.
 * موج ۳: نزدیک شدن مرد، دست زدن و دراز کردن دست ← آواز زن و پس زدن دست (ثانیه ۴۹.۶)
 *        ← واژگونی قرمز و کثیف شدن صحنه و ترس زن ← نگاه مرد و عقب راندن پلیرها
 *        ← گرفتن گلو از دور و کوبیدن زن به در/دیوارها/زمین/سقف روی کی‌فریم‌های
 *        SLAM_IMPACTS ← لرزش سالن، کج شدن تابلوها، سقوط و خرد شدن لوستر
 *        ← غیب شدن هر دو در خاموشی لحظه‌ای و ماندن سالن تاریک با آهنگ ترسناک.
 * همه‌چیز فقط تابع elapsedMs سرور است (cutscene-timing.ts)؛ تنها ورودی پلیر چرخش سر است.
 */

import type { ClientRoomView, PlayerSeatPublicView } from '../../contracts/types';
import { getPovCameraStyle, yawToNormalized } from './usePovHeadPan';
import {
  clamp01,
  getAuditoriumTimeline,
  teammateSettleProgress,
  victimPoseAt,
} from './cutscene-timing';
import { getStoryDialogueAt } from './story-script';
import styles from './AuditoriumPerformanceView.module.css';

export interface AuditoriumPerformanceViewProps {
  room: ClientRoomView;
  /** زمان سپری‌شده کات‌سین از آغاز سکانس در (میلی‌ثانیه) */
  elapsedMs: number;
  /** زاویه چرخش سر بازیکن در بازه [-42, +42] */
  yaw: number;
}

const PLAYER_COLORS = [
  '#5b2a86', '#1f5f7a', '#7a1626', '#2e6b34',
  '#8a6a24', '#37474f', '#6d3b1f', '#7a2e5f',
] as const;

/** تابلوهای دو دیوار سالن و زاویه نهایی کج شدن هرکدام در اوج وحشت (درجه) */
const LEFT_PAINTINGS = [
  { icon: '🎭', label: 'نقاب سرخ', finalTiltDeg: -17 },
  { icon: '🦢', label: 'قوی دریاچه', finalTiltDeg: 11 },
] as const;
const RIGHT_PAINTINGS = [
  { icon: '🎻', label: 'ویولن طلایی', finalTiltDeg: 15 },
  { icon: '🌹', label: 'رز مخملی', finalTiltDeg: -9 },
] as const;

const CHOKE_START_MS = 56_000;

function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function auditoriumCaption(elapsedMs: number, playerCount: number): string {
  if (elapsedMs < 21_000)
    return `سالنی کوچک با ۲۰ صندلی مخملی… و فقط شما ${toFaDigits(playerCount)} نفر. بقیه‌ی صندلی‌ها کاملاً خالی‌اند.`;
  if (elapsedMs < 26_000) return 'چراغ‌های سالن خاموش می‌شوند و نورهایی کم‌سو روی چین‌های پرده‌ی سرخ می‌لغزند…';
  if (elapsedMs < 31_000) return 'پرده کنار می‌رود؛ بانویی با لباس کلاسیک ایتالیایی اجرای موزیکال خود را آغاز می‌کند.';
  if (elapsedMs < 36_000) return 'در سایه‌ی سمت چپ صحنه چیزی تکان می‌خورد… سرت را به آرامی به سمت چپ بچرخان.';
  if (elapsedMs < 40_000) return 'مردی بلندقد و سیاه‌پوش، با چهره‌ای هولناک، بی‌حرکت در سایه ایستاده و محو رقص اوست.';
  if (elapsedMs < 45_500) return 'مرد آرام‌آرام از سایه بیرون می‌آید، پایین سِن می‌ایستد و با لذتی مرموز دست می‌زند…';
  if (elapsedMs < 49_600) return 'دستش را به سوی بانو دراز می‌کند؛ اما او بی‌اعتنا می‌رقصد و آواز سر می‌دهد…';
  if (elapsedMs < 53_000) return 'دست مرد پس زده می‌شود — و ناگهان همه‌چیز واژگون می‌شود! نور به سرخی خون می‌گراید و وحشت، زن را دربر می‌گیرد.';
  if (elapsedMs < 56_000) return 'مرد برمی‌گردد و مستقیم به شما خیره می‌شود… موجی سهمگین همه‌تان را روی صندلی‌ها به عقب می‌راند!';
  if (elapsedMs < 65_500) return 'دستش بالا می‌رود؛ گلوی زن از راه دور در هوا گرفته می‌شود و پیکرش به در و دیوار و زمین و سقف سالن کوبیده می‌شود!';
  if (elapsedMs < 67_000) return 'سالن می‌لرزد، تابلوها کج می‌شوند و لوستر کریستالی از سقف کنده می‌شود…';
  return 'هر دو غیب شده‌اند… اما آهنگ ترسناک هنوز در سالن تاریک و ویران ادامه دارد و درها قفل مانده‌اند.';
}

const PLAYER_SKINS = [
  '#e4be9c', '#d9ad87', '#ecd0b6', '#cf9f78',
  '#e0b592', '#dfb896', '#d4a37d', '#ead0b8',
] as const;

const PLAYER_HAIRS = [
  '#221710', '#3b2516', '#151218', '#4d311d',
  '#2c221b', '#1c1820', '#3f2818', '#251a14',
] as const;

/** نیم‌تنه انسانی هم‌تیمی نشسته (سر، گردن، یقه، کت و اجزای کامل چهره) با رنگ اختصاصی صندلی او */
function PlayerBust({ player, small = false }: { player: PlayerSeatPublicView; small?: boolean }) {
  const idx = Math.max(0, player.seatIndex);
  const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
  const skin = PLAYER_SKINS[idx % PLAYER_SKINS.length];
  const hair = PLAYER_HAIRS[idx % PLAYER_HAIRS.length];
  const hairVariant = idx % 3;

  return (
    <svg
      viewBox="0 0 120 120"
      className={small ? styles.bustSvgSmall : styles.bustSvg}
      role="img"
      aria-label={`هم‌تیمی: ${player.playerName}`}
    >
      {/* شانه‌ها و کت تئاتر */}
      <path d="M12 120 C16 90 34 80 60 80 C86 80 104 90 108 120 Z" fill={color} />
      {/* پیراهن و دستمال گردن */}
      <path d="M47 81 L60 108 L73 81 Z" fill="#f1e6d2" />
      <path d="M56 84 L60 106 L64 84 Z" fill="#8b1e2f" />
      {/* یقه برگردان کت */}
      <path d="M44 80 L55 110 L47 112 L37 85 Z" fill="rgba(12,8,16,0.38)" />
      <path d="M76 80 L65 110 L73 112 L83 85 Z" fill="rgba(12,8,16,0.38)" />
      {/* سنجاق طلایی بلیط روی سینه */}
      <rect x="74" y="96" width="8" height="4.5" rx="1.2" fill="#d4af63" />

      {/* گردن و سایه زیر چانه */}
      <rect x="52" y="68" width="16" height="16" rx="6" fill={skin} />
      <path d="M52 72 Q60 77 68 72 L68 76 Q60 80 52 76 Z" fill="rgba(40,22,12,0.18)" />

      {/* موی پشت سر (برای مدل‌های موی بلندتر) */}
      {hairVariant === 1 && (
        <path d="M34 52 Q30 72 38 82 L82 82 Q90 72 86 52 Z" fill={hair} />
      )}

      {/* گوش‌ها */}
      <ellipse cx="37" cy="54" rx="4.2" ry="6.5" fill={skin} />
      <ellipse cx="83" cy="54" rx="4.2" ry="6.5" fill={skin} />

      {/* فرم سر و فک انسان */}
      <path
        d="M38 48 C38 30 47 24 60 24 C73 24 82 30 82 48 C82 61 73 73 60 74 C47 73 38 61 38 48 Z"
        fill={skin}
      />

      {/* ابروها */}
      <path d="M44 46 Q50 43.5 55 45.5" stroke={hair} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M65 45.5 Q70 43.5 76 46" stroke={hair} strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* چشم‌ها (صلبیه، عنبیه، مردمک و برق چشم) */}
      <ellipse cx="50" cy="51.5" rx="4.2" ry="2.7" fill="#faf4ea" />
      <ellipse cx="70" cy="51.5" rx="4.2" ry="2.7" fill="#faf4ea" />
      <circle cx="50" cy="51.5" r="2.2" fill="#2b1d14" />
      <circle cx="70" cy="51.5" r="2.2" fill="#2b1d14" />
      <circle cx="50.8" cy="50.8" r="0.7" fill="#ffffff" />
      <circle cx="70.8" cy="50.8" r="0.7" fill="#ffffff" />

      {/* بینی */}
      <path d="M60 49 L58.5 58.5 Q60 60 62 58.5" stroke="rgba(90,52,32,0.48)" strokeWidth="1.7" fill="none" strokeLinecap="round" />

      {/* لب‌ها */}
      <path d="M53.5 64.5 Q60 67.2 66.5 64.5" stroke="#8e4e3b" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <path d="M56 66.5 Q60 68 64 66.5" stroke="rgba(110,55,40,0.45)" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* موی سر با حالت‌های متنوع انسانی */}
      {hairVariant === 0 && (
        <path
          d="M36 50 C35 30 46 20 60 20 C75 20 85 30 84 50 C80 39 73 34 62 35 C50 36 42 40 36 50 Z"
          fill={hair}
        />
      )}
      {hairVariant === 1 && (
        <path
          d="M35 51 C35 29 46 19 60 19 C74 19 85 29 85 51 C81 38 71 33 60 33 C49 33 39 38 35 51 Z"
          fill={hair}
        />
      )}
      {hairVariant === 2 && (
        <>
          <circle cx="60" cy="18" r="7.5" fill={hair} />
          <path
            d="M36 49 C36 29 46 21 60 21 C74 21 84 29 84 49 C78 37 69 34 60 34 C51 34 42 37 36 49 Z"
            fill={hair}
          />
        </>
      )}
    </svg>
  );
}

/**
 * پیکره بانوی ایتالیایی — هم روی سِن (رقص/آواز/ترس) و هم در لایه پرتاب سالن (قربانی)
 * استفاده می‌شود تا در فریم شروع خفگی، بدن بدون هیچ پرشی از صحنه به هوا منتقل شود.
 */
function DancerFigure({
  armDeg,
  skirtFlare,
  mouthOpen,
  fear,
  choked,
}: {
  armDeg: number;
  skirtFlare: number;
  mouthOpen: number;
  fear: number;
  choked: boolean;
}) {
  const fearful = fear > 0.4;
  return (
    <svg viewBox="0 0 200 300" className={styles.dancerSvg} role="img" aria-label="بانوی خواننده و رقصنده ایتالیایی">
      <g style={{ transform: `scaleX(${skirtFlare.toFixed(3)})`, transformOrigin: '100px 150px' }}>
        <path d="M100 138 Q52 190 34 272 Q100 292 166 272 Q148 190 100 138Z" fill="#8e1f33" />
        <path d="M100 150 Q66 198 54 264 Q100 278 146 264 Q134 198 100 150Z" fill="#c9a86a" opacity="0.85" />
        <path d="M100 162 Q78 204 72 256 Q100 266 128 256 Q122 204 100 162Z" fill="#f3e3bb" />
      </g>
      <path d="M82 146 Q84 104 100 100 Q116 104 118 146 Q100 154 82 146Z" fill="#5d1120" />
      {choked ? (
        <>
          {/* دست‌های خودش چنگ‌زنان بر گلو، زیر دست سایه‌ای نامرئی */}
          <path d="M84 112 Q92 96 97 92" stroke="#e6c39a" strokeWidth="8.5" fill="none" strokeLinecap="round" />
          <path d="M116 112 Q108 96 103 92" stroke="#e6c39a" strokeWidth="8.5" fill="none" strokeLinecap="round" />
          <ellipse cx="100" cy="93" rx="11" ry="6.5" fill="rgba(5,2,10,0.88)" />
        </>
      ) : (
        <>
          <g style={{ transform: `rotate(${(armDeg - 18).toFixed(1)}deg)`, transformOrigin: '84px 110px' }}>
            <path d="M84 110 Q58 92 44 64" stroke="#e6c39a" strokeWidth="9" fill="none" strokeLinecap="round" />
          </g>
          <g style={{ transform: `rotate(${(-armDeg + 18).toFixed(1)}deg)`, transformOrigin: '116px 110px' }}>
            <path d="M116 110 Q142 92 156 64" stroke="#e6c39a" strokeWidth="9" fill="none" strokeLinecap="round" />
          </g>
        </>
      )}
      <circle cx="100" cy="76" r="21" fill="#e6c39a" />
      <path d="M79 74 Q80 52 100 51 Q120 52 121 74 Q112 60 100 61 Q88 60 79 74Z" fill="#3a2310" />
      <circle cx="100" cy="48" r="9" fill="#3a2310" />
      {fearful ? (
        <>
          <circle cx="92" cy="77" r="4.6" fill="#fdf6e8" />
          <circle cx="108" cy="77" r="4.6" fill="#fdf6e8" />
          <circle cx="92" cy="78" r="1.7" fill="#120801" />
          <circle cx="108" cy="78" r="1.7" fill="#120801" />
          <path d="M85 67 L98 70 M115 67 L102 70" stroke="#3a2310" strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="92" cy="77" r="2" fill="#2b1c10" />
          <circle cx="108" cy="77" r="2" fill="#2b1c10" />
        </>
      )}
      {mouthOpen > 0.06 && !choked ? (
        <ellipse cx="100" cy="89" rx="3.6" ry={(1.6 + mouthOpen * 4.6).toFixed(2)} fill="#4a0e1e" />
      ) : fearful ? (
        <ellipse cx="100" cy="90" rx="4.4" ry="3.4" fill="#4a0e1e" />
      ) : (
        <path d="M93 88 Q100 92 107 88" stroke="#8e4b2f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}
      <path d="M96 292 L100 272 L105 292Z" fill="#e6c39a" />
    </svg>
  );
}

export default function AuditoriumPerformanceView({
  room,
  elapsedMs,
  yaw,
}: AuditoriumPerformanceViewProps) {
  const tl = getAuditoriumTimeline(elapsedMs);
  const normalizedYaw = yawToNormalized(yaw);
  const pov = getPovCameraStyle(yaw, 16);

  const me = room.me;
  const others = room.players.filter((p) => p.playerId !== me.playerId);
  const leftNeighbors = others
    .filter((p) => p.auditoriumRow === me.auditoriumRow && p.auditoriumCol < me.auditoriumCol)
    .sort((a, b) => b.auditoriumCol - a.auditoriumCol);
  const rightNeighbors = others
    .filter((p) => p.auditoriumRow === me.auditoriumRow && p.auditoriumCol > me.auditoriumCol)
    .sort((a, b) => a.auditoriumCol - b.auditoriumCol);
  const frontRowOccupants = new Map(
    others
      .filter((p) => p.auditoriumRow === me.auditoriumRow - 1)
      .map((p) => [p.auditoriumCol, p] as const),
  );

  const lookLeftFactor = clamp01((-yaw - 6) / 28);
  const darkness =
    0.18 +
    tl.houseDimProgress * 0.5 -
    tl.stageGlowProgress * 0.22 +
    tl.inversionProgress * 0.1 +
    tl.finalDarknessProgress * 0.16;

  const inChokeFlight = elapsedMs >= CHOKE_START_MS && tl.vanishProgress < 1;
  const victimPose = victimPoseAt(elapsedMs);
  const performersOpacity = 1 - tl.vanishProgress;
  const fearTremblePx = Math.sin(elapsedMs * 0.09) * 1.7 * tl.womanFearProgress;
  const worldScale =
    (1.15 - 0.15 * tl.entryProgress) * (1 - 0.055 * tl.playerPushPulse);

  const paintingStyle = (finalTiltDeg: number, index: number) => ({
    transform: `rotate(${(finalTiltDeg * tl.paintingsTiltProgress + Math.sin(elapsedMs * 0.1 + index * 1.7) * Math.abs(tl.cameraShakeX) * 0.12).toFixed(2)}deg)`,
    filter: `brightness(${(1 - tl.stageGrimeProgress * 0.45).toFixed(2)})`,
  });

  const neighborStyle = (
    player: PlayerSeatPublicView,
    side: 'left' | 'right',
    distance: number,
  ) => {
    const settle = teammateSettleProgress(player.seatIndex, elapsedMs);
    const inwardPx = (side === 'left' ? -yaw : yaw) * 2.1;
    const pushBackPx = tl.playerPushPulse * 14; // هم‌تیمی‌ها هم روی صندلی به عقب رانده می‌شوند
    return {
      settle,
      style: {
        opacity: settle,
        transform: `translate(${(inwardPx * (1 - distance * 0.25) + tl.cameraShakeX * 0.7).toFixed(1)}px, ${((1 - settle) * 46 + pushBackPx).toFixed(1)}px) scale(${((1 - distance * 0.16) * (1 - tl.playerPushPulse * 0.07)).toFixed(2)})`,
        zIndex: 10 - distance,
      } as const,
    };
  };

  return (
    <div className={styles.scene} aria-label="کات‌سین داخل سالن تئاتر">
      {/* ============ لایه دنیای سالن (پانورامای پهن‌تر از کادر) ============ */}
      <div
        className={styles.world}
        style={{
          ...pov,
          transform: `${pov.transform} translate(${tl.cameraShakeX.toFixed(1)}px, ${(((1 - tl.seatedProgress) * 3.2) + tl.cameraShakeY * 0.08 + tl.playerPushPulse * 1.4).toFixed(2)}%) rotate(${(tl.playerPushPulse * 0.8).toFixed(2)}deg) scale(${worldScale.toFixed(3)})`,
        }}
      >
        {/* دیوار چپ + تابلوها (در موج ۳ کج می‌شوند) */}
        <div className={`${styles.wall} ${styles.wallSide}`}>
          {LEFT_PAINTINGS.map((painting, i) => (
            <div key={painting.label} className={styles.painting} style={paintingStyle(painting.finalTiltDeg, i)}>
              <span>{painting.icon}</span><small dir="rtl">{painting.label}</small>
            </div>
          ))}
          <div className={styles.grime} style={{ opacity: tl.stageGrimeProgress }} />
        </div>

        {/* سِن چپ (پرده بسته — ناحیه سایه مرد سیاه‌پوش) */}
        <div className={`${styles.stageSide} ${styles.stageLeft}`}>
          <div className={styles.valance} />
          <div
            className={styles.curtainClosed}
            style={{ filter: `brightness(${(1 - tl.stageGrimeProgress * 0.55).toFixed(2)}) saturate(${(1 - tl.stageGrimeProgress * 0.4).toFixed(2)})` }}
          />
          <div className={styles.shadowPool} style={{ opacity: 0.55 + tl.darkManReveal * 0.3 }} />
          <div className={styles.grime} style={{ opacity: tl.stageGrimeProgress }} />
        </div>

        {/* سِن اصلی مرکز */}
        <div className={styles.stageCenter}>
          <div
            className={styles.stageBackdrop}
            style={{
              opacity: 0.25 + tl.stageGlowProgress * 0.75 - tl.finalDarknessProgress * 0.35,
              filter: `hue-rotate(${(-tl.inversionProgress * 28).toFixed(0)}deg) brightness(${(1 - tl.stageGrimeProgress * 0.4).toFixed(2)})`,
            }}
          />
          {[18, 42, 66].map((leftPct) => (
            <div
              key={leftPct}
              className={styles.spotCone}
              style={{
                left: `${leftPct}%`,
                opacity:
                  tl.spotlightsProgress *
                  (0.35 + tl.stageGlowProgress * 0.5) *
                  (1 - tl.finalDarknessProgress * 0.75),
                filter: `hue-rotate(${(-tl.inversionProgress * 38).toFixed(0)}deg) saturate(${(1 + tl.inversionProgress * 1.4).toFixed(2)})`,
              }}
            />
          ))}

          {/* بانوی ایتالیایی روی سِن (از لحظه خفگی، لایه پرتاب سالن جای او را می‌گیرد) */}
          {!inChokeFlight && (
            <div
              className={styles.dancerWrap}
              style={{
                opacity: tl.dancerReveal * performersOpacity,
                transform: `translateX(calc(-50% + ${(tl.dancerTravelX * 84 + fearTremblePx).toFixed(1)}px)) translateY(${(-tl.dancerBob * 6).toFixed(1)}px) rotate(${tl.dancerSwayDeg.toFixed(2)}deg)`,
                filter: `brightness(${(1 - tl.inversionProgress * 0.28).toFixed(2)})`,
              }}
            >
              <DancerFigure
                armDeg={tl.dancerArmDeg}
                skirtFlare={tl.dancerSkirtFlare}
                mouthOpen={tl.womanMouthOpen}
                fear={tl.womanFearProgress}
                choked={false}
              />
            </div>
          )}

          {/* مرد بلندقد سیاه‌پوش: سایه چپ ← نزدیک شدن و دست زدن ← دست دراز ← خیره و خفگی */}
          <div
            className={styles.darkManWrap}
            style={{
              opacity: tl.darkManReveal * performersOpacity,
              left: `${(4 + tl.manApproachProgress * 33).toFixed(1)}%`,
              bottom: `${(7 - tl.manApproachProgress * 2.5).toFixed(1)}%`,
              transform: `translateX(${((1 - tl.darkManReveal) * -22).toFixed(1)}px) scale(${((1 + tl.darkManBreath * 0.016) * (1 + tl.manApproachProgress * 0.24) * (1 + tl.playerPushPulse * 0.05)).toFixed(3)})`,
              filter: `brightness(${(0.82 + lookLeftFactor * (1 - tl.manApproachProgress) * 0.5 + tl.manApproachProgress * 0.18).toFixed(2)}) drop-shadow(0 0 ${(6 + lookLeftFactor * 16 + tl.manGlareProgress * 10).toFixed(0)}px rgba(140,30,50,${(0.15 + lookLeftFactor * 0.3 + tl.manGlareProgress * 0.35).toFixed(2)}))`,
            }}
          >
            <svg viewBox="0 0 160 360" className={styles.darkManSvg} role="img" aria-label="مرد بلندقد سیاه‌پوش">
              <path d="M46 360 L54 128 Q56 96 80 94 Q104 96 106 128 L114 360 Z" fill="#07050c" />
              <path d="M54 140 L38 262" stroke="#07050c" strokeWidth="13" strokeLinecap="round" />
              <path d="M106 140 L122 262" stroke="#07050c" strokeWidth="13" strokeLinecap="round" />
              <circle cx="37" cy="268" r="7.5" fill="#cfc8bc" />
              <circle cx="123" cy="268" r="7.5" fill="#cfc8bc" />
              {/* ساعدهای دست زدن (فقط در پنجره دست زدن پایین سِن) */}
              {tl.manClapEnvelope > 0.02 && (
                <g opacity={tl.manClapEnvelope}>
                  <g style={{ transform: `rotate(${(-tl.manClapPhaseDeg).toFixed(1)}deg)`, transformOrigin: '44px 218px' }}>
                    <path d="M44 218 L74 196" stroke="#07050c" strokeWidth="11" strokeLinecap="round" />
                    <circle cx="76" cy="195" r="7" fill="#cfc8bc" />
                  </g>
                  <g style={{ transform: `rotate(${tl.manClapPhaseDeg.toFixed(1)}deg)`, transformOrigin: '116px 218px' }}>
                    <path d="M116 218 L86 196" stroke="#07050c" strokeWidth="11" strokeLinecap="round" />
                    <circle cx="84" cy="195" r="7" fill="#cfc8bc" />
                  </g>
                </g>
              )}
              {/* دست دراز شده به سوی زن و پس زده شدن آن */}
              {tl.manHandExtendProgress > 0.02 && elapsedMs < CHOKE_START_MS && (
                <g
                  opacity={1 - tl.inversionProgress}
                  style={{
                    transform: `rotate(${(-tl.manHandExtendProgress * 34 + tl.handRejectionProgress * 52).toFixed(1)}deg) translateX(${(tl.handRejectionProgress * -7).toFixed(1)}px)`,
                    transformOrigin: '104px 148px',
                  }}
                >
                  <path d="M104 148 L152 132" stroke="#07050c" strokeWidth="12" strokeLinecap="round" />
                  <circle cx="155" cy="131" r="8" fill="#cfc8bc" />
                </g>
              )}
              {/* بازوی برافراشته خفگی از راه دور هنگام کوبش‌ها */}
              {inChokeFlight && (
                <g style={{ transform: `rotate(${(-52 + Math.sin(elapsedMs * 0.02) * 3).toFixed(1)}deg)`, transformOrigin: '104px 148px' }}>
                  <path d="M104 148 L146 96" stroke="#07050c" strokeWidth="12" strokeLinecap="round" />
                  <path d="M146 96 l10 -12 M146 96 l14 -6 M146 96 l13 3" stroke="#cfc8bc" strokeWidth="4.5" strokeLinecap="round" />
                </g>
              )}
              <g style={{ transform: `rotate(${(tl.darkManHeadTiltDeg * (1 - tl.manGlareProgress)).toFixed(1)}deg)`, transformOrigin: '80px 92px' }}>
                <ellipse cx="80" cy="62" rx="23" ry="30" fill="#d8d2c4" />
                <path d="M57 66 Q55 26 80 24 Q105 26 103 66 L98 44 Q80 34 62 44Z" fill="#0b0810" />
                <path d="M57 60 L52 118 M103 60 L108 118" stroke="#0b0810" strokeWidth="7" strokeLinecap="round" />
                <ellipse cx="71" cy="62" rx="4.5" ry="7" fill="#050308" />
                <ellipse cx="89" cy="62" rx="4.5" ry="7" fill="#050308" />
                {/* برق سرخ چشم‌ها هنگام خیره شدن به پلیرها */}
                <g opacity={tl.manGlareProgress}>
                  <circle cx="71" cy="63" r="2.2" fill="#ff2a3c" />
                  <circle cx="89" cy="63" r="2.2" fill="#ff2a3c" />
                </g>
                <path
                  d={tl.inversionProgress > 0.5 ? 'M68 82 Q80 92 92 82' : 'M70 84 Q80 88 90 84'}
                  stroke="#17101c"
                  strokeWidth="2.6"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            </svg>
          </div>

          {/* دو نیمه پرده سرخ سِن اصلی (در موج ۳ پوسیده و دریده می‌شوند) */}
          <div
            className={`${styles.curtainHalf} ${styles.curtainHalfLeft}`}
            style={{
              transform: `translateX(${(-tl.curtainOpenProgress * 86).toFixed(1)}%) scaleX(${(1 - tl.curtainOpenProgress * 0.45).toFixed(2)})`,
              filter: `brightness(${(1 - tl.stageGrimeProgress * 0.55).toFixed(2)}) saturate(${(1 - tl.stageGrimeProgress * 0.35).toFixed(2)})`,
              clipPath:
                tl.stageGrimeProgress > 0.65
                  ? 'polygon(0 0, 100% 0, 100% 88%, 82% 96%, 64% 86%, 44% 98%, 22% 88%, 0 95%)'
                  : undefined,
            }}
          />
          <div
            className={`${styles.curtainHalf} ${styles.curtainHalfRight}`}
            style={{
              transform: `translateX(${(tl.curtainOpenProgress * 86).toFixed(1)}%) scaleX(${(1 - tl.curtainOpenProgress * 0.45).toFixed(2)})`,
              filter: `brightness(${(1 - tl.stageGrimeProgress * 0.55).toFixed(2)}) saturate(${(1 - tl.stageGrimeProgress * 0.35).toFixed(2)})`,
              clipPath:
                tl.stageGrimeProgress > 0.65
                  ? 'polygon(0 0, 100% 0, 100% 95%, 78% 87%, 56% 97%, 36% 87%, 18% 96%, 0 89%)'
                  : undefined,
            }}
          />
          <div className={styles.valanceMain} style={{ filter: `brightness(${(1 - tl.stageGrimeProgress * 0.5).toFixed(2)})` }} />
          <div className={styles.grime} style={{ opacity: tl.stageGrimeProgress }} />
          <div className={styles.stageFloor} />
        </div>

        {/* سِن راست (پرده بسته) */}
        <div className={`${styles.stageSide} ${styles.stageRight}`}>
          <div className={styles.valance} />
          <div
            className={styles.curtainClosed}
            style={{ filter: `brightness(${(1 - tl.stageGrimeProgress * 0.55).toFixed(2)}) saturate(${(1 - tl.stageGrimeProgress * 0.4).toFixed(2)})` }}
          />
          <div className={styles.grime} style={{ opacity: tl.stageGrimeProgress }} />
        </div>

        {/* دیوار راست + تابلوها */}
        <div className={`${styles.wall} ${styles.wallSide}`}>
          {RIGHT_PAINTINGS.map((painting, i) => (
            <div key={painting.label} className={styles.painting} style={paintingStyle(painting.finalTiltDeg, i + 2)}>
              <span>{painting.icon}</span><small dir="rtl">{painting.label}</small>
            </div>
          ))}
          <div className={styles.grime} style={{ opacity: tl.stageGrimeProgress }} />
        </div>

        {/* زن در حال پرتاب در فضای کل سالن (لایه مستقل از قاب سِن) */}
        {inChokeFlight && (
          <div
            className={styles.victimWrap}
            style={{
              left: `${victimPose.xPct.toFixed(1)}%`,
              top: `${victimPose.yPct.toFixed(1)}%`,
              opacity: performersOpacity,
              transform: `translate(-50%, -55%) rotate(${victimPose.rotateDeg.toFixed(1)}deg) scale(${victimPose.scale.toFixed(2)})`,
            }}
            aria-hidden="true"
          >
            <div className={styles.chokeGlow} style={{ opacity: 0.35 + tl.chokeLiftProgress * 0.45 }} />
            <DancerFigure armDeg={0} skirtFlare={1.04} mouthOpen={0} fear={1} choked />
          </div>
        )}

        {/* لوستر کریستالی: تاب ← کنده شدن و سقوط ← خرد شدن روی زمین */}
        <div
          className={styles.chandelier}
          style={{
            top: `${(-2 + tl.chandelierFallProgress * 63).toFixed(1)}%`,
            transform: `translateX(-50%) rotate(${(tl.chandelierSwayDeg + tl.chandelierFallProgress * 24 + Math.sin(elapsedMs * 0.1) * Math.abs(tl.cameraShakeX) * 0.3).toFixed(2)}deg) scaleY(${(1 - tl.chandelierShatteredProgress * 0.42).toFixed(2)})`,
            opacity: (0.35 + tl.chandelierGlow * 0.65) * (1 - tl.chandelierFallProgress * 0.45),
          }}
        >
          <svg viewBox="0 0 220 120" className={styles.chandelierSvg} aria-hidden="true">
            <line x1="110" y1="0" x2="110" y2={34 - tl.chandelierFallProgress * 30} stroke="#8a6a24" strokeWidth="3" />
            <path d="M40 62 Q110 20 180 62" stroke="#c9a227" strokeWidth="3.5" fill="none" />
            <path d="M58 82 Q110 48 162 82" stroke="#c9a227" strokeWidth="3" fill="none" />
            {[44, 76, 110, 144, 176].map((cx) => (
              <g key={cx}>
                <line x1={cx} y1={cx === 110 ? 40 : 56} x2={cx} y2={cx === 110 ? 74 : 88} stroke="#e7c65a" strokeWidth="1.6" />
                <path d={`M${cx} ${cx === 110 ? 88 : 100} l6 10 l-6 12 l-6 -12 Z`} fill="rgba(255,240,190,0.92)" />
              </g>
            ))}
            <circle cx="110" cy="40" r="7" fill="#e7c65a" />
          </svg>
          <div
            className={styles.chandelierGlow}
            style={{ opacity: tl.chandelierGlow * 0.55 * (1 - tl.chandelierFallProgress) }}
          />
        </div>
        {tl.chandelierShatteredProgress > 0.05 && (
          <div className={styles.crystalShards} style={{ opacity: tl.chandelierShatteredProgress }} aria-hidden="true">
            ✦ ✧ ◆ ✦ ✧ ◆ ✦
          </div>
        )}
      </div>

      {/* شست‌وشوی سرخ واژگونی روی کل سالن */}
      {tl.inversionProgress > 0.01 && (
        <div className={styles.redWash} style={{ opacity: tl.inversionProgress * (0.42 - tl.finalDarknessProgress * 0.14) }} aria-hidden="true" />
      )}

      {/* تاریکی عمومی سالن */}
      <div className={styles.darkness} style={{ opacity: Math.max(0, Math.min(0.86, darkness)) }} />

      {/* ============ لایه پیش‌زمینه: صندلی‌های جلو و هم‌تیمی‌های کناری ============ */}
      <div
        className={styles.foreground}
        style={{
          transform: `translate(${(-normalizedYaw * 3.2).toFixed(2)}%, ${(((1 - tl.seatedProgress) * 26) + tl.playerPushPulse * 5).toFixed(1)}%) scale(${(1 - tl.playerPushPulse * 0.05).toFixed(3)})`,
          opacity: 0.25 + tl.entryProgress * 0.75,
        }}
      >
        {leftNeighbors.map((player, distance) => {
          const { settle, style } = neighborStyle(player, 'left', distance);
          return (
            <div key={player.playerId} className={`${styles.neighbor} ${styles.neighborLeft}`} style={{ ...style, left: `${-3 - distance * 8}%` }}>
              <div className={styles.nameChip} style={{ opacity: clamp01((settle - 0.5) * 2) }}>{player.playerName}</div>
              <PlayerBust player={player} />
            </div>
          );
        })}
        {rightNeighbors.map((player, distance) => {
          const { settle, style } = neighborStyle(player, 'right', distance);
          return (
            <div key={player.playerId} className={`${styles.neighbor} ${styles.neighborRight}`} style={{ ...style, right: `${-3 - distance * 8}%` }}>
              <div className={styles.nameChip} style={{ opacity: clamp01((settle - 0.5) * 2) }}>{player.playerName}</div>
              <PlayerBust player={player} />
            </div>
          );
        })}

        {me.auditoriumRow > 1 ? (
          <div className={styles.frontRow} aria-label="ردیف صندلی‌های روبه‌رو">
            {[1, 2, 3, 4, 5].map((col) => {
              const occupant = frontRowOccupants.get(col as 1 | 2 | 3 | 4 | 5);
              const settle = occupant ? teammateSettleProgress(occupant.seatIndex, elapsedMs) : 0;
              return (
                <div key={col} className={styles.seatBack}>
                  {occupant && (
                    <div
                      className={styles.frontHead}
                      style={{
                        opacity: settle,
                        transform: `translateY(${((1 - settle) * 20 + tl.playerPushPulse * 7).toFixed(1)}px)`,
                      }}
                    >
                      <PlayerBust player={occupant} small />
                      <div className={styles.nameChipSmall}>{occupant.playerName}</div>
                    </div>
                  )}
                  <div className={styles.seatPlate}>
                    {toFaDigits(me.auditoriumRow - 1)}-{toFaDigits(col)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.apron} aria-hidden="true" />
        )}
      </div>

      {(() => {
        const storyDialogue = getStoryDialogueAt(elapsedMs);
        return (
          <p className={styles.caption}>
            {storyDialogue
              ? `${storyDialogue.speaker}: «${storyDialogue.textFa}»`
              : auditoriumCaption(elapsedMs, room.playerCount)}
          </p>
        );
      })()}
    </div>
  );
}
