'use client';

/**
 * AlleyThreeScene — کوچه سه‌بعدی واقعی قابل پیمایش (علیرضا — موج ۴/۵)
 * - هندسه ماژولار Three.js
 * - کنترل حرکت جلو/عقب/strafe + نگاه ماوس
 * - برخورد و مرز
 * - لنگرهای playbill / row chart / door برای اتصال UI امیرعلی (بدون تغییر منطق پازل)
 * - SSR امن + ErrorBoundary + WebGL fallback به صحنه CSS قدیمی
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThreeEngine } from '@/engine3d/useThreeEngine';
import { usePlayerControls } from '@/engine3d/usePlayerControls';
import { createAlleyGeometry } from '@/engine3d/alley-geometry';
import { ThreeErrorBoundary } from '@/engine3d/ThreeErrorBoundary';
import type { AlleyAnchors, PlayerTransform } from '@/engine3d/types';
import { DEFAULT_ALLEY_SPAWN } from '@/engine3d/types';

export interface AlleyThreeSceneProps {
  onAnchorFocus?: (anchorId: keyof AlleyAnchors | null) => void;
  onTransformChange?: (t: PlayerTransform) => void;
  enabled?: boolean;
  className?: string;
}

function SceneInner({ onAnchorFocus, onTransformChange, enabled = true }: AlleyThreeSceneProps) {
  const { canvasRef, engine, isWebGLAvailable, error } = useThreeEngine();
  const alleyRef = useRef<ReturnType<typeof createAlleyGeometry> | null>(null);
  const [focusedAnchor, setFocusedAnchor] = useState<keyof AlleyAnchors | null>(null);

  const { transform, isPointerLocked, requestPointerLock } = usePlayerControls({
    engine,
    enabled,
    initialTransform: {
      x: DEFAULT_ALLEY_SPAWN.position.x,
      y: DEFAULT_ALLEY_SPAWN.position.y,
      z: DEFAULT_ALLEY_SPAWN.position.z,
      yawDeg: DEFAULT_ALLEY_SPAWN.yawDeg,
      pitchDeg: 0,
    },
  });

  useEffect(() => {
    onTransformChange?.(transform);
  }, [transform, onTransformChange]);

  // تشخیص نزدیک بودن به لنگرها برای تعامل (raycast ساده فاصله‌ای)
  useEffect(() => {
    if (!alleyRef.current) return;
    const anchors = alleyRef.current.anchors;
    const check = () => {
      const pos = transform;
      const dist = (a: { x: number; y: number; z: number }) =>
        Math.hypot(a.x - pos.x, a.z - pos.z);
      const dPlaybill = dist(anchors.playbill);
      const dRowChart = dist(anchors.rowChart);
      const dDoor = dist(anchors.theaterDoor);

      let nearest: keyof AlleyAnchors | null = null;
      let min = 3.0; // فاصله تعامل
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
      if (nearest !== focusedAnchor) {
        setFocusedAnchor(nearest);
        onAnchorFocus?.(nearest);
      }
    };
    check();
  }, [transform, focusedAnchor, onAnchorFocus]);

  useEffect(() => {
    if (!engine) return;

    const alley = createAlleyGeometry();
    alleyRef.current = alley;
    engine.scene.add(alley.group);

    // دوربین اولیه
    engine.camera.position.set(
      DEFAULT_ALLEY_SPAWN.position.x,
      DEFAULT_ALLEY_SPAWN.position.y,
      DEFAULT_ALLEY_SPAWN.position.z,
    );

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

  if (!isWebGLAvailable) {
    return (
      <div
        dir="rtl"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a12',
          color: '#e8dcc8',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <h3>🖥️ WebGL در دسترس نیست — نمای کلاسیک فعال است</h3>
        <p style={{ marginTop: 12, maxWidth: 520, lineHeight: 1.8 }}>
          مرورگر شما از WebGL پشتیبانی نمی‌کند. برای تجربه سه‌بعدی واقعی، از Chrome/Firefox/Edge به‌روز استفاده کنید.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div dir="rtl" style={{ padding: 24, color: '#ff8a8a', background: '#0a0a12' }}>
        خطا در موتور سه‌بعدی: {error}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
        tabIndex={0}
        aria-label="کوچه سه‌بعدی قابل پیمایش — W/A/S/D برای حرکت، ماوس برای نگاه"
        onClick={() => {
          // کلیک برای فوکوس + درخواست pointer lock اختیاری
          canvasRef.current?.focus();
        }}
        onDoubleClick={() => requestPointerLock()}
      />

      {/* HUD کنترل‌ها */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pointerEvents: 'none',
          fontFamily: 'Vazirmatn, sans-serif',
          direction: 'rtl',
        }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.6)',
            color: '#e8dcc8',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
            pointerEvents: 'auto',
          }}
        >
          <div>🎮 W/A/S/D — حرکت جلو/عقب/چپ/راست | Shift — دویدن</div>
          <div>🖱️ ماوس درگ — چرخش سر | دابل‌کلیک — قفل ماوس {isPointerLocked ? '(فعال)' : ''}</div>
          <div>📍 {transform.x.toFixed(1)}, {transform.z.toFixed(1)} — نگاه {transform.yawDeg.toFixed(0)}°</div>
          {focusedAnchor && (
            <div style={{ marginTop: 6, color: '#c9a86a' }}>
              🎯 نزدیک {focusedAnchor === 'playbill' ? 'تابلوی اعلانات' : focusedAnchor === 'rowChart' ? 'گیشه' : 'در تئاتر'} — کلید E برای بررسی
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={() => requestPointerLock()}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #c9a86a',
              background: 'rgba(26,26,46,0.9)',
              color: '#e8dcc8',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {isPointerLocked ? '🔓 خروج از قفل ماوس (Esc)' : '🔒 قفل ماوس'}
          </button>
        </div>
      </div>

      {/* کراس‌هیر */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 20,
          height: 20,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            background: 'rgba(232,220,200,0.6)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(232,220,200,0.6)',
          }}
        />
      </div>
    </div>
  );
}

export default function AlleyThreeScene(props: AlleyThreeSceneProps) {
  return (
    <ThreeErrorBoundary>
      <div
        className={props.className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 520,
          background: '#0a0a12',
          position: 'relative',
          overflow: 'hidden',
          direction: 'ltr',
        }}
      >
        <SceneInner {...props} />
      </div>
    </ThreeErrorBoundary>
  );
}
