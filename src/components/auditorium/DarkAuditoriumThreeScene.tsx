'use client';

/**
 * DarkAuditoriumThreeScene — سالن تاریک ویران پس از کات‌سین (علیرضا — موج ۹)
 * - لوستر شکسته روی زمین
 * - تابلوهای کج
 * - سه سن تاریک با پرده‌های دریده
 * - درهای قفل
 * - hotspotهای تعاملی با collision
 * - حرکت آزاد
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThreeEngine } from '@/engine3d/useThreeEngine';
import { usePlayerControls } from '@/engine3d/usePlayerControls';
import { createTheaterGeometry } from '@/engine3d/theater-geometry';
import { RemotePlayerManager } from '@/engine3d/presence/RemotePlayerManager';
import { toPresenceSnapshots } from '@/client-sdk/presence-avatars';
import { ThreeErrorBoundary } from '@/engine3d/ThreeErrorBoundary';
import PresenceHud from '../hud/presence/PresenceHud';
import { usePresenceFeed } from '../hud/presence/use-presence-feed';
import type { ClientRoomView, AuditoriumHotspotId } from '@/contracts/types';

export interface DarkAuditoriumThreeSceneProps {
  room: ClientRoomView;
  onInspectHotspot: (id: AuditoriumHotspotId) => Promise<void>;
  onSendWhisper: (text: string) => Promise<void>;
}

function DarkCore({ room, onInspectHotspot, onSendWhisper }: DarkAuditoriumThreeSceneProps) {
  const { canvasRef, engine, isWebGLAvailable, error } = useThreeEngine();
  const theaterRef = useRef<ReturnType<typeof createTheaterGeometry> | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<AuditoriumHotspotId | null>(null);
  const [whisper, setWhisper] = useState('');
  const [inspecting, setInspecting] = useState(false);

  const { transform, requestPointerLock, isPointerLocked } = usePlayerControls({
    engine,
    enabled: true,
  });

  const presence = usePresenceFeed({
    roomCode: room.roomCode,
    seatToken: null,
    playerId: room.me.playerId,
    transform,
    phase: room.phase,
  });

  const presenceNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of room.players) map[player.playerId] = player.playerName;
    return map;
  }, [room.players]);

  const remotePlayersRef = useRef<RemotePlayerManager | null>(null);
  useEffect(() => {
    const manager = new RemotePlayerManager();
    remotePlayersRef.current = manager;
    return () => {
      manager.dispose();
      remotePlayersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const manager = remotePlayersRef.current;
    if (!engine || !manager) return;
    engine.scene.add(manager);
    return () => {
      engine.scene.remove(manager);
    };
  }, [engine]);

  useEffect(() => {
    const manager = remotePlayersRef.current;
    if (!manager) return;
    manager.sync(toPresenceSnapshots(presence.presences, room.me.playerId), Date.now(), room.me.playerId);
  }, [presence.presences, room.me.playerId]);

  // تشخیص نزدیک بودن به hotspot
  const [nearHotspot, setNearHotspot] = useState<AuditoriumHotspotId | null>(null);

  useEffect(() => {
    if (!engine) return;

    const theater = createTheaterGeometry();
    theaterRef.current = theater;

    // تبدیل به حالت ویران
    // لوستر شکسته روی زمین
    theater.chandelier.position.set(0, 0.15, 0);
    theater.chandelier.rotation.set(Math.PI / 2.5, 0, 0.3);
    theater.chandelier.scale.set(1.2, 0.6, 1.2);

    // تابلوهای کج
    theater.group.children.forEach((child) => {
      if (child.name.startsWith('Painting_')) {
        child.rotation.z = (Math.random() - 0.5) * 0.6;
        child.position.y += (Math.random() - 0.5) * 0.3;
      }
    });

    // سن‌ها تاریک
    [theater.stages.left, theater.stages.center, theater.stages.right].forEach((stage) => {
      const curtain = stage.getObjectByName('Curtain') as THREE.Mesh | undefined;
      if (curtain) {
        const mat = curtain.material as THREE.MeshStandardMaterial;
        mat.color.set(0x3a0a0a);
        mat.roughness = 1;
        curtain.position.y = 1.5;
        curtain.scale.y = 0.4;
      }
    });

    // مخفی کردن شخصیت‌ها
    theater.dancer.visible = false;
    theater.darkMan.visible = false;

    // مه تاریک
    engine.scene.fog = new THREE.Fog(0x0a0a12, 4, 14);
    engine.scene.background = new THREE.Color(0x050508);

    // نور کم
    theater.lights.forEach((light) => {
      if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        light.intensity *= 0.25;
      }
    });

    // نور سوسو
    const flicker = new THREE.PointLight(0x445588, 0.6, 10);
    flicker.position.set(0, 4, 0);
    theater.group.add(flicker);

    engine.scene.add(theater.group);
    engine.camera.position.set(0, 1.65, 4);

    let flickerTime = 0;
    engine.setTick((delta) => {
      flickerTime += delta;
      flicker.intensity = 0.4 + Math.sin(flickerTime * 7) * 0.2 + Math.random() * 0.15;
      remotePlayersRef.current?.update(delta);
    });

    engine.start();

    return () => {
      engine.stop();
      if (theaterRef.current) {
        engine.scene.remove(theaterRef.current.group);
        theaterRef.current.dispose();
        theaterRef.current = null;
      }
    };
  }, [engine]);

  // تشخیص hotspot نزدیک بر اساس موقعیت
  useEffect(() => {
    const hotspots: Record<AuditoriumHotspotId, { x: number; z: number }> = {
      'shattered-chandelier': { x: 0, z: 0 },
      'crooked-paintings': { x: -8, z: -2 },
      'three-dark-stages': { x: 0, z: -6 },
      'locked-exit-doors': { x: 8.5, z: 2 },
    };

    let nearest: AuditoriumHotspotId | null = null;
    let minDist = 3.5;
    for (const [id, pos] of Object.entries(hotspots) as Array<[AuditoriumHotspotId, { x: number; z: number }]>) {
      const d = Math.hypot(pos.x - transform.x, pos.z - transform.z);
      if (d < minDist) {
        minDist = d;
        nearest = id;
      }
    }
    setNearHotspot(nearest);
  }, [transform]);

  const handleInspect = async () => {
    if (!nearHotspot || inspecting) return;
    setInspecting(true);
    try {
      await onInspectHotspot(nearHotspot);
      setSelectedHotspot(nearHotspot);
    } finally {
      setInspecting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && nearHotspot) void handleInspect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearHotspot]);

  if (!isWebGLAvailable) {
    return (
      <div className="scene-fallback">
        <h2>🖥️ WebGL در دسترس نیست</h2>
        <p>نمای سه‌بعدی روی این مرورگر اجرا نمی‌شود؛ با دکمهٔ «نمای کلاسیک» همان سالن را ببینید.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="scene-fallback">
        <h2>⚠️ خطا در موتور سه‌بعدی</h2>
        <p>با دکمهٔ «نمای کلاسیک» ادامه دهید یا صفحه را تازه کنید.</p>
        <pre>{error}</pre>
      </div>
    );
  }

  const hotspotMeta: Record<AuditoriumHotspotId, { icon: string; title: string; desc: string }> = {
    'shattered-chandelier': { icon: '💎', title: 'لوستر شکسته', desc: 'لوستر کریستالی وسط سالن خرد شده — زنجیر پاره‌اش آرام تاب می‌خورد.' },
    'crooked-paintings': { icon: '🖼️', title: 'تابلوهای کج', desc: 'قاب‌های طلایی کج شده‌اند — پشت یکی رد پنج انگشت دوده‌ای است.' },
    'three-dark-stages': { icon: '🎭', title: 'سه سن تاریک', desc: 'پرده‌های سرخ دریده و پشت آن‌ها تاریکی مطلق — هیچ‌کس نمانده.' },
    'locked-exit-doors': { icon: '🔒', title: 'درهای قفل', desc: 'هر دو خروجی قفل و زنجیر شده‌اند — راه فرار از همین سالن می‌گذرد.' },
  };

  const auditorium = room.auditorium;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050508' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} tabIndex={0} aria-label="سالن تاریک ویران — حرکت آزاد" />

      {/* کراس‌هیر */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 18, height: 18, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(232,220,200,0.6)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(232,220,200,0.6)' }} />
      </div>

      <PresenceHud
        local={{ position: transform, yawDeg: transform.yawDeg, pitchDeg: transform.pitchDeg }}
        players={presence.presences}
        names={presenceNames}
        localPlayerId={room.me.playerId}
        now={presence.serverNow ?? undefined}
      />

      {/* HUD */}
      <div className="darkhall-hud">
        <div className="darkhall-hint">
          <span className="darkhall-banner">🌑 {auditorium?.chapterStatusBanner ?? 'سالن تاریک — زن و مرد غیب شده‌اند'}</span>
          <span className="darkhall-keys">
            <span className="alley3d-desktop-only">W/A/S/D حرکت — ماوس نگاه — E بررسی</span>
            <span className="alley3d-touch-only">پد جهت‌دار حرکت — کشیدن انگشت نگاه</span>
          </span>
          {nearHotspot && (
            <div className="darkhall-near">
              🎯 {hotspotMeta[nearHotspot].icon} {hotspotMeta[nearHotspot].title} —{' '}
              <span className="alley3d-desktop-only">E برای بررسی</span>
              <span className="alley3d-touch-only">بررسی کنید</span> {inspecting ? '(در حال ثبت…)' : ''}
            </div>
          )}
        </div>
        <div className="darkhall-actions">
          {/* روی گوشی کلید E وجود ندارد؛ این دکمه همان بررسی را انجام می‌دهد. */}
          <button
            type="button"
            className="darkhall-button darkhall-inspect"
            onClick={() => void handleInspect()}
            disabled={!nearHotspot || inspecting}
          >
            🎯 بررسی
          </button>
          <button type="button" className="darkhall-button darkhall-lock" onClick={() => requestPointerLock()}>
            {isPointerLocked ? '🔓 خروج' : '🔒 قفل ماوس'}
          </button>
        </div>
      </div>

      {/* کارت hotspot */}
      {selectedHotspot && (
        <div className="darkhall-card">
          <div className="darkhall-card-head">
            <strong>{hotspotMeta[selectedHotspot].icon} {hotspotMeta[selectedHotspot].title}</strong>
            <button type="button" className="darkhall-card-close" onClick={() => setSelectedHotspot(null)} aria-label="بستن کارت">✕</button>
          </div>
          <p>{hotspotMeta[selectedHotspot].desc}</p>
          <div className="darkhall-card-meta">
            بررسی‌شده توسط: {(auditorium?.inspectedHotspots[selectedHotspot] ?? []).join('، ') || 'هیچ‌کس هنوز'}
          </div>
        </div>
      )}

      {/* چت */}
      <div className="darkhall-chat">
        <div className="darkhall-chat-log">
          {room.messages.slice(-10).map((m) => (
            <div key={m.id} style={{ fontSize: 12, color: '#e8dcc8', marginBottom: 4 }}>
              <strong>{m.senderName}:</strong> {m.text}
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!whisper.trim()) return;
            void onSendWhisper(whisper);
            setWhisper('');
          }}
          className="darkhall-chat-form"
        >
          <input className="darkhall-chat-input" value={whisper} onChange={(e) => setWhisper(e.target.value)} placeholder="نجوا در تاریکی…" maxLength={300} />
          <button type="submit" className="darkhall-chat-send">ارسال</button>
        </form>
      </div>
    </div>
  );
}

export default function DarkAuditoriumThreeScene(props: DarkAuditoriumThreeSceneProps) {
  return (
    <ThreeErrorBoundary>
      <div className="darkhall-stage">
        <DarkCore {...props} />
      </div>
    </ThreeErrorBoundary>
  );
}
