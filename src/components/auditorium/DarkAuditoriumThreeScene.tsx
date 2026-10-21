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

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThreeEngine } from '@/engine3d/useThreeEngine';
import { usePlayerControls } from '@/engine3d/usePlayerControls';
import { createTheaterGeometry } from '@/engine3d/theater-geometry';
import { ThreeErrorBoundary } from '@/engine3d/ThreeErrorBoundary';
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
    return <div dir="rtl" style={{ padding: 24, color: '#e8dcc8', background: '#0a0a12' }}>WebGL در دسترس نیست — نمای کلاسیک فعال است.</div>;
  }
  if (error) return <div style={{ color: '#ff8a8a' }}>خطا: {error}</div>;

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

      {/* HUD */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', direction: 'rtl', pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', color: '#e8dcc8', padding: '8px 12px', borderRadius: 8, fontSize: 12, pointerEvents: 'auto' }}>
          🌑 {auditorium?.chapterStatusBanner ?? 'سالن تاریک — زن و مرد غیب شده‌اند'}
          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>W/A/S/D حرکت — ماوس نگاه — E بررسی</div>
          {nearHotspot && (
            <div style={{ marginTop: 6, color: '#c9a86a' }}>
              🎯 {hotspotMeta[nearHotspot].icon} {hotspotMeta[nearHotspot].title} — E برای بررسی {inspecting ? '(در حال ثبت…)' : ''}
            </div>
          )}
        </div>
        <button type="button" onClick={() => requestPointerLock()} style={{ pointerEvents: 'auto', padding: '6px 12px', borderRadius: 6, border: '1px solid #c9a86a', background: 'rgba(0,0,0,0.6)', color: '#e8dcc8', fontSize: 11, cursor: 'pointer' }}>
          {isPointerLocked ? '🔓 خروج' : '🔒 قفل ماوس'}
        </button>
      </div>

      {/* کارت hotspot */}
      {selectedHotspot && (
        <div style={{ position: 'absolute', top: 80, right: 20, width: 320, background: 'rgba(15,10,10,0.92)', color: '#e8dcc8', padding: 16, borderRadius: 12, border: '1px solid #c9a86a', direction: 'rtl', pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{hotspotMeta[selectedHotspot].icon} {hotspotMeta[selectedHotspot].title}</strong>
            <button type="button" onClick={() => setSelectedHotspot(null)} style={{ background: 'none', border: 'none', color: '#e8dcc8', cursor: 'pointer' }}>✕</button>
          </div>
          <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7 }}>{hotspotMeta[selectedHotspot].desc}</p>
          <div style={{ marginTop: 12, fontSize: 12 }}>
            بررسی‌شده توسط: {(auditorium?.inspectedHotspots[selectedHotspot] ?? []).join('، ') || 'هیچ‌کس هنوز'}
          </div>
        </div>
      )}

      {/* چت */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, width: 340, background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: 8, direction: 'rtl', pointerEvents: 'auto' }}>
        <div style={{ maxHeight: 120, overflow: 'auto', marginBottom: 8 }}>
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
          style={{ display: 'flex', gap: 6 }}
        >
          <input value={whisper} onChange={(e) => setWhisper(e.target.value)} placeholder="نجوا در تاریکی…" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#1a1a2e', color: '#e8dcc8', fontSize: 12 }} maxLength={300} />
          <button type="submit" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #c9a86a', background: '#2a1a1a', color: '#e8dcc8', fontSize: 12, cursor: 'pointer' }}>ارسال</button>
        </form>
      </div>
    </div>
  );
}

export default function DarkAuditoriumThreeScene(props: DarkAuditoriumThreeSceneProps) {
  return (
    <ThreeErrorBoundary>
      <div style={{ width: '100%', height: '100%', minHeight: 600, background: '#050508', position: 'relative' }}>
        <DarkCore {...props} />
      </div>
    </ThreeErrorBoundary>
  );
}
