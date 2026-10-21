'use client';

/**
 * ThreeSceneBase — صحنه پایه قابل استفاده مجدد (علیرضا — موج ۴/۵)
 * - SSR امن
 * - WebGL fallback فارسی
 * - ResizeObserver
 * - چرخه حیات کامل
 */

import { useEffect, useRef } from 'react';
import { useThreeEngine } from './useThreeEngine';
import { ThreeErrorBoundary } from './ThreeErrorBoundary';
import { createAlleyGeometry } from './alley-geometry';
import type { PlayerTransform } from './types';

export interface ThreeSceneBaseProps {
  initialTransform?: PlayerTransform;
  onTransformChange?: (t: PlayerTransform) => void;
  showStats?: boolean;
  className?: string;
}

function SceneContent({ onTransformChange }: { onTransformChange?: (t: PlayerTransform) => void }) {
  void onTransformChange;
  const { canvasRef, engine, isWebGLAvailable, error } = useThreeEngine();
  const alleyRef = useRef<ReturnType<typeof createAlleyGeometry> | null>(null);

  useEffect(() => {
    if (!engine) return;

    const alley = createAlleyGeometry();
    alleyRef.current = alley;
    engine.scene.environment = alley.environmentMap;
    engine.scene.add(alley.group);

    engine.camera.position.set(0, 1.65, 6);
    engine.camera.lookAt(0, 1.85, -14);

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
  }, [engine]);

  if (!isWebGLAvailable) {
    return (
      <div
        dir="rtl"
        style={{
          width: '100%',
          height: '100%',
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
        <h3>🖥️ مرورگر شما WebGL را پشتیبانی نمی‌کند</h3>
        <p style={{ maxWidth: 480, lineHeight: 1.8, marginTop: 12 }}>
          برای تجربه سه‌بعدی واقعی تماشاخانه، لطفاً از آخرین نسخه Chrome / Firefox / Edge استفاده کنید.
          نمای کلاسیک CSS همچنان در دسترس است.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        dir="rtl"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b101c',
          color: '#ff8a8a',
          padding: 24,
        }}
      >
        خطا: {error}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
      tabIndex={0}
      aria-label="صحنه سه‌بعدی کوچه تماشاخانه"
    />
  );
}

export default function ThreeSceneBase(props: ThreeSceneBaseProps) {
  return (
    <ThreeErrorBoundary>
      <div
        className={props.className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 480,
          position: 'relative',
          background: '#0b101c',
          overflow: 'hidden',
          direction: 'ltr',
        }}
      >
        <SceneContent onTransformChange={props.onTransformChange} />
        {props.showStats && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: 'rgba(0,0,0,0.6)',
              color: '#e8dcc8',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontFamily: 'monospace',
              direction: 'ltr',
            }}
          >
            Three.js • 60fps target
          </div>
        )}
      </div>
    </ThreeErrorBoundary>
  );
}
