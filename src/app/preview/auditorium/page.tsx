'use client';

/**
 * /preview/auditorium — پیش‌نمایش زنده علیرضا (موج ۳)
 * -------------------------------------------------------------
 * بررسی مستقل صحنه شروع مجدد بازی در سالن تاریک پس از پایان کات‌سین
 * (DarkAuditoriumScene) با داده رسمی createPreviewRoomState توحید از src/client-sdk.
 * بررسی نقاط داغ و نجوای تیمی در این Preview روی state محلی اعمال می‌شود تا
 * رفتار همگام‌سازی سرور (اکشن INSPECT_AUDITORIUM_HOTSPOT و چت) شبیه‌سازی شود.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { AuditoriumHotspotId, ClientRoomView } from '@/contracts/types';
import { createPreviewRoomState } from '@/client-sdk';
import DarkAuditoriumScene from '@/components/auditorium/DarkAuditoriumScene';
import styles from './page.module.css';

const DarkAuditoriumThreeScene = dynamic(() => import('@/components/auditorium/DarkAuditoriumThreeScene'), { ssr: false });
const AuditoriumThreeScene = dynamic(() => import('@/components/auditorium/AuditoriumThreeScene'), { ssr: false });

const ROTATED_NAMES = ['علیرضا', 'توحید', 'امیرعلی', 'سارا', 'مریم', 'نیما', 'لیلا', 'کیان'];

function toFaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export default function AuditoriumPreviewPage() {
  const [playerCount, setPlayerCount] = useState(4);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<'three-dark' | 'three-light' | 'css'>('three-dark');
  const [room, setRoom] = useState<ClientRoomView>(() =>
    createPreviewRoomState('in_theater', 4, ROTATED_NAMES),
  );

  const resetRoom = (count: number) => {
    setPlayerCount(count);
    setRoom(createPreviewRoomState('in_theater', count, ROTATED_NAMES));
  };

  const handleInspectHotspot = async (hotspotId: AuditoriumHotspotId): Promise<void> => {
    setRoom((prev) => {
      if (!prev.auditorium) return prev;
      const current = prev.auditorium.inspectedHotspots[hotspotId];
      if (current.includes(prev.me.playerName)) return prev;
      return {
        ...prev,
        version: prev.version + 1,
        auditorium: {
          ...prev.auditorium,
          inspectedHotspots: {
            ...prev.auditorium.inspectedHotspots,
            [hotspotId]: [...current, prev.me.playerName],
          },
        },
      };
    });
  };

  const handleSendWhisper = async (text: string): Promise<void> => {
    setRoom((prev) => ({
      ...prev,
      version: prev.version + 1,
      messages: [
        ...prev.messages,
        {
          id: `preview-whisper-${Date.now()}`,
          senderName: prev.me.playerName,
          type: 'whisper' as const,
          text,
          createdAt: Date.now(),
        },
      ],
    }));
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>پرده سرخ: تماشاخانه اُرفه‌ئو — Preview علیرضا (موج ۳)</p>
          <h1 className={styles.title}>سالن تاریک پس از وحشت — شروع مجدد بازی</h1>
          <p className={styles.subtitle}>
            کات‌سین تمام شده و کنترل برگشته است: سرت را بچرخان، روی نشانه‌های طلایی سالن کلیک کن
            و هر چهار بخش ویران سالن را بررسی کن. آهنگ ترسناک باید بی‌وقفه ادامه داشته باشد 🎧
            تو «{room.me.playerName}» هستی — {room.me.seatLabel}.
          </p>
        </div>
        <div className={styles.countBox}>
          <span>تعداد پلیرهای سالن:</span>
          <div className={styles.countRow}>
            {[3, 4, 5, 6, 7, 8].map((count) => (
              <button
                key={count}
                type="button"
                className={count === playerCount ? styles.countActive : styles.button}
                onClick={() => resetRoom(count)}
              >
                {toFaDigits(count)}
              </button>
            ))}
          </div>
          <small>داده از createPreviewRoomState توحید در فاز in_theater ساخته می‌شود.</small>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, direction: 'rtl' }}>
        <button type="button" onClick={() => setMode('three-dark')} style={{ padding: '6px 12px', borderRadius: 6, border: mode === 'three-dark' ? '2px solid #c9a86a' : '1px solid #555', background: mode === 'three-dark' ? '#1a1a2e' : '#222', color: '#e8dcc8' }}>🌑 سه‌بعدی تاریک (ویران)</button>
        <button type="button" onClick={() => setMode('three-light')} style={{ padding: '6px 12px', borderRadius: 6, border: mode === 'three-light' ? '2px solid #c9a86a' : '1px solid #555', background: mode === 'three-light' ? '#1a1a2e' : '#222', color: '#e8dcc8' }}>🎭 سه‌بعدی روشن (۲۰ صندلی)</button>
        <button type="button" onClick={() => setMode('css')} style={{ padding: '6px 12px', borderRadius: 6, border: mode === 'css' ? '2px solid #c9a86a' : '1px solid #555', background: mode === 'css' ? '#1a1a2e' : '#222', color: '#e8dcc8' }}>🎨 کلاسیک CSS</button>
      </div>

      <div className={styles.stageWrap} style={{ minHeight: 600 }}>
        {mode === 'three-dark' ? (
          <DarkAuditoriumThreeScene room={room} onInspectHotspot={handleInspectHotspot} onSendWhisper={handleSendWhisper} />
        ) : mode === 'three-light' ? (
          <AuditoriumThreeScene room={room} />
        ) : (
          <DarkAuditoriumScene
            room={room}
            muted={muted}
            onToggleMute={() => setMuted((prev) => !prev)}
            onInspectHotspot={handleInspectHotspot}
            onSendWhisper={handleSendWhisper}
          />
        )}
      </div>

      <section className={styles.panel}>
        <h2>🌑 در این صحنه چه باید ببینی؟</h2>
        <ul className={styles.checkList}>
          <li>همان سالن کات‌سین، اما تاریک و ویران: <strong>لوستر شکسته وسط زمین</strong> با زنجیر پاره تاب‌خور، <strong>تابلوهای کج</strong> هر دو دیوار، <strong>سه سِن تاریک</strong> با پرده‌های دریده و <strong>درهای خروجی قفل‌شده</strong>.</li>
          <li>زن و مرد سیاه‌پوش غیب شده‌اند ولی <strong>آهنگ ترسناک (قطعه ۷)</strong> ادامه دارد و با چرخش سر، جهت استریوی آن هم می‌چرخد.</li>
          <li>با کلیک روی هر نشانه و دکمه «بررسی از نزدیک»، نام تو به فهرست بررسی‌کنندگان آن بخش اضافه می‌شود — در بازی واقعی همین اکشن روی سرور برای همه تیم همگام می‌شود.</li>
          <li>از پنل پایین برای هم‌تیمی‌ها نجوا بفرست؛ این نقطه، <strong>پایان فصل اول</strong> و بستر معماهای داخل سالن در فازهای بعدی است.</li>
        </ul>
      </section>

      <footer className={styles.footer}>
        <p>
          کامپوننت: <code dir="ltr">src/components/auditorium/DarkAuditoriumScene.tsx</code> با امضای
          دقیق <code dir="ltr">API-CONTRACT.md §۴٫۳</code> — ادامه مستقیم کات‌سین در{' '}
          <code dir="ltr">/preview/cinema</code>.
        </p>
      </footer>
    </main>
  );
}
