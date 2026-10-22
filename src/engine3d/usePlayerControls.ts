'use client';

/**
 * usePlayerControls — هوک کنترل اول‌شخص با حرکت واقعی (علیرضا — موج ۵ + رفع باگ گیرکردن حرکت)
 * - W/A/S/D + Shift + Arrow + Mouse drag (بدون گیر کردن کلید در blur/visibility/shortcut/chat)
 * - Pointer Lock با fallback و فیلتر پرش ناگهانی نشانگر
 * - Touch joystick برای موبایل
 * - اتصال ۶۰fps به ThreeEngine camera با انتشار بهینه به React برای حذف لگ فریم
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PlayerController,
  inputFromKeyboard,
  isArrowInteractiveElement,
  isModifierChord,
  isTextEntryElement,
  sanitizePointerLockDelta,
} from './player-controller';
import type { PlayerTransform, WorldBounds, MovementConfig } from './types';
import { DEFAULT_ALLEY_BOUNDS, DEFAULT_ALLEY_SPAWN, DEFAULT_MOVEMENT_CONFIG } from './types';
import type { ThreeEngine } from './three-engine';
import {
  attachTouchControls,
  EMPTY_TOUCH_MOVE,
  prefersTouchControls,
  type TouchMoveVector,
} from './touch-controls';
import { lookTarget, pointerLookDelta } from './look-input';
import { ALLEY_STATIC_OBSTACLES, type AABB } from './collision';

export interface UsePlayerControlsOptions {
  engine: ThreeEngine | null;
  initialTransform?: PlayerTransform;
  bounds?: WorldBounds;
  obstacles?: readonly AABB[];
  config?: Partial<MovementConfig>;
  enabled?: boolean;
}

const MOVEMENT_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

const MODIFIER_RELEASE_CODES = new Set([
  'MetaLeft',
  'MetaRight',
  'AltLeft',
  'AltRight',
  'ControlLeft',
  'ControlRight',
]);

const TRANSFORM_PUBLISH_INTERVAL_MS = 50;

function transformsDiffer(a: PlayerTransform, b: PlayerTransform): boolean {
  return (
    Math.abs(a.x - b.x) > 1e-4 ||
    Math.abs(a.y - b.y) > 1e-4 ||
    Math.abs(a.z - b.z) > 1e-4 ||
    Math.abs(a.yawDeg - b.yawDeg) > 0.05 ||
    Math.abs(a.pitchDeg - b.pitchDeg) > 0.05
  );
}

export function usePlayerControls({
  engine,
  initialTransform,
  bounds = DEFAULT_ALLEY_BOUNDS,
  obstacles = ALLEY_STATIC_OBSTACLES,
  config = DEFAULT_MOVEMENT_CONFIG,
  enabled = true,
}: UsePlayerControlsOptions) {
  const controllerRef = useRef<PlayerController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new PlayerController(
      {
        x: initialTransform?.x ?? DEFAULT_ALLEY_SPAWN.position.x,
        y: initialTransform?.y ?? DEFAULT_ALLEY_SPAWN.position.y,
        z: initialTransform?.z ?? DEFAULT_ALLEY_SPAWN.position.z,
        yawDeg: initialTransform?.yawDeg ?? DEFAULT_ALLEY_SPAWN.yawDeg,
        pitchDeg: initialTransform?.pitchDeg ?? 0,
      },
      bounds,
      config,
      obstacles,
    );
  }

  const keysRef = useRef<Set<string>>(new Set());
  const mouseDownRef = useRef(false);
  /* ورودی پد لمسی؛ در نبود ویرچوال‌پد همه‌چیز false است. */
  const touchMoveRef = useRef<TouchMoveVector>({ ...EMPTY_TOUCH_MOVE });
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const [transform, setTransform] = useState<PlayerTransform>(() =>
    controllerRef.current!.getTransform(),
  );
  const [isPointerLocked, setPointerLocked] = useState(false);

  const lastPublishedRef = useRef<PlayerTransform>(transform);
  const lastPublishTimeRef = useRef<number>(0);

  const clearTransientInputs = useCallback(() => {
    keysRef.current.clear();
    mouseDownRef.current = false;
    lastMouseRef.current = null;
    touchMoveRef.current = { ...EMPTY_TOUCH_MOVE };
  }, []);

  // پاکسازی فوری کلیدهای نگه‌داشته‌شده هنگام غیرفعال شدن کنترل‌ها (باز شدن مودال قفل در یا سرنخ)
  useEffect(() => {
    if (!enabled) {
      clearTransientInputs();
    }
  }, [enabled, clearTransientInputs]);

  // کیبورد و پاکسازی در تغییر فوکوس/تب/شورتکات/فیلد متنی
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.shiftKey) {
        keysRef.current.delete('ShiftLeft');
        keysRef.current.delete('ShiftRight');
      }
      if (isModifierChord(e)) {
        keysRef.current.clear();
        return;
      }
      if (isTextEntryElement(e.target)) {
        keysRef.current.clear();
        return;
      }
      if (
        (e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown') &&
        isArrowInteractiveElement(e.target)
      ) {
        return;
      }
      if (!MOVEMENT_CODES.has(e.code)) return;

      keysRef.current.add(e.code);
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) ||
        e.target === document.body
      ) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || !e.shiftKey) {
        keysRef.current.delete('ShiftLeft');
        keysRef.current.delete('ShiftRight');
      }
      if (MODIFIER_RELEASE_CODES.has(e.code)) {
        keysRef.current.clear();
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isTextEntryElement(e.target)) {
        keysRef.current.clear();
      }
    };

    const onWindowBlur = () => {
      clearTransientInputs();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        clearTransientInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('pagehide', onWindowBlur);
    window.addEventListener('contextmenu', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      clearTransientInputs();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('pagehide', onWindowBlur);
      window.removeEventListener('contextmenu', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [enabled, clearTransientInputs]);

  // ماوس look + pointer lock
  useEffect(() => {
    if (!enabled || !engine) return;
    const canvas = engine.renderer.domElement;

    const syncCameraAndState = () => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      const t = ctrl.getTransform();
      engine.camera.position.set(t.x, t.y, t.z);
      const target = lookTarget(t);
      engine.camera.lookAt(target.x, target.y, target.z);
      if (transformsDiffer(lastPublishedRef.current, t)) {
        lastPublishedRef.current = t;
        lastPublishTimeRef.current = performance.now();
        setTransform(t);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      mouseDownRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => {
      mouseDownRef.current = false;
      lastMouseRef.current = null;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!controllerRef.current) return;
      if (!e.shiftKey) {
        keysRef.current.delete('ShiftLeft');
        keysRef.current.delete('ShiftRight');
      }
      const sensitivity = config.mouseSensitivity ?? DEFAULT_MOVEMENT_CONFIG.mouseSensitivity;
      if (document.pointerLockElement === canvas) {
        const clean = sanitizePointerLockDelta(e.movementX, e.movementY);
        if (clean.dx === 0 && clean.dy === 0) return;
        /* حرکت ماوس به راست = نگاه به راست (قرارداد look-input) */
        const look = pointerLookDelta(clean.dx, clean.dy, sensitivity);
        controllerRef.current.addLookDelta(look.deltaYawDeg, look.deltaPitchDeg);
        syncCameraAndState();
      } else if (mouseDownRef.current) {
        // اگر دکمهٔ چپ ماوس بیرون از پنجره/iframe رها شده باشد، Drag خودکار متوقف شود
        if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) {
          mouseDownRef.current = false;
          lastMouseRef.current = null;
          return;
        }
        if (!lastMouseRef.current) return;
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        const look = pointerLookDelta(dx, dy, sensitivity);
        controllerRef.current.addLookDelta(look.deltaYawDeg, look.deltaPitchDeg);
        syncCameraAndState();
      }
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setPointerLocked(locked);
      mouseDownRef.current = false;
      lastMouseRef.current = null;
      if (!locked) {
        keysRef.current.clear();
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      mouseDownRef.current = false;
      lastMouseRef.current = null;
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, [enabled, engine, config.mouseSensitivity]);

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
      /* کشیدن انگشت به راست = نگاه به راست (همان قرارداد ماوس) */
      const look = pointerLookDelta(dx, dy, sensitivity);
      controllerRef.current.addLookDelta(look.deltaYawDeg, look.deltaPitchDeg);
      const t = controllerRef.current.getTransform();
      engine.camera.position.set(t.x, t.y, t.z);
      const target = lookTarget(t);
      engine.camera.lookAt(target.x, target.y, target.z);
      if (transformsDiffer(lastPublishedRef.current, t)) {
        lastPublishedRef.current = t;
        lastPublishTimeRef.current = performance.now();
        setTransform(t);
      }
    };
    const onTouchEnd = () => {
      lastTouch = null;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, engine, config.mouseSensitivity]);

  // پد حرکت لمسی — فقط روی دستگاه‌های با ورودی انگشتی
  useEffect(() => {
    if (!enabled || !engine) return;
    const container = engine.renderer.domElement.parentElement;
    if (!container) return;
    if (!prefersTouchControls()) return;

    const handle = attachTouchControls(container, (vector) => {
      touchMoveRef.current = vector;
    });
    return () => {
      touchMoveRef.current = { ...EMPTY_TOUCH_MOVE };
      handle.dispose();
    };
  }, [enabled, engine]);

  // لوپ حرکت ۶۰fps بدون بازرندر بیهودهٔ React در حالت ایستاده
  useEffect(() => {
    if (!enabled || !engine || !controllerRef.current) return;

    let raf = 0;
    let last = performance.now();

    const initial = controllerRef.current.getTransform();
    engine.camera.position.set(initial.x, initial.y, initial.z);
    const initialTarget = lookTarget(initial);
    engine.camera.lookAt(initialTarget.x, initialTarget.y, initialTarget.z);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const delta = (now - last) / 1000;
      last = now;

      const keyboard = inputFromKeyboard(keysRef.current);
      const touch = touchMoveRef.current;
      const merged = {
        forward: keyboard.forward || touch.forward,
        backward: keyboard.backward || touch.backward,
        left: keyboard.left || touch.left,
        right: keyboard.right || touch.right,
        sprint: keyboard.sprint || touch.sprint,
      };
      const isActivelyMoving =
        merged.forward || merged.backward || merged.left || merged.right;

      const t = controllerRef.current!.tick(merged, delta);

      // اعمال فوری به دوربین Three — محاسبهٔ جهت در look-input.ts است (منبع واحد)
      engine.camera.position.set(t.x, t.y, t.z);
      const target = lookTarget(t);
      engine.camera.lookAt(target.x, target.y, target.z);

      // انتشار به React فقط هنگام تغییر واقعی مکان/زاویه (۲۰Hz در حرکت + فلاش فوری در توقف)
      if (transformsDiffer(lastPublishedRef.current, t)) {
        const elapsed = now - lastPublishTimeRef.current;
        if (!isActivelyMoving || elapsed >= TRANSFORM_PUBLISH_INTERVAL_MS) {
          lastPublishedRef.current = t;
          lastPublishTimeRef.current = now;
          setTransform(t);
        }
      }
    };

    loop();
    return () => cancelAnimationFrame(raf);
  }, [enabled, engine]);

  const requestPointerLock = useCallback(() => {
    if (!engine) return;
    try {
      engine.renderer.domElement.requestPointerLock?.();
    } catch {
      /* در برخی iframeها PointerLock محدود است */
    }
  }, [engine]);

  const teleport = useCallback(
    (x: number, y: number, z: number, yaw?: number) => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      ctrl.teleport(x, y, z, yaw);
      const t = ctrl.getTransform();
      if (engine) {
        engine.camera.position.set(t.x, t.y, t.z);
        const target = lookTarget(t);
        engine.camera.lookAt(target.x, target.y, target.z);
      }
      lastPublishedRef.current = t;
      lastPublishTimeRef.current = performance.now();
      setTransform(t);
    },
    [engine],
  );

  return { transform, isPointerLocked, requestPointerLock, teleport };
}
