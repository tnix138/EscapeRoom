'use client';

/**
 * AlleyThreeScene — کوچه سه‌بعدی واقعی قابل پیمایش (علیرضا — بازطراحی کامل)
 * - آسمان شب ابری و مهتاب، سنگ‌فرش خیس و چاله‌های بازتابنده، ساختمان‌های چندطبقه
 * - تیرهای چراغ برق با نور سوسوزن واقع‌گرایانه + کابل‌های هوایی + جعبه‌های چوبی
 * - رندر متن واقعی و باکیفیت مستقیم روی تابلوی اعلانات چپ و جدول گیشهٔ راست (بدون نیاز به کلید E)
 * - کنترل حرکت جلو/عقب/strafe + نگاه ماوس با دامنهٔ دید عمودی کامل
 */

import { useEffect, useRef, useState } from 'react';
import { useThreeEngine } from '@/engine3d/useThreeEngine';
import { usePlayerControls } from '@/engine3d/usePlayerControls';
import {
  createAlleyGeometry,
  type AlleyPlayerLampStatus,
  type AlleySignCluesData,
} from '@/engine3d/alley-geometry';
import { ThreeErrorBoundary } from '@/engine3d/ThreeErrorBoundary';
import type { AlleyAnchors, PlayerTransform } from '@/engine3d/types';
import { DEFAULT_ALLEY_SPAWN } from '@/engine3d/types';

export interface AlleyThreeSceneProps {
  onAnchorFocus?: (anchorId: keyof AlleyAnchors | null) => void;
  onTransformChange?: (t: PlayerTransform) => void;
  onOpenDoorLock?: () => void;
  clues?: AlleySignCluesData;
  players?: readonly AlleyPlayerLampStatus[];
  enabled?: boolean;
  className?: string;
}

function SceneInner({
  onAnchorFocus,
  onTransformChange,
  onOpenDoorLock,
  clues,
  players,
  enabled = true,
}: AlleyThreeSceneProps) {
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

  // تشخیص نزدیک بودن به لنگرها
  useEffect(() => {
    if (!alleyRef.current) return;
    const anchors = alleyRef.current.anchors;
    const pos = transform;
    const dist = (a: { x: number; y: number; z: number }) =>
      Math.hypot(a.x - pos.x, a.z - pos.z);
    const dPlaybill = dist(anchors.playbill);
    const dRowChart = dist(anchors.rowChart);
    const dDoor = dist(anchors.theaterDoor);

    let nearest: keyof AlleyAnchors | null = null;
    let min = 3.2;
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
  }, [transform, focusedAnchor, onAnchorFocus]);

  useEffect(() => {
    if (!onOpenDoorLock) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && focusedAnchor === 'theaterDoor') {
        onOpenDoorLock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedAnchor, onOpenDoorLock]);

  useEffect(() => {
    if (!engine) return;

    const alley = createAlleyGeometry({ clues, players });
    alleyRef.current = alley;
    engine.scene.environment = alley.environmentMap;
    engine.scene.add(alley.group);

    engine.camera.position.set(
      DEFAULT_ALLEY_SPAWN.position.x,
      DEFAULT_ALLEY_SPAWN.position.y,
      DEFAULT_ALLEY_SPAWN.position.z,
    );

    // اجرای حلقهٔ سوسوزدن چراغ‌های برق و حرکت ابرهای شب
    engine.setTick((delta, elapsed) => {
      alley.update(delta, elapsed);
    });
    engine.start();

    return () => {
      engine.setTick(() => {});
      engine.stop();
      if (alleyRef.current) {
        engine.scene.remove(alleyRef.current.group);
        engine.scene.environment = null;
        alleyRef.current.dispose();
        alleyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // به‌روزرسانی زندهٔ متن روی تابلوهای سه‌بعدی هنگام تغییر وضعیت بلیط‌ها
  useEffect(() => {
    if (!alleyRef.current || !clues) return;
    alleyRef.current.updateClues(clues, players);
  }, [clues, players]);

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
          background: '#0b101c',
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
      <div className="scene-fallback">
        <h2>⚠️ خطا در موتور سه‌بعدی</h2>
        <pre>{error}</pre>
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
            background: 'rgba(8,11,18,0.76)',
            color: '#e8dcc8',
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(201,168,106,0.28)',
            fontSize: 12,
            lineHeight: 1.65,
            pointerEvents: 'auto',
          }}
        >
          <div className="alley3d-desktop-only">🎮 W/A/S/D — حرکت در کوچه | Shift — دویدن</div>
          <div className="alley3d-desktop-only">🖱️ درگ ماوس — چرخش نگاه به اطراف و آسمان | دابل‌کلیک — قفل ماوس {isPointerLocked ? '(فعال)' : ''}</div>
          <div className="alley3d-touch-only">🎮 پد جهت‌دار پایین صفحه — راه رفتن | کشیدن انگشت — نگاه</div>
          <div>📍 {transform.x.toFixed(1)}, {transform.z.toFixed(1)} — زاویه {transform.yawDeg.toFixed(0)}°</div>
          {focusedAnchor === 'theaterDoor' && (
            <div style={{ marginTop: 6, color: '#f0cc84' }}>
              🚪 نزدیک درِ ورودی تماشاخانهٔ اُرفه‌ئو
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
              background: 'rgba(18,22,36,0.92)',
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
          background: '#0b101c',
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
