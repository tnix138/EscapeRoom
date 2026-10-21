'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheaterSession } from '@/client-sdk';
import AlleyFirstPersonScene from '@/components/alley/AlleyFirstPersonScene';
import FirstPersonCutsceneStage from '@/components/cinema/FirstPersonCutsceneStage';
import { resolveRoomPhase } from '@/components/room/resolve-room-phase';
import type { AuditoriumHotspotId } from '@/contracts/types';
import styles from './room.module.css';

interface RoomRuntimeProps {
  code: string;
}

const HOTSPOTS: Array<{ id: AuditoriumHotspotId; label: string; detail: string }> = [
  { id: 'shattered-chandelier', label: 'لوستر شکسته', detail: 'خرده‌شیشه‌های لوستر روی زمین می‌درخشند.' },
  { id: 'crooked-paintings', label: 'تابلوهای کج', detail: 'همهٔ چهره‌ها به سوی صحنه برگشته‌اند.' },
  { id: 'three-dark-stages', label: 'صحنهٔ تاریک', detail: 'اجراکنندگان ناپدید شده‌اند.' },
  { id: 'locked-exit-doors', label: 'درهای خروج', detail: 'درها بسته‌اند؛ انگار چیزی آن‌ها را نگه داشته است.' },
];

function readSeatToken(code: string): string {
  try {
    // sessionStorage is tab-scoped, so players opening distinct invites cannot overwrite seats.
    return window.sessionStorage.getItem(`seat:${code}`) || '';
  } catch {
    return '';
  }
}

export default function RoomRuntime({ code }: RoomRuntimeProps) {
  const [seatToken, setSeatToken] = useState('');
  const [muted, setMuted] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    setSeatToken(readSeatToken(code));
  }, [code]);

  const session = useTheaterSession(code, seatToken);
  const room = session.room;
  const phase = useMemo(
    () => room ? resolveRoomPhase(room.phase, session.cutsceneElapsedMs) : null,
    [room, session.cutsceneElapsedMs],
  );

  if (!seatToken) {
    return (
      <main className={styles.centered}>
        <div className={styles.messageCard}>
          <p className={styles.eyebrow}>تماشاخانهٔ اُرفه‌ئو</p>
          <h1>ورود با دعوت‌نامه</h1>
          <p>برای ورود به این اتاق، پیوند دعوت اختصاصی خود را در همین مرورگر باز کنید.</p>
          <Link className={styles.textLink} href="/">بازگشت به سرسرا</Link>
        </div>
      </main>
    );
  }

  if (session.loading && !room) {
    return (
      <main className={styles.centered} aria-live="polite">
        <div className={styles.messageCard}>
          <p className={styles.eyebrow}>اُرفه‌ئو · اتاق {code}</p>
          <h1>در حال یافتن صندلی شما…</h1>
          <p>تالار برای ورود شما آماده می‌شود.</p>
        </div>
      </main>
    );
  }

  if (session.error && !room) {
    return (
      <main className={styles.centered}>
        <div className={styles.messageCard} role="alert">
          <p className={styles.eyebrow}>اتاق {code}</p>
          <h1>ورود به اتاق ممکن نشد</h1>
          <p>{session.error}</p>
          <button className={styles.button} onClick={() => window.location.reload()}>تلاش دوباره</button>
        </div>
      </main>
    );
  }

  if (!room || !phase) return null;

  if (phase === 'alley_puzzle') {
    return (
      <AlleyFirstPersonScene
        room={room}
        onPunchTicket={(emblem, actNumber, rowCode) => session.performAction({
          type: 'PUNCH_MY_TICKET', emblem, actNumber, rowCode,
        })}
        onUnlockDoor={(doorCode) => session.performAction({ type: 'UNLOCK_THEATER_DOOR', code: doorCode })}
        onSendWhisper={(text, shareStub) => session.sendWhisper(text, shareStub)}
        onReplayInvitation={() => { window.location.href = `/invite/${encodeURIComponent(code)}/${encodeURIComponent(seatToken)}`; }}
      />
    );
  }

  if (phase === 'door_cutscene' || phase === 'theater_cutscene') {
    return (
      <FirstPersonCutsceneStage
        room={room}
        elapsedMs={session.cutsceneElapsedMs}
        muted={muted}
        onToggleMute={() => setMuted((value) => !value)}
      />
    );
  }

  if (phase === 'in_theater') {
    return (
      <main className={styles.auditorium}>
        <header className={styles.auditoriumHeader}>
          <span>اُرفه‌ئو · اتاق {code}</span>
          <span className={styles.liveIndicator}><i /> زنده</span>
        </header>
        <section className={styles.auditoriumContent} aria-labelledby="auditorium-title">
          <p className={styles.eyebrow}>اجرا آغاز شده است</p>
          <h1 id="auditorium-title">تالار نمایش</h1>
          <p className={styles.intro}>درها پشت سرتان بسته می‌شوند. اطراف را بگردید، اما آهسته.</p>
          <div className={styles.stage} aria-hidden="true">
            <div className={styles.curtain} />
            <div className={styles.stageLight} />
          </div>
          <div className={styles.hotspots}>
            {HOTSPOTS.map((hotspot) => {
              const inspectedBy = room.auditorium?.inspectedHotspots[hotspot.id] ?? [];
              const inspected = inspectedBy.includes(room.me.playerId);
              return (
                <button
                  key={hotspot.id}
                  className={`${styles.hotspot} ${inspected ? styles.inspected : ''}`}
                  onClick={async () => {
                    const result = await session.performAction({
                      type: 'INSPECT_AUDITORIUM_HOTSPOT',
                      hotspotId: hotspot.id,
                    });
                    setActionMessage(result.message || hotspot.detail);
                  }}
                >
                  <span>{hotspot.label}</span>
                  <small>{inspected ? 'Inspected' : 'Inspect'}</small>
                </button>
              );
            })}
          </div>
          {actionMessage && <p className={styles.actionMessage} aria-live="polite">{actionMessage}</p>}
        </section>
      </main>
    );
  }

  return null;
}
