/**
 * UsherDoorCutsceneView — کات‌سین POV دم درب تماشاخانه (ثانیه ۰ تا ۱۱) — موج ۲ علیرضا
 * -------------------------------------------------------------------------------------
 * منبع: TASKS-ALIREZA.md موج ۲ بند ۱ + PROJECT.md گام ۴
 * سکانس: باز شدن دریچه و قفل سنگین ← ظاهر شدن دربان پیر «سینیور مَتِئو» با فانوس کم‌سو
 *        ← جلو رفتن دست اول‌شخص بازیکن و تحویل بلیط‌های پانچ‌شده ← سر تکان دادن و
 *        کنار رفتن دربان ← باز شدن کامل هر دو لنگه درِ تالار و حرکت دوربین به داخل.
 * تمام حرکت‌ها از getDoorTimeline(elapsedMs) می‌آیند (تابعی خالص از ساعت سرور)؛
 * تنها ورودی بازیکن چرخش سر چپ/راست (yaw) است — هیچ دکمه و تعاملی وجود ندارد.
 */

import type { ClientRoomView } from '../../contracts/types';
import { getPovCameraStyle } from './usePovHeadPan';
import { getDoorTimeline, progressBetween } from './cutscene-timing';
import { getStoryDialogueAt } from './story-script';
import styles from './UsherDoorCutsceneView.module.css';

export interface UsherDoorCutsceneViewProps {
  room: ClientRoomView;
  /** زمان سپری‌شده کات‌سین (۰ تا ۱۱٬۰۰۰ میلی‌ثانیه) */
  elapsedMs: number;
  /** زاویه چرخش سر بازیکن در بازه [-42, +42] */
  yaw: number;
}

function doorCaption(elapsedMs: number, playerName: string): string {
  if (elapsedMs < 2_800) return 'قفل سنگین تماشاخانه، با صدای خش‌خش برنج کهنه، آزاد می‌شود…';
  if (elapsedMs < 5_800) return 'سینیور مَتِئو، دربان پیر تالار، با فانوسی کم‌سو در آستانه‌ی در ظاهر می‌شود.';
  if (elapsedMs < 9_000) return `بلیط‌های رمزگشایی و پانچ‌شده‌ات را، ${playerName}، به دستان دربان می‌سپاری…`;
  return 'دربان سر تکان می‌دهد، کنار می‌رود و هر دو لنگه‌ی درِ تماشاخانه‌ی اُرفه‌ئو به رویت باز می‌شود.';
}

export default function UsherDoorCutsceneView({
  room,
  elapsedMs,
  yaw,
}: UsherDoorCutsceneViewProps) {
  const tl = getDoorTimeline(elapsedMs);
  const pov = getPovCameraStyle(yaw, 7);

  // عقب برگشتن دست بازیکن پس از تحویل بلیط (۹ تا ۱۰.۲ ثانیه)
  const handRetreat = progressBetween(elapsedMs, 9_000, 10_200);
  const handVisible = tl.handExtend > 0.01 && handRetreat < 1;
  const handShiftY = (1 - tl.handExtend) * 58 + handRetreat * 62;

  // زاویه باز شدن لنگه‌ها: شکاف اولیه + باز شدن کامل پایانی
  const leafAngle = tl.doorCrack * 10 + tl.doorsFullOpen * 66;
  const leafGap = tl.doorCrack * 4.5 + tl.doorsFullOpen * 7; // درصد فاصله گرفتن از مرکز

  return (
    <div className={styles.scene} aria-label="کات‌سین دم درب تماشاخانه">
      <div
        className={styles.world}
        style={{
          ...pov,
          transform: `${pov.transform} scale(${(1 + 0.16 * tl.cameraPush).toFixed(3)})`,
        }}
      >
        {/* نور گرم داخل سالن پشت درها */}
        <div
          className={styles.interiorGlow}
          style={{
            opacity: 0.12 + tl.interiorLightSpill * 0.35 + tl.doorsFullOpen * 0.53,
          }}
        />

        {/* دربان پیر در آستانه در */}
        <div
          className={styles.usherWrap}
          style={{
            opacity: tl.usherReveal,
            transform: `translateX(calc(-50% + ${(-tl.usherStepAside * 150).toFixed(1)}px)) scale(${(0.94 + 0.06 * tl.usherReveal).toFixed(3)})`,
          }}
        >
          <svg viewBox="0 0 200 340" className={styles.usherSvg} role="img" aria-label="سینیور مَتِئو، دربان تماشاخانه">
            {/* فانوس کم‌سو در دست چپ دربان */}
            <g style={{ opacity: tl.lanternFlicker }}>
              <circle cx="34" cy="222" r="26" fill="rgba(255,196,92,0.28)" />
              <circle cx="34" cy="222" r="11" fill="rgba(255,214,130,0.85)" />
            </g>
            <rect x="25" y="205" width="18" height="30" rx="4" fill="#2b2118" stroke="#c9a227" strokeWidth="2" />
            <path d="M34 205 L48 168" stroke="#191423" strokeWidth="10" strokeLinecap="round" />
            {/* کت فراک تیره و بدن */}
            <path d="M62 340 L70 150 Q72 118 100 116 Q128 118 130 150 L138 340 Z" fill="#191423" />
            <path d="M92 122 L100 168 L108 122 L104 340 L96 340 Z" fill="#e8dcc4" />
            <path d="M88 120 L100 136 L112 120 L106 112 L100 120 L94 112 Z" fill="#4a0e1e" />
            {[190, 225, 260, 295].map((cy) => (
              <circle key={cy} cx="100" cy={cy} r="3.2" fill="#c9a227" />
            ))}
            {/* بازوی راست دراز شده برای گرفتن بلیط */}
            <g
              style={{
                transform: `rotate(${(-8 - tl.handExtend * 20).toFixed(1)}deg)`,
                transformOrigin: '128px 156px',
              }}
            >
              <path d="M128 156 L168 196" stroke="#191423" strokeWidth="13" strokeLinecap="round" />
              <circle cx="171" cy="199" r="8" fill="#d9b48c" />
            </g>
            {/* سر و موی خاکستری و سبیل (سر تکان دادن) */}
            <g
              style={{
                transform: `rotate(${tl.usherNodDeg.toFixed(1)}deg)`,
                transformOrigin: '100px 108px',
              }}
            >
              <circle cx="100" cy="80" r="27" fill="#d9b48c" />
              <path d="M74 76 Q76 48 100 47 Q124 48 126 76 Q118 60 100 60 Q82 60 74 76Z" fill="#b9b3a8" />
              <circle cx="90" cy="79" r="2.6" fill="#241a12" />
              <circle cx="110" cy="79" r="2.6" fill="#241a12" />
              <path d="M86 94 Q100 88 114 94 Q106 101 100 98 Q94 101 86 94Z" fill="#cfc8bc" />
              <path d="M90 103 Q100 107 110 103" stroke="#8a6a4a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </g>
          </svg>
          {/* بلیط‌های تحویل گرفته‌شده در دست دربان */}
          <div
            className={styles.usherTicket}
            style={{ opacity: tl.ticketHandover }}
            aria-hidden="true"
          >
            🎫✦
          </div>
          <div className={styles.usherName}>سینیور مَتِئو — دربان تماشاخانه</div>
        </div>

        {/* دیوار سنگی و قاب در */}
        <div className={styles.doorFrame}>
          {/* لنگه چپ در */}
          <div
            className={`${styles.leaf} ${styles.leafLeft}`}
            style={{
              transform: `translateX(${(-leafGap).toFixed(2)}%) rotateY(${(-leafAngle).toFixed(1)}deg)`,
            }}
          >
            <div className={styles.panelInset} />
            <div className={styles.panelInset} />
          </div>
          {/* لنگه راست در + دریچه چشمی */}
          <div
            className={`${styles.leaf} ${styles.leafRight}`}
            style={{
              transform: `translateX(${leafGap.toFixed(2)}%) rotateY(${leafAngle.toFixed(1)}deg)`,
            }}
          >
            <div className={styles.peephole}>
              <div
                className={styles.peepholeSlit}
                style={{ opacity: tl.peepholeOpen * (1 - tl.usherReveal) }}
              >
                <span className={styles.eyeDot} />
                <span className={styles.eyeDot} />
              </div>
              <div
                className={styles.peepholeCover}
                style={{ transform: `scaleX(${(1 - tl.peepholeOpen).toFixed(3)})` }}
              />
            </div>
            <div className={styles.panelInset} />
          </div>

          {/* صفحه قفل برنجی وسط در + چراغ‌های سبز بلیط همه بازیکنان */}
          <div
            className={styles.lockPlate}
            style={{ opacity: 1 - tl.doorsFullOpen * 0.85 }}
          >
            <div
              className={styles.lockIcon}
              style={{
                transform: `rotate(${(-tl.lockReleased * 24).toFixed(1)}deg)`,
                filter: `drop-shadow(0 0 ${(4 + tl.lockReleased * 10).toFixed(0)}px rgba(255,205,90,${(0.35 + tl.lockReleased * 0.5).toFixed(2)}))`,
              }}
            >
              {tl.lockReleased >= 1 ? '🔓' : '🔒'}
            </div>
            <div className={styles.lockDots} title="بلیط همه بازیکنان پانچ شده است">
              {room.players.map((player) => (
                <span
                  key={player.playerId}
                  className={styles.lockDot}
                  style={{ opacity: 0.25 + tl.lockReleased * 0.75 }}
                />
              ))}
            </div>
            <div className={styles.lockLabel}>گیشه تماشاخانه اُرفه‌ئو</div>
          </div>
        </div>

        {/* نور ریخته‌شده روی سنگ‌فرش کوچه */}
        <div
          className={styles.floorSpill}
          style={{
            opacity: tl.interiorLightSpill * 0.5 + tl.doorsFullOpen * 0.45,
            transform: `translateX(-50%) scaleX(${(0.35 + tl.doorCrack * 0.4 + tl.doorsFullOpen * 0.9).toFixed(2)})`,
          }}
        />
      </div>

      {/* دست اول‌شخص بازیکن + بلیط‌های پانچ‌شده (لایه دوربین — مستقل از چرخش صحنه) */}
      {handVisible && (
        <div
          className={styles.handLayer}
          style={{
            transform: `translate(${(-yaw * 0.35).toFixed(1)}px, ${handShiftY.toFixed(1)}%) scale(${(0.82 + 0.22 * tl.handExtend).toFixed(3)})`,
            opacity: Math.min(1, tl.handExtend * 2) * (1 - handRetreat),
          }}
          aria-hidden="true"
        >
          <div
            className={styles.heldTicket}
            style={{ opacity: 1 - tl.ticketHandover }}
          >
            <div className={styles.ticketTitle}>بلیط ورود — تماشاخانه اُرفه‌ئو</div>
            <div className={styles.ticketName}>{room.me.playerName}</div>
            <div className={styles.ticketSeat}>{room.me.seatLabel}</div>
            <div className={styles.punchRow}>
              <span className={styles.punchHole} />
              <span className={styles.punchHole} />
              <span className={styles.punchHole} />
              <span className={styles.punchedLabel}>پانچ شد ✦</span>
            </div>
          </div>
          <svg viewBox="0 0 180 150" className={styles.handSvg}>
            <path d="M70 150 L78 86 L128 92 L122 150 Z" fill="#14101d" />
            <rect x="72" y="78" width="58" height="16" rx="7" fill="#e8dcc4" />
            <g fill="#d9b48c">
              <rect x="74" y="30" width="13" height="52" rx="6.5" transform="rotate(-7 80 56)" />
              <rect x="90" y="24" width="13" height="58" rx="6.5" transform="rotate(-2 96 53)" />
              <rect x="106" y="27" width="13" height="54" rx="6.5" transform="rotate(3 112 54)" />
              <rect x="121" y="35" width="12" height="44" rx="6" transform="rotate(9 127 57)" />
              <path d="M132 70 Q152 62 150 48 Q149 38 140 40 Q129 43 128 58 Z" />
              <path d="M70 82 Q72 58 100 56 Q128 58 131 82 Q128 96 100 97 Q73 96 70 82Z" />
            </g>
          </svg>
        </div>
      )}

      {(() => {
        const storyDialogue = getStoryDialogueAt(elapsedMs);
        return (
          <p className={styles.caption}>
            {storyDialogue
              ? `${storyDialogue.speaker}: «${storyDialogue.textFa}»`
              : doorCaption(elapsedMs, room.me.playerName)}
          </p>
        );
      })()}
    </div>
  );
}
