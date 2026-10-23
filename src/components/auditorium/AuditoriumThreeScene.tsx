'use client';

/**
 * AuditoriumThreeScene — سالن تئاتر ۲۰ نفره سه‌بعدی واقعی (علیرضا — موج ۷)
 * - هندسه تئاتر از theater-geometry
 * - فقط پلیرهای واقعی ۳ تا ۸ نفر روی صندلی‌ها — بقیه خالی
 * - نشستن پلکانی با برچسب نام
 * - رقصنده و مرد سیاه‌پوش با تناسبات بزرگسال باورپذیر
 * - نورپردازی سینمایی + مه
 * - کنترل نگاه محدود (POV) برای کات‌سین
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThreeEngine } from '@/engine3d/useThreeEngine';
import { createSeatedPlayerCharacter, createTheaterGeometry } from '@/engine3d/theater-geometry';
import type { HumanAvatar } from '@/engine3d/characters/human-avatar';
import { ThreeErrorBoundary } from '@/engine3d/ThreeErrorBoundary';
import type { ClientRoomView } from '@/contracts/types';

export interface AuditoriumThreeSceneProps {
  room: ClientRoomView;
  elapsedMs?: number; // برای کات‌سین
  showAllSeats?: boolean;
  onSeatClick?: (row: number, col: number) => void;
}

function TheaterCore({ room, elapsedMs = 0, showAllSeats = false, onSeatClick }: AuditoriumThreeSceneProps) {
  const { canvasRef, engine, isWebGLAvailable, error } = useThreeEngine();
  const theaterRef = useRef<ReturnType<typeof createTheaterGeometry> | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  // نگاشت بازیکنان به صندلی‌ها — بر اساس seatIndex
  const seatAssignments = room.players.map((player, idx) => ({
    player,
    seatIndex: player.seatIndex,
    row: Math.floor(player.seatIndex / 5) + 1,
    col: (player.seatIndex % 5) + 1,
  }));

  useEffect(() => {
    if (!engine) return;

    const theater = createTheaterGeometry();
    theaterRef.current = theater;
    engine.scene.add(theater.group);

    // قرار دادن بازیکنان روی صندلی‌ها با کاراکتر سه‌بعدی کامل انسان
    const seatedAvatars: THREE.Group[] = [];
    let localSeatedAvatar: THREE.Group | null = null;
    seatAssignments.forEach(({ player, row, col }) => {
      const seat = theater.seats.find((s) => s.userData.row === row && s.userData.col === col);
      if (seat) {
        const isLocalPlayer = player.playerId === room.me.playerId;
        seat.userData.occupied = true;
        seat.userData.playerName = player.playerName;

        const avatar = createSeatedPlayerCharacter({
          playerId: player.playerId,
          playerName: player.playerName,
          seatIndex: player.seatIndex,
          isLocalPlayer,
        });
        seat.add(avatar);
        seatedAvatars.push(avatar);

        if (isLocalPlayer) {
          localSeatedAvatar = avatar;
        } else {
          // برچسب نام فقط برای هم‌تیمی‌های دیگر
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 64;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(0, 0, 256, 64);
          ctx.fillStyle = '#e8dcc8';
          ctx.font = 'bold 20px Vazirmatn';
          ctx.textAlign = 'center';
          ctx.fillText(player.playerName, 128, 38);
          const tex = new THREE.CanvasTexture(canvas);
          const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
          const labelGeo = new THREE.PlaneGeometry(1.2, 0.3);
          const label = new THREE.Mesh(labelGeo, labelMat);
          label.position.set(0, 1.6, 0);
          label.name = 'NameLabel';
          seat.add(label);
        }
      }
    });

    // دوربین اول‌شخص — دقیقاً از محل مردمک چشم کاراکتر نشستهٔ خودِ بازیکن
    const mySeat = theater.seats.find(
      (s) => s.userData.row === Math.floor(room.me.seatIndex / 5) + 1 && s.userData.col === (room.me.seatIndex % 5) + 1,
    );
    if (mySeat && localSeatedAvatar) {
      theater.group.updateMatrixWorld(true);
      const localRig = (localSeatedAvatar as THREE.Group).userData.humanAvatar as HumanAvatar | undefined;
      const eyeWorld = localRig
        ? localRig.getEyeWorldPosition(new THREE.Vector3())
        : mySeat.position.clone().add(new THREE.Vector3(0, 1.28, 0));
      // مخفی کردن مش خودِ بازیکن تا دوربین اول‌شخص با سر خودش تداخل نداشته باشد
      (localSeatedAvatar as THREE.Group).visible = false;
      engine.camera.position.copy(eyeWorld);
      engine.camera.lookAt(0, eyeWorld.y, -6);
    } else if (mySeat) {
      const pos = mySeat.position.clone();
      engine.camera.position.set(pos.x, pos.y + 1.28, pos.z);
      engine.camera.lookAt(0, pos.y + 1.28, -6);
    } else {
      engine.camera.position.set(0, 1.65, 6);
      engine.camera.lookAt(0, 1.5, -6);
    }

    // انیمیشن ساده بر اساس elapsedMs (کات‌سین)
    engine.setTick((delta, elapsed) => {
      const t = elapsedMs || elapsed * 1000;

      // تاب لوستر
      if (theater.chandelier) {
        theater.chandelier.rotation.z = Math.sin(t * 0.0006) * 0.05;
        theater.chandelier.rotation.x = Math.sin(t * 0.0004) * 0.03;
      }

      // رقصنده — اسکلت انسان با پلک و تنفس، دست‌ها روی مفصل شانه
      if (theater.dancer) {
        const danceEnergy = t < 50000 ? 1 : Math.max(0, 1 - (t - 50000) / 1500);
        theater.dancer.position.x = Math.sin(t * 0.00045) * 1.2 * danceEnergy;
        theater.dancer.rotation.y = Math.sin(t * 0.001) * 0.2 * danceEnergy;
        const rig = theater.dancer.userData.humanAvatar as HumanAvatar | undefined;
        rig?.update(delta, { speed: 0, yawRate: Math.cos(t * 0.001) * 0.2 });
        const leftArm = theater.dancer.userData.leftArm as THREE.Group | undefined;
        const rightArm = theater.dancer.userData.rightArm as THREE.Group | undefined;
        if (leftArm) leftArm.rotation.z = -0.2 + Math.sin(t * 0.002) * 0.5 * danceEnergy;
        if (rightArm) rightArm.rotation.z = 0.2 - Math.sin(t * 0.002) * 0.35 * danceEnergy;
      }

      // مرد سیاه‌پوش — از ثانیه ۳۱؛ محو شدن با شفافیت موادی که واقعاً روی بدن است
      if (theater.darkMan) {
        const reveal = Math.min(1, Math.max(0, (t - 31000) / 5000));
        theater.darkMan.visible = reveal > 0.01;
        if (theater.darkMan.visible) {
          const rig = theater.darkMan.userData.humanAvatar as HumanAvatar | undefined;
          rig?.update(delta, { speed: 0, pitchDeg: -6 });
          // نفس کشیدن آرام و بیرون‌زدگیِ هراس‌انگیزِ قامت
          const breath = 0.5 + 0.5 * Math.sin(t * 0.0009);
          theater.darkMan.scale.y = 1 + breath * 0.02;
        }
      }

      // پرده
      const centerCurtain = theater.stages.center.getObjectByName('Curtain') as THREE.Mesh | undefined;
      if (centerCurtain) {
        const openProgress = Math.min(1, Math.max(0, (t - 24000) / 7000));
        centerCurtain.position.y = 2.2 + openProgress * 2.5;
        centerCurtain.scale.y = 1 - openProgress * 0.9;
      }

      // تنفس طبیعی، پلک‌زدن و نگاهِ آرام کاراکترهای پلیر نشسته
      seatedAvatars.forEach((avatar) => {
        const rig = avatar.userData.humanAvatar as HumanAvatar | undefined;
        rig?.update(delta, { speed: 0, pitchDeg: Math.sin(t * 0.0004) * 4 });
      });
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
  }, [engine, elapsedMs, room.me.playerId, room.me.seatIndex, seatAssignments]);

  if (!isWebGLAvailable) {
    return (
      <div dir="rtl" style={{ padding: 24, background: '#0a0a12', color: '#e8dcc8', textAlign: 'center' }}>
        <h3>سالن سه‌بعدی در دسترس نیست</h3>
        <p>WebGL پشتیبانی نمی‌شود — نمای کلاسیک CSS نمایش داده می‌شود.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scene-fallback">
        <h2>⚠️ خطا در موتور سه‌بعدی</h2>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0a0a12' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} tabIndex={0} aria-label="سالن تئاتر ۲۰ نفره سه‌بعدی" />

      {/* HUD */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', direction: 'rtl', pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(0,0,0,0.6)', color: '#e8dcc8', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'Vazirmatn' }}>
          🎭 سالن ۲۰ نفره — {room.playerCount} بازیکن واقعی
          {hoveredSeat && <span style={{ marginRight: 12, color: '#c9a86a' }}>صندلی {hoveredSeat}</span>}
        </div>
        <div style={{ background: 'rgba(0,0,0,0.6)', color: '#e8dcc8', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
          Three.js • ۲۰ صندلی • شخصیت‌های بزرگسال باورپذیر
        </div>
      </div>

      {/* لیست بازیکنان */}
      <div className="darkhall-players" style={{ bottom: 12, left: 12, display: 'flex', gap: 6, direction: 'rtl', pointerEvents: 'none', position: 'absolute', maxWidth: 'calc(100% - 24px)', flexWrap: 'wrap' }}>
        {room.players.map((p) => (
          <div
            key={p.playerId}
            style={{
              background: p.playerId === room.me.playerId ? 'rgba(201,168,106,0.25)' : 'rgba(0,0,0,0.6)',
              border: `1px solid ${p.playerId === room.me.playerId ? '#c9a86a' : 'rgba(255,255,255,0.15)'}`,
              color: '#e8dcc8',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.isOnline ? '#4aff4a' : '#888', display: 'inline-block' }} />
            {p.playerName} {p.playerId === room.me.playerId ? '(تو)' : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuditoriumThreeScene(props: AuditoriumThreeSceneProps) {
  return (
    <ThreeErrorBoundary>
      <div className="darkhall-stage">
        <TheaterCore {...props} />
      </div>
    </ThreeErrorBoundary>
  );
}
