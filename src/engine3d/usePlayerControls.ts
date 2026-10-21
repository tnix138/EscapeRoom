'use client';

/**
 * usePlayerControls — هوک کنترل اول‌شخص با حرکت واقعی (علیرضا — موج ۵)
 * - W/A/S/D + Shift + Arrow + Mouse drag
 * - Pointer Lock با fallback
 * - Touch joystick ساده برای موبایل
 * - اتصال به PlayerController + ThreeEngine camera
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerController, inputFromKeyboard } from './player-controller';
import type { PlayerTransform, WorldBounds, MovementConfig } from './types';
import { DEFAULT_ALLEY_BOUNDS, DEFAULT_ALLEY_SPAWN, DEFAULT_MOVEMENT_CONFIG } from './types';
import type { ThreeEngine } from './three-engine';

export interface UsePlayerControlsOptions {
  engine: ThreeEngine | null;
  initialTransform?: PlayerTransform;
  bounds?: WorldBounds;
  config?: Partial<MovementConfig>;
  enabled?: boolean;
}

export function usePlayerControls({
  engine,
  initialTransform,
  bounds = DEFAULT_ALLEY_BOUNDS,
  config = DEFAULT_MOVEMENT_CONFIG,
  enabled = true,
}: UsePlayerControlsOptions) {
  const controllerRef = useRef<PlayerController | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseDownRef = useRef(false);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const [transform, setTransform] = useState<PlayerTransform>(() => ({
    x: initialTransform?.x ?? DEFAULT_ALLEY_SPAWN.position.x,
    y: initialTransform?.y ?? DEFAULT_ALLEY_SPAWN.position.y,
    z: initialTransform?.z ?? DEFAULT_ALLEY_SPAWN.position.z,
    yawDeg: initialTransform?.yawDeg ?? DEFAULT_ALLEY_SPAWN.yawDeg,
    pitchDeg: 0,
  }));
  const [isPointerLocked, setPointerLocked] = useState(false);

  // ساخت کنترلر
  useEffect(() => {
    const ctrl = new PlayerController(transform, bounds, config);
    controllerRef.current = ctrl;
    return () => {
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // کیبورد
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      // جلوگیری از اسکرول با Arrow
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        if (e.target === document.body) e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);

  // ماوس look + pointer lock
  useEffect(() => {
    if (!enabled || !engine) return;
    const canvas = engine.renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      mouseDownRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => {
      mouseDownRef.current = false;
      lastMouseRef.current = null;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!controllerRef.current) return;
      const sensitivity = config.mouseSensitivity ?? DEFAULT_MOVEMENT_CONFIG.mouseSensitivity;
      if (isPointerLocked) {
        controllerRef.current.addLookDelta(e.movementX * sensitivity, -e.movementY * sensitivity);
      } else if (mouseDownRef.current && lastMouseRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        controllerRef.current.addLookDelta(dx * sensitivity, -dy * sensitivity);
      }
    };

    const onPointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === canvas);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [enabled, engine, isPointerLocked, config.mouseSensitivity]);

  // تاچ برای موبایل — درگ ساده
  useEffect(() => {
    if (!enabled || !engine) return;
    const canvas = engine.renderer.domElement;
    let lastTouch: { x: number; y: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!lastTouch || e.touches.length !== 1 || !controllerRef.current) return;
      const dx = e.touches[0].clientX - lastTouch.x;
      const dy = e.touches[0].clientY - lastTouch.y;
      lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const sensitivity = (config.mouseSensitivity ?? DEFAULT_MOVEMENT_CONFIG.mouseSensitivity) * 0.6;
      controllerRef.current.addLookDelta(dx * sensitivity, -dy * sensitivity);
    };
    const onTouchEnd = () => {
      lastTouch = null;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, engine, config.mouseSensitivity]);

  // لوپ حرکت
  useEffect(() => {
    if (!enabled || !engine || !controllerRef.current) return;

    let raf = 0;
    let last = performance.now();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const delta = (now - last) / 1000;
      last = now;

      const input = inputFromKeyboard(keysRef.current);
      const t = controllerRef.current!.tick(input, delta);
      setTransform(t);

      // اعمال به دوربین Three
      engine.camera.position.set(t.x, t.y, t.z);
      const yawRad = (t.yawDeg * Math.PI) / 180;
      const pitchRad = (t.pitchDeg * Math.PI) / 180;
      // نگاه به جلو با yaw/pitch
      const lookX = t.x - Math.sin(yawRad) * Math.cos(pitchRad);
      const lookY = t.y + Math.sin(pitchRad);
      const lookZ = t.z - Math.cos(yawRad) * Math.cos(pitchRad);
      engine.camera.lookAt(lookX, lookY, lookZ);
    };

    loop();
    return () => cancelAnimationFrame(raf);
  }, [enabled, engine]);

  const requestPointerLock = useCallback(() => {
    if (!engine) return;
    engine.renderer.domElement.requestPointerLock?.();
  }, [engine]);

  const teleport = useCallback((x: number, y: number, z: number, yaw?: number) => {
    controllerRef.current?.teleport(x, y, z, yaw);
  }, []);

  return { transform, isPointerLocked, requestPointerLock, teleport };
}
