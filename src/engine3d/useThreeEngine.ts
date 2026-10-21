'use client';

/**
 * useThreeEngine — هوک Next.js برای چرخه حیات ThreeEngine (علیرضا — موج ۴/۵)
 * - ساخت فقط در مرورگر
 * - ResizeObserver
 * - dispose خودکار
 */

import { useEffect, useRef, useState } from 'react';
import { ThreeEngine } from './three-engine';

export interface UseThreeEngineResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  engine: ThreeEngine | null;
  isWebGLAvailable: boolean;
  error: string | null;
}

export function useThreeEngine(): UseThreeEngineResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ThreeEngine | null>(null);
  const [engine, setEngine] = useState<ThreeEngine | null>(null);
  const [isWebGLAvailable, setWebGLAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let available = true;
    try {
      available = ThreeEngine.isWebGLAvailable();
    } catch {
      available = false;
    }
    setWebGLAvailable(available);
    if (!available) {
      setError('WebGL در این مرورگر در دسترس نیست.');
      return;
    }

    try {
      const eng = new ThreeEngine(canvas, { antialias: true });
      engineRef.current = eng;
      setEngine(eng);

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        eng.setSize(width, height);
      });
      ro.observe(canvas.parentElement ?? canvas);

      // اندازه اولیه
      const rect = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
      eng.setSize(rect.width || 800, rect.height || 600);

      return () => {
        ro.disconnect();
        eng.dispose();
        engineRef.current = null;
        setEngine(null);
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'خطای ناشناخته در ساخت موتور سه‌بعدی';
      setError(msg);
      console.error('[useThreeEngine]', e);
    }
  }, []);

  return { canvasRef: canvasRef as React.RefObject<HTMLCanvasElement | null>, engine, isWebGLAvailable, error };
}
