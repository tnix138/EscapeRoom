'use client';

/**
 * page.tsx — صفحه نهایی اتاق بازی (سوییچر فازها) — علیرضا (ایجنت ۳) — موج ۳
 * -----------------------------------------------------------------------------------
 * مسیر بازیکن: لینک دعوت امیرعلی (/invite/[code]/[seatToken]) پس از ویدیوی دعوت‌نامه
 * توکن نشست را با کلید `orfeo:<code>:<token>` ذخیره و بازیکن را به همین صفحه هدایت
 * می‌کند؛ این صفحه توکن را از همان کلید (یا کلید `seat:<code>` SDK توحید یا پارامتر
 * `?token=`) بازیابی می‌کند و بر اساس فاز سرور صحنه درست را نشان می‌دهد:
 *
 *  - `alley_puzzle`      ← صحنه اول‌شخص کوچه امیرعلی (AlleyFirstPersonScene)؛
 *    اگر دعوت‌نامه هنوز دیده نشده باشد، بازیکن اول به گیت دعوت هدایت می‌شود.
 *  - `door_cutscene` / `theater_cutscene` ← کات‌سین اول‌شخص علیرضا با زمان سرور.
 *  - `in_theater`        ← سالن تاریک و شروع فصل دوم (DarkAuditoriumScene).
 *
 * Refresh در هر لحظه امن است: وضعیت کامل از سرور می‌آید و زمان کات‌سین از ساعت
 * سرور محاسبه می‌شود (useTheaterSession + createCutsceneClock توحید).
 */

import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useTheaterSession } from '@/client-sdk/index';
import AlleyFirstPersonScene from '@/components/alley/AlleyFirstPersonScene';
import FirstPersonCutsceneStage from '@/components/cinema/FirstPersonCutsceneStage';
import DarkAuditoriumScene from '@/components/auditorium/DarkAuditoriumScene';
import { resolveRoomPhase } from '@/components/room/resolve-room-phase';
import type { AuditoriumHotspotId } from '@/contracts/types';
import styles from './page.module.css';

const AlleyRoomThreeIntegration = dynamic(() => import('@/components/alley/AlleyRoomThreeIntegration'), { ssr: false });

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

/**
 * بازیابی توکن نشست صندلی با سه قرارداد تیم:
 * ۱) پارامتر `?token=` ۲) کلید `seat:<code>` در SDK توحید
 * ۳) کلید تحویل گیت دعوت امیرعلی: `orfeo:<code>:<token>`
 */
function readStoredSeatToken(roomCode: string): string | null {
  try {
    const direct = sessionStorage.getItem(`seat:${roomCode}`) ?? localStorage.getItem(`seat:${roomCode}`);
    if (direct) return direct;
    const gatePrefix = `orfeo:${roomCode}:`;
    for (const storage of [sessionStorage, localStorage]) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(gatePrefix)) {
          return storage.getItem(key) ?? key.slice(gatePrefix.length);
        }
      }
    }
  } catch {
    /* storage در دسترس نیست */
  }
  return null;
}

function useSeatToken(roomCode: string): { seatToken: string | null; resolved: boolean } {
  const searchParams = useSearchParams();
  const queryToken = searchParams.get('token');
  const [stored, setStored] = useState<{ token: string | null; resolved: boolean }>({
    token: null,
    resolved: false,
  });

  useEffect(() => {
    setStored({ token: readStoredSeatToken(roomCode), resolved: true });
  }, [roomCode]);

  return {
    seatToken: queryToken ?? stored.token,
    resolved: queryToken != null || stored.resolved,
  };
}

function RoomExperience({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const { seatToken, resolved } = useSeatToken(roomCode);
  const { loading, room, cutsceneElapsedMs, error, performAction, sendWhisper } =
    useTheaterSession(roomCode, seatToken ?? '');
  const [muted, setMuted] = useState(false);
  const [useThree, setUseThree] = useState(true);

  const invitePath = useMemo(
    () =>
      seatToken
        ? `/invite/${encodeURIComponent(roomCode)}/${encodeURIComponent(seatToken)}`
        : null,
    [roomCode, seatToken],
  );

  /* دعوت‌نامه دیده نشده است؟ اول ویدیوی امیرعلی، بعد کوچه. */
  const mustWatchInvitation =
    room?.phase === 'alley_puzzle' && !room.me.hasWatchedInvitation && invitePath != null;
  useEffect(() => {
    if (mustWatchInvitation && invitePath) router.replace(invitePath);
  }, [mustWatchInvitation, invitePath, router]);

  if (resolved && !seatToken) {
    return (
      <main className={styles.page}>
        <div className={styles.center}>
          <p className={styles.title}>🎟️ لینک دعوت لازم است</p>
          <p className={styles.text}>
            برای ورود به این اتاق باید از لینک دعوت اختصاصی خودتان (همان لینکی که رزروکننده
            برایتان فرستاده) وارد شوید تا صندلی‌تان در تماشاخانه اُرفه‌ئو شناخته شود.
          </p>
        </div>
      </main>
    );
  }

  if (loading || !room) {
    return (
      <main className={styles.page}>
        <div className={styles.center}>
          <p className={styles.title}>🎭 در حال ورود به تماشاخانه…</p>
          <p className={styles.text}>صندلی شما پیدا می‌شود و وضعیت اتاق از سرور خوانده می‌شود.</p>
          {error ? (
            <p className={styles.errorNote} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  if (mustWatchInvitation) {
    return (
      <main className={styles.page}>
        <div className={styles.center}>
          <p className={styles.title}>✉️ اول دعوت‌نامه…</p>
          <p className={styles.text}>کارت دعوت طلایی شما هنوز گشوده نشده است؛ به آن برمی‌گردیم.</p>
        </div>
      </main>
    );
  }

  /* اگر اسنپ‌شات SSE سرور کمی عقب باشد، گذار فصل‌ها با ساعت کات‌سین هم جلو می‌رود
     (resolveRoomPhase از PR #18 امیرعلی؛ وضعیت مرجع همچنان سرور است). */
  const displayPhase = resolveRoomPhase(room.phase, cutsceneElapsedMs);

  if (displayPhase === 'in_theater') {
    return (
      <main className={styles.page}>
        <DarkAuditoriumScene
          room={room}
          muted={muted}
          onToggleMute={() => setMuted((value) => !value)}
          onInspectHotspot={async (hotspotId: AuditoriumHotspotId) => {
            await performAction({ type: 'INSPECT_AUDITORIUM_HOTSPOT', hotspotId });
          }}
          onSendWhisper={sendWhisper}
        />
      </main>
    );
  }

  if (displayPhase === 'door_cutscene' || displayPhase === 'theater_cutscene') {
    return (
      <main className={styles.page}>
        <div className={styles.fullscreen}>
          <FirstPersonCutsceneStage
            room={room}
            elapsedMs={cutsceneElapsedMs}
            muted={muted}
            onToggleMute={() => setMuted((value) => !value)}
          />
        </div>
      </main>
    );
  }

  /* alley_puzzle — کوچه سه‌بعدی واقعی (موج ۵) با fallback به CSS امیرعلی */
  return (
    <main className={styles.page}>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 50, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setUseThree((v) => !v)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #c9a86a',
            background: 'rgba(0,0,0,0.7)',
            color: '#e8dcc8',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {useThree ? '🎨 نمای کلاسیک' : '🌐 نمای سه‌بعدی'}
        </button>
      </div>
      {useThree ? (
        <AlleyRoomThreeIntegration
          room={room}
          onPunchTicket={(emblem, actNumber, rowCode) =>
            performAction({ type: 'PUNCH_MY_TICKET', emblem, actNumber, rowCode })
          }
          onUnlockDoor={(doorCode) =>
            performAction({ type: 'UNLOCK_THEATER_DOOR', code: doorCode })
          }
          onSendWhisper={sendWhisper}
        />
      ) : (
        <AlleyFirstPersonScene
          room={room}
          onPunchTicket={(emblem, actNumber, rowCode) =>
            performAction({ type: 'PUNCH_MY_TICKET', emblem, actNumber, rowCode })
          }
          onUnlockDoor={(doorCode) =>
            performAction({ type: 'UNLOCK_THEATER_DOOR', code: doorCode })
          }
          onSendWhisper={sendWhisper}
          onReplayInvitation={() => {
            if (invitePath) router.push(invitePath);
          }}
        />
      )}
    </main>
  );
}

export default function RoomPage({ params }: RoomPageProps) {
  const { code } = use(params);
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <div className={styles.center}>
            <p className={styles.title}>🎭 در حال ورود به تماشاخانه…</p>
          </div>
        </main>
      }
    >
      <RoomExperience roomCode={code} />
    </Suspense>
  );
}
