'use client';

/**
 * AlleyRoomThreeIntegration — اتصال کوچه سه‌بعدی واقعی به داده‌های سرور (علیرضا — موج ۵/۶)
 * - دریافت room از سرور (ClientRoomView)
 * - اسپاون بر اساس seatIndex + ذخیره موقعیت برای reconnect
 * - تشخیص لنگر نزدیک (playbill / rowChart / theaterDoor) با فاصله
 * - نمایش UI امیرعلی به صورت overlay فارسی در کنار صحنه سه‌بعدی
 * - گذار در → کات‌سین با فید سیاه
 * - بدون تغییر منطق پازل سرور — فقط درخواست‌های توافق‌شده
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useThreeEngine } from '@/engine3d/useThreeEngine';
import { usePlayerControls } from '@/engine3d/usePlayerControls';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import { resolveInitialTransform, saveTransform } from '@/engine3d/spawn';
import { createTransitionState, type TransitionPhase } from '@/engine3d/transition';
import { ThreeErrorBoundary } from '@/engine3d/ThreeErrorBoundary';
import type { PlayerTransform } from '@/engine3d/types';
import type { ClientRoomView } from '@/contracts/types';
import type { TheaterEmblemId, PlayActNumber, RowRomanCode } from '@/components/alley/contracts';
import HeldTicketsDrawer from './HeldTicketsDrawer';
import ClueReadingPanel from './ClueReadingPanel';
import TheaterDoorLockModal from './TheaterDoorLockModal';
import WhisperChatPanel from '../hud/WhisperChatPanel';

const AlleyThreeSceneCore = dynamic(() => Promise.resolve(ThreeCore), { ssr: false });

interface ThreeCoreProps {
  room: ClientRoomView;
  onPunchTicket: (emblem: TheaterEmblemId, actNumber: PlayActNumber, rowCode: RowRomanCode) => Promise<{ accepted: boolean; message: string }>;
  onUnlockDoor: (code: string) => Promise<{ accepted: boolean; message: string }>;
  onSendWhisper: (text: string, shareStub?: boolean) => Promise<void>;
  onDoorTransition?: () => void;
}

function ThreeCore({ room, onPunchTicket, onUnlockDoor, onSendWhisper, onDoorTransition }: ThreeCoreProps) {
  const { canvasRef, engine, isWebGLAvailable, error } = useThreeEngine();
  const alleyRef = useRef<ReturnType<typeof createAlleyGeometry> | null>(null);
  const [focusedAnchor, setFocusedAnchor] = useState<'playbill' | 'rowChart' | 'theaterDoor' | null>(null);
  const [doorModalOpen, setDoorModalOpen] = useState(false);
  const [ticketFeedback, setTicketFeedback] = useState('');
  const [localPunched, setLocalPunched] = useState(false);
  const [localDigit, setLocalDigit] = useState<number | null>(null);
  const [isPunching, setIsPunching] = useState(false);
  const [transition, setTransition] = useState<{ phase: TransitionPhase; progress: number } | null>(null);
  const [showPlaybill, setShowPlaybill] = useState(false);
  const [showRowChart, setShowRowChart] = useState(false);

  const initialTransform = resolveInitialTransform(room.roomCode, room.me.playerId, room.me.seatIndex);

  const { transform, isPointerLocked, requestPointerLock } = usePlayerControls({
    engine,
    enabled: true,
    initialTransform,
  });

  // ذخیره موقعیت برای reconnect
  useEffect(() => {
    const id = setTimeout(() => {
      saveTransform(room.roomCode, room.me.playerId, transform);
    }, 500);
    return () => clearTimeout(id);
  }, [transform, room.roomCode, room.me.playerId]);

  // تشخیص لنگر نزدیک
  useEffect(() => {
    if (!alleyRef.current) return;
    const anchors = alleyRef.current.anchors;
    const dist = (a: { x: number; z: number }) => Math.hypot(a.x - transform.x, a.z - transform.z);
    const dPlaybill = dist({ x: anchors.playbill.x, z: anchors.playbill.z });
    const dRowChart = dist({ x: anchors.rowChart.x, z: anchors.rowChart.z });
    const dDoor = dist({ x: anchors.theaterDoor.x, z: anchors.theaterDoor.z });

    let nearest: typeof focusedAnchor = null;
    let min = 2.8;
    if (dPlaybill < min) {
      min = dPlaybill;
      nearest = 'playbill';
    }
    if (dRowChart < min) {
      min = dRowChart;
      nearest = 'rowChart';
    }
    if (dDoor < min) {
      min = dDoor;
      nearest = 'theaterDoor';
    }
    if (nearest !== focusedAnchor) setFocusedAnchor(nearest);
  }, [transform, focusedAnchor]);

  // ساخت صحنه
  useEffect(() => {
    if (!engine) return;
    const alley = createAlleyGeometry();
    alleyRef.current = alley;
    engine.scene.add(alley.group);
    engine.start();
    return () => {
      engine.stop();
      if (alleyRef.current) {
        engine.scene.remove(alleyRef.current.group);
        alleyRef.current.dispose();
        alleyRef.current = null;
      }
    };
  }, [engine]);

  // کلید E برای تعامل
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE') return;
      if (focusedAnchor === 'playbill') setShowPlaybill((v) => !v);
      if (focusedAnchor === 'rowChart') setShowRowChart((v) => !v);
      if (focusedAnchor === 'theaterDoor') setDoorModalOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedAnchor]);

  const handlePunch = useCallback(
    async (emblem: TheaterEmblemId, actNumber: PlayActNumber, rowCode: RowRomanCode) => {
      if (isPunching) return { accepted: false, message: 'در حال بررسی…' };
      setIsPunching(true);
      try {
        const res = await onPunchTicket(emblem, actNumber, rowCode);
        setTicketFeedback(res.message);
        if (res.accepted) {
          setLocalPunched(true);
          const digit = room.me.revealedDoorDigit ?? Math.floor(Math.random() * 10);
          setLocalDigit(digit);
        }
        return res;
      } finally {
        setIsPunching(false);
      }
    },
    [isPunching, onPunchTicket, room.me.revealedDoorDigit],
  );

  const handleUnlock = useCallback(
    async (code: string) => {
      const res = await onUnlockDoor(code);
      if (res.accepted) {
        setTransition({ phase: 'door_opening', progress: 0 });
        let p = 0;
        const interval = setInterval(() => {
          p += 0.05;
          if (p >= 1) {
            clearInterval(interval);
            setTransition({ phase: 'fading_to_cutscene', progress: 1 });
            setTimeout(() => onDoorTransition?.(), 800);
          } else {
            setTransition({ phase: 'door_opening', progress: p });
          }
        }, 80);
      }
      return res;
    },
    [onUnlockDoor, onDoorTransition],
  );

  if (!isWebGLAvailable) {
    return (
      <div dir="rtl" style={{ padding: 24, background: '#0a0a12', color: '#e8dcc8' }}>
        WebGL در دسترس نیست — لطفاً از نمای کلاسیک استفاده کنید.
        {error && <div style={{ color: '#ff8a8a', marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  // داده‌های alley از سرور
  const alleyView = (room as unknown as { alley?: { leftWallPlaybill: unknown[]; rightWallRowChart: unknown[]; doorLockState: { punchedCount: number; requiredCount: number; attempts: number; lastAttemptFeedback: string | null } } }).alley;
  const playbill = (alleyView?.leftWallPlaybill as Array<{ actNumber: number; sceneTitle: string; description: string }>) ?? [];
  const rowChart = (alleyView?.rightWallRowChart as Array<{ rowTitle: string; romanCode: string }>) ?? [];

  const isTicketPunched = room.me.ticketPunched || localPunched;
  const revealedDigit = room.me.revealedDoorDigit ?? localDigit;

  // coupon text از room.myHeldTickets
  const myTickets = (room as unknown as { myHeldTickets?: { companionStub?: { targetTeammateName: string; targetEmblem: string; targetActSceneTitle: string; whisperNote: string } } }).myHeldTickets;
  const couponText = myTickets?.companionStub
    ? `کوپن من برای ${myTickets.companionStub.targetTeammateName}: نماد ${myTickets.companionStub.targetEmblem}؛ پردهٔ «${myTickets.companionStub.targetActSceneTitle}». ${myTickets.companionStub.whisperNote}`
    : '';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0a0a12' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        tabIndex={0}
        aria-label="کوچه سه‌بعدی — W/A/S/D حرکت، ماوس نگاه، E تعامل"
      />

      {/* کراس‌هیر */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 18, height: 18, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(232,220,200,0.7)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(232,220,200,0.7)' }} />
      </div>

      {/* HUD پایین */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none', direction: 'rtl' }}>
        <div style={{ background: 'rgba(0,0,0,0.65)', color: '#e8dcc8', padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.6, pointerEvents: 'auto', fontFamily: 'Vazirmatn' }}>
          <div>🎮 W/A/S/D + Shift — حرکت | ماوس درگ — نگاه | E — تعامل</div>
          <div>📍 {transform.x.toFixed(1)}, {transform.z.toFixed(1)} — {transform.yawDeg.toFixed(0)}° {isPointerLocked ? '🔒' : ''}</div>
          {focusedAnchor && (
            <div style={{ color: '#c9a86a', marginTop: 4 }}>
              {focusedAnchor === 'playbill' && '🎭 نزدیک تابلوی اعلانات — E برای نمایش پوستر'}
              {focusedAnchor === 'rowChart' && '📋 نزدیک گیشه — E برای جدول ردیف‌ها'}
              {focusedAnchor === 'theaterDoor' && '🚪 نزدیک در تئاتر — E برای قفل'}
            </div>
          )}
          {ticketFeedback && <div style={{ marginTop: 6, color: isTicketPunched ? '#8aff8a' : '#ffd080' }}>{ticketFeedback}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <button type="button" onClick={() => requestPointerLock()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #c9a86a', background: 'rgba(26,26,46,0.9)', color: '#e8dcc8', cursor: 'pointer', fontSize: 12 }}>
            {isPointerLocked ? '🔓 خروج (Esc)' : '🔒 قفل ماوس'}
          </button>
        </div>
      </div>

      {/* حالت خواندن سرنخ — مشترک با نمای کلاسیک (موج ۴) */}
      {showPlaybill && (
        <ClueReadingPanel
          kind="playbill"
          open
          playbill={playbill}
          rowChart={rowChart}
          punchedCount={room.players.filter((p) => p.ticketPunched).length}
          playerCount={room.playerCount}
          onClose={() => setShowPlaybill(false)}
        />
      )}

      {showRowChart && (
        <ClueReadingPanel
          kind="rowChart"
          open
          playbill={playbill}
          rowChart={rowChart}
          punchedCount={room.players.filter((p) => p.ticketPunched).length}
          playerCount={room.playerCount}
          onClose={() => setShowRowChart(false)}
        />
      )}

      {/* بلیط و چت */}
      <div style={{ position: 'absolute', bottom: 80, left: 12, right: 12, display: 'flex', gap: 12, pointerEvents: 'none', direction: 'rtl' }}>
        <div style={{ pointerEvents: 'auto', flex: 1, maxWidth: 380 }}>
          {/* HeldTicketsDrawer از امیرعلی — props اصلی */}
          <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: 8 }}>
            <div style={{ color: '#e8dcc8', fontSize: 12, marginBottom: 6 }}>
              🎟️ بلیط {room.me.playerName} — {room.me.seatLabel} {isTicketPunched && revealedDigit != null ? `— رقم: ${revealedDigit}` : ''}
            </div>
            <HeldTicketsDrawer
              ownerName={room.me.playerName}
              seatLabel={room.me.seatLabel}
              playTitle="اجرای محرمانه امشب"
              alleyRowHintName="ردیف سرخ"
              companionStub={{
                targetTeammateName: myTickets?.companionStub?.targetTeammateName ?? 'هم‌تیمی',
                targetEmblem: (myTickets?.companionStub?.targetEmblem as TheaterEmblemId) ?? 'mask',
                targetActSceneTitle: myTickets?.companionStub?.targetActSceneTitle ?? 'پرده اول',
                whisperNote: myTickets?.companionStub?.whisperNote ?? '',
              }}
              initialSelection={null}
              isValidated={isTicketPunched}
              revealedDigit={revealedDigit ?? null}
              isPunching={isPunching}
              onPunch={(sel) => {
                void handlePunch(sel.emblem, sel.actNumber, sel.rowCode);
              }}
              onShareStub={() => {
                void onSendWhisper(couponText, true);
              }}
            />
          </div>
        </div>
        <div style={{ pointerEvents: 'auto', flex: 1, maxWidth: 360 }}>
          <WhisperChatPanel messages={room.messages} currentPlayerName={room.me.playerName} couponText={couponText} onSendWhisper={onSendWhisper} />
        </div>
      </div>

      {/* مودال قفل در */}
      <TheaterDoorLockModal
        room={{
          roomCode: room.roomCode,
          playerCount: room.playerCount,
          players: room.players as unknown as { playerId: string; playerName: string; ticketPunched: boolean }[],
          alley: {
            doorLockState: {
              punchedCount: room.players.filter((p) => p.ticketPunched).length,
              requiredCount: room.playerCount,
              attempts: 0,
              lastAttemptFeedback: null,
            },
            leftWallPlaybill: [],
            rightWallRowChart: [],
          },
        } as unknown as import('@/components/alley/contracts').AlleyRoomView}
        open={doorModalOpen}
        onClose={() => setDoorModalOpen(false)}
        onUnlock={handleUnlock}
      />

      {/* گذار */}
      {transition && (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${transition.progress * 0.92})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8dcc8', fontSize: 18, direction: 'rtl', transition: 'background 0.2s' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{transition.phase === 'door_opening' ? '🚪' : '🎭'}</div>
            <div>{transition.phase === 'door_opening' ? 'درهای سنگین گشوده می‌شوند…' : 'چراغ‌ها خاموش می‌شوند…'}</div>
            <div style={{ marginTop: 12, width: 200, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden', marginInline: 'auto' }}>
              <div style={{ width: `${transition.progress * 100}%`, height: '100%', background: '#c9a86a', transition: 'width 0.1s' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlleyRoomThreeIntegration(props: ThreeCoreProps) {
  return (
    <ThreeErrorBoundary>
      <div style={{ width: '100%', height: '100%', minHeight: 600, background: '#0a0a12', position: 'relative' }}>
        <AlleyThreeSceneCore {...props} />
      </div>
    </ThreeErrorBoundary>
  );
}
