'use client';

/**
 * /qa/exploration — سطح بازبینی HUD کاوش (موج ۹ امیرعلی)
 * ---------------------------------------------------------
 * این صفحه فقط برای بازبینی چشمی و دستیِ HUD کاوش است و در مسیر بازیکن لینک نشده.
 * چون صحنهٔ سالن تاریک در مالکیت علیرضا است، برای دیدن «حالت سالن» بدون دست‌زدن به
 * فایل‌های او این سطح مستقل ساخته شده؛ داده‌ها از همان fixture رسمی تیم می‌آیند.
 */

import { useState } from 'react';
import type { AuditoriumHotspotId, ClientRoomView } from '@/contracts/types';
import { createPreviewRoomState } from '@/client-sdk';
import ExplorationHud from '@/components/hud/ExplorationHud';
import { HALL_HOTSPOTS, type ExplorationInput } from '@/components/hud/exploration-hud';

const PLAYER_NAMES = ['سارا', 'نیما', 'لیلا', 'کیان'];
const EMPTY_HOTSPOTS: Record<AuditoriumHotspotId, string[]> = {
  'shattered-chandelier': [],
  'crooked-paintings': [],
  'three-dark-stages': [],
  'locked-exit-doors': [],
};

const BASE_ROOM: ClientRoomView = createPreviewRoomState('in_theater', 4, PLAYER_NAMES);

export default function ExplorationQaPage() {
  const room = BASE_ROOM;
  const [inspected, setInspected] = useState<Record<AuditoriumHotspotId, string[]>>({ ...EMPTY_HOTSPOTS });
  const [messages, setMessages] = useState<Array<{ id: string; senderName: string; text: string; type: 'whisper' | 'ticket_share' | 'system' }>>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(0);

  const input: ExplorationInput = {
    phase: 'in_theater',
    me: { playerName: room.me.playerName, seatIndex: room.me.seatIndex },
    players: room.players.map((player) => ({
      playerName: player.playerName,
      seatLabel: player.seatLabel,
      seatIndex: player.seatIndex,
      ticketPunched: player.ticketPunched,
      isOnline: player.isOnline,
    })),
    auditorium: { inspectedHotspots: inspected },
    messages,
    positionLabel: 'سالن تاریک · رو به سن',
  };

  const myName = room.me.playerName;
  const teammateName = room.players[1]?.playerName ?? 'نیما';

  function toggleHotspot(id: AuditoriumHotspotId) {
    setInspected((previous) => {
      const mine = previous[id].includes(myName);
      return {
        ...previous,
        [id]: mine ? previous[id].filter((name) => name !== myName) : [...previous[id], myName],
      };
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0, #2a1a20, #0c090c 70%)', color: '#e8dcc8', padding: '24px 16px 90px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <p style={{ margin: 0, color: '#c9a86a', fontSize: 14 }}>سطح بازبینی — خارج از مسیر بازیکن</p>
        <h1 style={{ margin: '6px 0 4px', fontSize: 26, fontWeight: 500 }}>HUD کاوش سالن تاریک</h1>
        <p style={{ margin: '0 0 18px', color: '#bfae97', fontSize: 16, lineHeight: 1.9 }}>
          دکمه‌های زیر همان داده‌هایی را می‌سازند که سرور در فاز <code>`in_theater`</code> می‌دهد. HUD گوشهٔ صفحه
          می‌نشیند و با «پنهان کردن» به یک دکمهٔ کوچک تبدیل می‌شود.
        </p>

        <section style={{ display: 'grid', gap: 10, padding: 14, border: '1px solid rgba(212,175,99,0.28)', background: 'rgba(255,255,255,0.03)' }} aria-label="کنترل‌های بازبینی">
          <strong style={{ fontSize: 16, fontWeight: 500 }}>بررسی نقاط سالن</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HALL_HOTSPOTS.map((hotspot) => {
              const done = inspected[hotspot.id].length > 0;
              return (
                <button
                  key={hotspot.id}
                  type="button"
                  onClick={() => toggleHotspot(hotspot.id)}
                  aria-pressed={done}
                  style={{
                    minHeight: 44,
                    padding: '8px 12px',
                    fontSize: 14,
                    border: `1px solid ${done ? 'rgba(166,189,133,0.6)' : 'rgba(212,175,99,0.35)'}`,
                    background: done ? 'rgba(166,189,133,0.14)' : 'rgba(0,0,0,0.35)',
                    color: '#ecdfc9',
                    cursor: 'pointer',
                  }}
                >
                  {done ? '✓ ' : '· '}{hotspot.title}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => setMessages((previous) => [
                ...previous,
                { id: `qa-${previous.length + 1}`, senderName: teammateName, text: 'لوستر شکسته را دیدم؛ کسی تابلوی سمت راست را بررسی کرد؟', type: 'whisper' },
              ])}
              style={{ minHeight: 44, padding: '8px 12px', fontSize: 14, border: '1px solid rgba(212,175,99,0.35)', background: 'rgba(0,0,0,0.35)', color: '#ecdfc9', cursor: 'pointer' }}
            >
              افزودن پیام گروهی
            </button>
            <button
              type="button"
              onClick={() => { setInspected({ ...EMPTY_HOTSPOTS }); setMessages([]); }}
              style={{ minHeight: 44, padding: '8px 12px', fontSize: 14, border: '1px solid rgba(212,175,99,0.35)', background: 'rgba(0,0,0,0.35)', color: '#ecdfc9', cursor: 'pointer' }}
            >
              پاک کردن وضعیت
            </button>
            <button
              type="button"
              onClick={() => setPanelKey((value) => value + 1)}
              style={{ minHeight: 44, padding: '8px 12px', fontSize: 14, border: '1px solid rgba(212,175,99,0.35)', background: 'rgba(0,0,0,0.35)', color: '#ecdfc9', cursor: 'pointer' }}
            >
              ریست پنل
            </button>
          </div>
        </section>

        {chatOpen && (
          <p role="status" style={{ marginTop: 14, color: '#c2d3a4', fontSize: 14 }}>
            ✓ پنل گفتگو از داخل HUD باز شد (در بازی، همین دکمه پنل نجوای گروهی را باز می‌کند).
            <button type="button" onClick={() => setChatOpen(false)} style={{ marginInlineStart: 10, minHeight: 44, padding: '4px 10px', fontSize: 14, border: '1px solid rgba(212,175,99,0.35)', background: 'transparent', color: '#ecdfc9', cursor: 'pointer' }}>
              بستن
            </button>
          </p>
        )}
      </div>

      <ExplorationHud key={panelKey} input={input} onOpenChat={() => setChatOpen(true)} defaultOpen />
    </div>
  );
}
