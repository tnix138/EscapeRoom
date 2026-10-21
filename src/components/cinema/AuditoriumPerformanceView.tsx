/**
 * AuditoriumPerformanceView — کات‌سین POV داخل سالن تئاتر (از ثانیه ۱۱) — موج ۲ علیرضا
 * ----------------------------------------------------------------------------------------
 * منبع: TASKS-ALIREZA.md موج ۲ بندهای ۲ و ۳ + PROJECT.md گام ۵
 * نیمه اول (موج ۲): ورود به سالن کوچک ۲۰ نفره (۴ ردیف ۵تایی پلکانی) ← نشستن فقط پلیرهای
 * اتاق (۳ تا ۸ نفر) و خالی بودن باقی صندلی‌ها ← سه سِن با پرده قرمز، تابلوهای دیواری و
 * لوستر کریستالی ← موسیقی کلاسیک (لایه صدا)، نورهای ضعیف روی پرده، باز شدن پرده و رقص
 * بانوی ایتالیایی ← پیدایش مرد بلندقد سیاه‌پوش در سایه سمت چپ صحنه.
 * با چرخاندن سر (yaw)، هم‌تیمی‌های صندلی‌های کناری با برچسب نام دیده می‌شوند و حضور
 * مرد سیاه‌پوش در سمت چپ نمایان‌تر می‌شود. نیمه وحشت (۴۰ تا ۷۴ ثانیه) در موج ۳ به
 * همین کامپوننت اضافه می‌شود؛ تا آن زمان پس از ثانیه ۴۰ وضعیت «اجرای زنده» حفظ می‌شود.
 */

import type { ClientRoomView, PlayerSeatPublicView } from '../../contracts/types';
import { getPovCameraStyle, yawToNormalized } from './usePovHeadPan';
import {
  clamp01,
  getAuditoriumTimeline,
  teammateSettleProgress,
} from './cutscene-timing';
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

function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function auditoriumCaption(elapsedMs: number, playerCount: number): string {
  if (elapsedMs < 21_000)
    return `سالنی کوچک با ۲۰ صندلی مخملی… و فقط شما ${toFaDigits(playerCount)} نفر. بقیه‌ی صندلی‌ها کاملاً خالی‌اند.`;
  if (elapsedMs < 26_000) return 'چراغ‌های سالن خاموش می‌شوند و نورهایی کم‌سو روی چین‌های پرده‌ی سرخ می‌لغزند…';
  if (elapsedMs < 31_000) return 'پرده کنار می‌رود؛ بانویی با لباس کلاسیک ایتالیایی اجرای موزیکال خود را آغاز می‌کند.';
  if (elapsedMs < 36_000) return 'در سایه‌ی سمت چپ صحنه چیزی تکان می‌خورد… سرت را به آرامی به سمت چپ بچرخان.';
  return 'مردی بلندقد و سیاه‌پوش، با چهره‌ای هولناک، بی‌حرکت در سایه ایستاده و محو رقص اوست.';
}

/** نیم‌تنه هم‌تیمی نشسته (سر و شانه) با رنگ اختصاصی صندلی او */
function PlayerBust({ player, small = false }: { player: PlayerSeatPublicView; small?: boolean }) {
  const color = PLAYER_COLORS[player.seatIndex % PLAYER_COLORS.length];
  return (
    <svg
      viewBox="0 0 120 120"
      className={small ? styles.bustSvgSmall : styles.bustSvg}
      role="img"
      aria-label={`هم‌تیمی: ${player.playerName}`}
    >
      <path d="M18 120 Q22 82 60 80 Q98 82 102 120 Z" fill={color} />
      <circle cx="60" cy="54" r="24" fill="#d9b48c" />
      <path d="M36 52 Q38 28 60 27 Q82 28 84 52 Q76 38 60 38 Q44 38 36 52Z" fill="#2b1c10" />
      <circle cx="51" cy="55" r="2.4" fill="#241a12" />
      <circle cx="69" cy="55" r="2.4" fill="#241a12" />
      <path d="M52 66 Q60 70 68 66" stroke="#8a6a4a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
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

  // وقتی سر به سمت چپ صحنه می‌چرخد، مرد سیاه‌پوش از سایه نمایان‌تر می‌شود
  const lookLeftFactor = clamp01((-yaw - 6) / 28);
  const darkness =
    0.18 + tl.houseDimProgress * 0.5 - tl.stageGlowProgress * 0.22;

  const neighborStyle = (
    player: PlayerSeatPublicView,
    side: 'left' | 'right',
    distance: number,
  ) => {
    const settle = teammateSettleProgress(player.seatIndex, elapsedMs);
    // با چرخش سر به سمت هم‌تیمی، او از لبه کادر به داخل نما می‌لغزد
    const inwardPx = (side === 'left' ? -yaw : yaw) * 2.1;
    return {
      settle,
      style: {
        opacity: settle,
        transform: `translate(${(inwardPx * (1 - distance * 0.25)).toFixed(1)}px, ${((1 - settle) * 46).toFixed(1)}px) scale(${(1 - distance * 0.16).toFixed(2)})`,
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
          transform: `${pov.transform} translateY(${((1 - tl.seatedProgress) * 3.2).toFixed(2)}%) scale(${(1.15 - 0.15 * tl.entryProgress).toFixed(3)})`,
        }}
      >
        {/* دیوار چپ + تابلوها */}
        <div className={`${styles.wall} ${styles.wallSide}`}>
          <div className={styles.painting} style={{ transform: 'rotate(0deg)' }}>
            <span>🎭</span><small dir="rtl">نقاب سرخ</small>
          </div>
          <div className={styles.painting} style={{ transform: 'rotate(0deg)' }}>
            <span>🦢</span><small dir="rtl">قوی دریاچه</small>
          </div>
        </div>

        {/* سِن چپ (پرده بسته — ناحیه سایه مرد سیاه‌پوش) */}
        <div className={`${styles.stageSide} ${styles.stageLeft}`}>
          <div className={styles.valance} />
          <div className={styles.curtainClosed} />
          <div
            className={styles.shadowPool}
            style={{ opacity: 0.55 + tl.darkManReveal * 0.3 }}
          />
        </div>

        {/* سِن اصلی مرکز */}
        <div className={styles.stageCenter}>
          <div
            className={styles.stageBackdrop}
            style={{ opacity: 0.25 + tl.stageGlowProgress * 0.75 }}
          />
          {/* پرتوهای نور روی پرده و صحنه */}
          {[18, 42, 66].map((leftPct) => (
            <div
              key={leftPct}
              className={styles.spotCone}
              style={{
                left: `${leftPct}%`,
                opacity: tl.spotlightsProgress * (0.35 + tl.stageGlowProgress * 0.5),
              }}
            />
          ))}

          {/* بانوی رقصنده ایتالیایی */}
          <div
            className={styles.dancerWrap}
            style={{
              opacity: tl.dancerReveal,
              transform: `translateX(calc(-50% + ${(tl.dancerTravelX * 84).toFixed(1)}px)) translateY(${(-tl.dancerBob * 6).toFixed(1)}px) rotate(${tl.dancerSwayDeg.toFixed(2)}deg)`,
            }}
          >
            <svg viewBox="0 0 200 300" className={styles.dancerSvg} role="img" aria-label="بانوی رقصنده با لباس کلاسیک ایتالیایی">
              {/* دامن پف‌دار کلاسیک */}
              <g
                style={{
                  transform: `scaleX(${tl.dancerSkirtFlare.toFixed(3)})`,
                  transformOrigin: '100px 150px',
                }}
              >
                <path d="M100 138 Q52 190 34 272 Q100 292 166 272 Q148 190 100 138Z" fill="#8e1f33" />
                <path d="M100 150 Q66 198 54 264 Q100 278 146 264 Q134 198 100 150Z" fill="#c9a86a" opacity="0.85" />
                <path d="M100 162 Q78 204 72 256 Q100 266 128 256 Q122 204 100 162Z" fill="#f3e3bb" />
              </g>
              {/* نیم‌تنه و دست‌های در حال رقص */}
              <path d="M82 146 Q84 104 100 100 Q116 104 118 146 Q100 154 82 146Z" fill="#5d1120" />
              <g style={{ transform: `rotate(${(tl.dancerArmDeg - 18).toFixed(1)}deg)`, transformOrigin: '84px 110px' }}>
                <path d="M84 110 Q58 92 44 64" stroke="#e6c39a" strokeWidth="9" fill="none" strokeLinecap="round" />
              </g>
              <g style={{ transform: `rotate(${(-tl.dancerArmDeg + 18).toFixed(1)}deg)`, transformOrigin: '116px 110px' }}>
                <path d="M116 110 Q142 92 156 64" stroke="#e6c39a" strokeWidth="9" fill="none" strokeLinecap="round" />
              </g>
              {/* سر، موی جمع‌شده و چهره آرام */}
              <circle cx="100" cy="76" r="21" fill="#e6c39a" />
              <path d="M79 74 Q80 52 100 51 Q120 52 121 74 Q112 60 100 61 Q88 60 79 74Z" fill="#3a2310" />
              <circle cx="100" cy="48" r="9" fill="#3a2310" />
              <circle cx="92" cy="77" r="2" fill="#2b1c10" />
              <circle cx="108" cy="77" r="2" fill="#2b1c10" />
              <path d="M93 88 Q100 92 107 88" stroke="#8e4b2f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d="M96 292 L100 272 L105 292Z" fill="#e6c39a" />
            </svg>
          </div>

          {/* مرد بلندقد سیاه‌پوش در سایه چپ صحنه */}
          <div
            className={styles.darkManWrap}
            style={{
              opacity: tl.darkManReveal,
              transform: `translateX(${((1 - tl.darkManReveal) * -22).toFixed(1)}px) scale(${(1 + tl.darkManBreath * 0.016).toFixed(3)})`,
              filter: `brightness(${(0.82 + lookLeftFactor * 0.5).toFixed(2)}) drop-shadow(0 0 ${(6 + lookLeftFactor * 16).toFixed(0)}px rgba(120,90,180,${(0.15 + lookLeftFactor * 0.4).toFixed(2)}))`,
            }}
          >
            <svg viewBox="0 0 160 360" className={styles.darkManSvg} role="img" aria-label="مرد بلندقد سیاه‌پوش در سایه سمت چپ صحنه">
              <path d="M46 360 L54 128 Q56 96 80 94 Q104 96 106 128 L114 360 Z" fill="#07050c" />
              <path d="M54 140 L38 262" stroke="#07050c" strokeWidth="13" strokeLinecap="round" />
              <path d="M106 140 L122 262" stroke="#07050c" strokeWidth="13" strokeLinecap="round" />
              <circle cx="37" cy="268" r="7.5" fill="#cfc8bc" />
              <circle cx="123" cy="268" r="7.5" fill="#cfc8bc" />
              <g style={{ transform: `rotate(${tl.darkManHeadTiltDeg.toFixed(1)}deg)`, transformOrigin: '80px 92px' }}>
                <ellipse cx="80" cy="62" rx="23" ry="30" fill="#d8d2c4" />
                <path d="M57 66 Q55 26 80 24 Q105 26 103 66 L98 44 Q80 34 62 44Z" fill="#0b0810" />
                <path d="M57 60 L52 118 M103 60 L108 118" stroke="#0b0810" strokeWidth="7" strokeLinecap="round" />
                <ellipse cx="71" cy="62" rx="4.5" ry="7" fill="#050308" />
                <ellipse cx="89" cy="62" rx="4.5" ry="7" fill="#050308" />
                <path d="M70 84 Q80 88 90 84" stroke="#17101c" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              </g>
            </svg>
          </div>

          {/* دو نیمه پرده سرخ سِن اصلی */}
          <div
            className={`${styles.curtainHalf} ${styles.curtainHalfLeft}`}
            style={{
              transform: `translateX(${(-tl.curtainOpenProgress * 86).toFixed(1)}%) scaleX(${(1 - tl.curtainOpenProgress * 0.45).toFixed(2)})`,
            }}
          />
          <div
            className={`${styles.curtainHalf} ${styles.curtainHalfRight}`}
            style={{
              transform: `translateX(${(tl.curtainOpenProgress * 86).toFixed(1)}%) scaleX(${(1 - tl.curtainOpenProgress * 0.45).toFixed(2)})`,
            }}
          />
          <div className={styles.valanceMain} />
          <div className={styles.stageFloor} />
        </div>

        {/* سِن راست (پرده بسته) */}
        <div className={`${styles.stageSide} ${styles.stageRight}`}>
          <div className={styles.valance} />
          <div className={styles.curtainClosed} />
        </div>

        {/* دیوار راست + تابلوها */}
        <div className={`${styles.wall} ${styles.wallSide}`}>
          <div className={styles.painting} style={{ transform: 'rotate(0deg)' }}>
            <span>🎻</span><small dir="rtl">ویولن طلایی</small>
          </div>
          <div className={styles.painting} style={{ transform: 'rotate(0deg)' }}>
            <span>🌹</span><small dir="rtl">رز مخملی</small>
          </div>
        </div>

        {/* لوستر کریستالی سقف */}
        <div
          className={styles.chandelier}
          style={{
            transform: `translateX(-50%) rotate(${tl.chandelierSwayDeg.toFixed(2)}deg)`,
            opacity: 0.35 + tl.chandelierGlow * 0.65,
          }}
        >
          <svg viewBox="0 0 220 120" className={styles.chandelierSvg} aria-hidden="true">
            <line x1="110" y1="0" x2="110" y2="34" stroke="#8a6a24" strokeWidth="3" />
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
            style={{ opacity: tl.chandelierGlow * 0.55 }}
          />
        </div>
      </div>

      {/* تاریکی عمومی سالن روی همه لایه دنیای صحنه */}
      <div className={styles.darkness} style={{ opacity: Math.max(0, Math.min(0.82, darkness)) }} />

      {/* ============ لایه پیش‌زمینه: صندلی‌های جلو و هم‌تیمی‌های کناری ============ */}
      <div
        className={styles.foreground}
        style={{
          transform: `translateX(${(-normalizedYaw * 3.2).toFixed(2)}%) translateY(${((1 - tl.seatedProgress) * 26).toFixed(1)}%)`,
          opacity: 0.25 + tl.entryProgress * 0.75,
        }}
      >
        {/* هم‌تیمی‌های سمت چپ و راست صندلی بازیکن */}
        {leftNeighbors.map((player, distance) => {
          const { settle, style } = neighborStyle(player, 'left', distance);
          return (
            <div
              key={player.playerId}
              className={`${styles.neighbor} ${styles.neighborLeft}`}
              style={{ ...style, left: `${-3 - distance * 8}%` }}
            >
              <div className={styles.nameChip} style={{ opacity: clamp01((settle - 0.5) * 2) }}>
                {player.playerName}
              </div>
              <PlayerBust player={player} />
            </div>
          );
        })}
        {rightNeighbors.map((player, distance) => {
          const { settle, style } = neighborStyle(player, 'right', distance);
          return (
            <div
              key={player.playerId}
              className={`${styles.neighbor} ${styles.neighborRight}`}
              style={{ ...style, right: `${-3 - distance * 8}%` }}
            >
              <div className={styles.nameChip} style={{ opacity: clamp01((settle - 0.5) * 2) }}>
                {player.playerName}
              </div>
              <PlayerBust player={player} />
            </div>
          );
        })}

        {/* ردیف صندلی‌های روبه‌رو (۵ صندلی) — خالی یا با سر هم‌تیمی ردیف جلو */}
        {me.auditoriumRow > 1 ? (
          <div className={styles.frontRow} aria-label="ردیف صندلی‌های روبه‌رو">
            {[1, 2, 3, 4, 5].map((col) => {
              const occupant = frontRowOccupants.get(col as 1 | 2 | 3 | 4 | 5);
              const settle = occupant
                ? teammateSettleProgress(occupant.seatIndex, elapsedMs)
                : 0;
              return (
                <div key={col} className={styles.seatBack}>
                  {occupant && (
                    <div
                      className={styles.frontHead}
                      style={{
                        opacity: settle,
                        transform: `translateY(${((1 - settle) * 20).toFixed(1)}px)`,
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

      <p className={styles.caption}>
        {auditoriumCaption(elapsedMs, room.playerCount)}
      </p>
    </div>
  );
}
