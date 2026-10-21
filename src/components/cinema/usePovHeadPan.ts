'use client';

/**
 * usePovHeadPan — دوربین اول‌شخص محدود «فقط چرخش سر چپ/راست» (POV Head-Pan Only Rig)
 * -----------------------------------------------------------------------------------
 * مالک: علیرضا (Alireza) — موج ۱ — منبع: TASKS-ALIREZA.md §۳ (موج ۱) + ARCHITECTURE.md §۳.۳
 *
 * قانون سخت‌گیرانه سناریو (Head-Pan Only Constraint):
 * در تمام طول کات‌سین‌ها بازیکن هیچ حرکت آزاد، زوم، دکمه Skip یا کلیک روی اشیاء ندارد؛
 * تنها ورودی فعال، چرخاندن سر به چپ و راست در بازه محدود yaw ∈ [-42°, +42°] است.
 * این هوک عمداً هیچ API دیگری (حرکت جلو/عقب، pitch بالا/پایین، کلیک تعاملی) ارائه نمی‌دهد.
 *
 * ورودی‌های پشتیبانی‌شده:
 *  - دسکتاپ: حرکت ماوس روی صحنه (موقعیت افقی ماوس نسبت به مرکز صحنه ← زاویه هدف)
 *  - موبایل/قلم: کشیدن انگشت (Touch/Pen Drag با Pointer Events + Pointer Capture)
 *  - کیبورد: نگه‌داشتن ArrowLeft / ArrowRight (چرخش پیوسته با سرعت ثابت)
 *
 * نرمی حرکت: زاویه فعلی با میرایی نمایی مستقل از نرخ فریم (Exponential Damping)
 * روی requestAnimationFrame به سمت زاویه هدف می‌لغزد تا حس «چرخش سر واقعی» بدهد.
 *
 * قرارداد جهت (مهم برای هماهنگی تصویر موج ۲ و صدای استریو):
 *  - yaw > 0  یعنی سر بازیکن به سمت راست چرخیده است.
 *  - صحنه باید خلاف جهت سر جابه‌جا شود (با چرخش به راست، سمت راست صحنه آشکار می‌شود).
 *  - منبع صدای روبه‌رو (سِن) هنگام چرخش سر به راست، نسبت به سر در سمت چپ قرار می‌گیرد؛
 *    تبدیل yaw به Stereo Pan در موتور صدا انجام می‌شود: theater-audio-engine.ts → setHeadYaw()
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

/** حداقل زاویه چرخش سر (کاملاً به سمت چپ) — درجه */
export const POV_YAW_MIN_DEG = -42;
/** حداکثر زاویه چرخش سر (کاملاً به سمت راست) — درجه */
export const POV_YAW_MAX_DEG = 42;

/** محدود کردن هر زاویه دلخواه به بازه مجاز چرخش سر [-42, +42] */
export function clampYaw(yawDeg: number): number {
  if (!Number.isFinite(yawDeg)) return 0;
  return Math.min(POV_YAW_MAX_DEG, Math.max(POV_YAW_MIN_DEG, yawDeg));
}

/** تبدیل زاویه سر به مقدار نرمال‌شده در بازه [-1, +1] (چپ کامل = -1، مرکز = 0، راست کامل = +1) */
export function yawToNormalized(yawDeg: number): number {
  return clampYaw(yawDeg) / POV_YAW_MAX_DEG;
}

/**
 * میرایی نمایی مستقل از نرخ فریم (جایگزین lerp ساده وابسته به FPS).
 * @param currentDeg زاویه فعلی
 * @param targetDeg  زاویه هدف
 * @param deltaSeconds زمان سپری‌شده از فریم قبلی (ثانیه)
 * @param smoothingLambda ضریب نرمی — بزرگ‌تر یعنی واکنش سریع‌تر و تیزتر (پیش‌فرض 7)
 */
export function dampYaw(
  currentDeg: number,
  targetDeg: number,
  deltaSeconds: number,
  smoothingLambda = 7,
): number {
  const target = clampYaw(targetDeg);
  if (deltaSeconds <= 0) return clampYaw(currentDeg);
  const alpha = 1 - Math.exp(-smoothingLambda * deltaSeconds);
  return clampYaw(currentDeg + (target - currentDeg) * alpha);
}

/**
 * ساخت استایل دوربین صحنه اول‌شخص از روی زاویه سر — کمکی آماده برای موج ۲
 * (FirstPersonCutsceneStage / AuditoriumPerformanceView).
 * صحنه حول محور Y خلاف جهت سر می‌چرخد و به اندازه‌ای جابه‌جا می‌شود که
 * با نگاه به راست، بخش راست پانوراما آشکار شود.
 * @param maxShiftPercent حداکثر جابه‌جایی افقی صحنه در چرخش کامل سر (درصد عرض صحنه)
 */
export function getPovCameraStyle(
  yawDeg: number,
  maxShiftPercent = 14,
): CSSProperties {
  const yaw = clampYaw(yawDeg);
  const normalized = yawToNormalized(yaw);
  return {
    transform: `translateX(${(-normalized * maxShiftPercent).toFixed(3)}%) rotateY(${(-yaw).toFixed(2)}deg)`,
    perspectiveOrigin: `${(50 + normalized * 18).toFixed(2)}% 50%`,
  };
}

export interface UsePovHeadPanOptions {
  /**
   * فعال بودن چرخش سر. در حالت غیرفعال همه ورودی‌ها نادیده گرفته می‌شوند
   * و زاویه هدف روی زاویه فعلی قفل می‌شود (بدون پرش ناگهانی).
   * پیش‌فرض: true
   */
  enabled?: boolean;
  /** سرعت چرخش با کلیدهای جهت‌نما (درجه بر ثانیه) — پیش‌فرض: 55 */
  keyboardSpeedDegPerSec?: number;
  /** حساسیت کشیدن انگشت/قلم (درجه به ازای هر پیکسل کشیدن) — پیش‌فرض: 0.12 */
  dragSensitivityDegPerPx?: number;
  /** ضریب نرمی میرایی نمایی — پیش‌فرض: 7 */
  smoothingLambda?: number;
  /**
   * فراخوانی در هر فریمی که زاویه جاری تغییر کند.
   * مصرف اصلی: اتصال مستقیم به موتور صدا → engine.setHeadYaw(yaw)
   */
  onYawChange?: (yawDeg: number) => void;
}

export interface PovHeadPanHandlers {
  onMouseMove: (event: ReactMouseEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface UsePovHeadPanResult {
  /** زاویه فعلی سر (درجه، در بازه [-42, +42]) — با هر فریم انیمیشن به‌روز می‌شود */
  yaw: number;
  /** مقدار نرمال‌شده زاویه در بازه [-1, +1] */
  normalizedYaw: number;
  /** دسترسی بدون ری‌رندر به زاویه فعلی (برای حلقه‌های رندر Canvas و صدا) */
  yawRef: RefObject<number>;
  /** هندلرهایی که باید روی المان صحنه اول‌شخص spread شوند */
  handlers: PovHeadPanHandlers;
  /** تنظیم مستقیم زاویه هدف (مثلاً راهنمای «به سمت چپ نگاه کن») */
  setTargetYaw: (yawDeg: number) => void;
  /** برگرداندن نرم سر به مرکز (yaw = 0) */
  reset: () => void;
}

export function usePovHeadPan(
  options: UsePovHeadPanOptions = {},
): UsePovHeadPanResult {
  const {
    enabled = true,
    keyboardSpeedDegPerSec = 55,
    dragSensitivityDegPerPx = 0.12,
    smoothingLambda = 7,
    onYawChange,
  } = options;

  const [yaw, setYaw] = useState(0);
  const yawRef = useRef(0);
  const targetYawRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onYawChangeRef = useRef(onYawChange);
  onYawChangeRef.current = onYawChange;

  // وضعیت کشیدن انگشت/قلم و کلیدهای فشرده‌شده — خارج از چرخه ری‌رندر React
  const dragRef = useRef<{ pointerId: number; lastX: number } | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());

  const setTargetYaw = useCallback((yawDeg: number) => {
    targetYawRef.current = clampYaw(yawDeg);
  }, []);

  const reset = useCallback(() => {
    targetYawRef.current = 0;
  }, []);

  /* ---------------- ورودی کیبورد: ArrowLeft / ArrowRight ---------------- */
  useEffect(() => {
    if (!enabled) {
      pressedKeysRef.current.clear();
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); // جلوگیری از اسکرول افقی صفحه
        pressedKeysRef.current.add(event.key);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key);
    };
    const onBlur = () => pressedKeysRef.current.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      pressedKeysRef.current.clear();
    };
  }, [enabled]);

  /* -------- حلقه اصلی انیمیشن: اعمال کیبورد + میرایی نرم روی rAF -------- */
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;

      if (enabledRef.current) {
        const keys = pressedKeysRef.current;
        let keyDelta = 0;
        if (keys.has('ArrowLeft')) keyDelta -= keyboardSpeedDegPerSec * dt;
        if (keys.has('ArrowRight')) keyDelta += keyboardSpeedDegPerSec * dt;
        if (keyDelta !== 0) {
          targetYawRef.current = clampYaw(targetYawRef.current + keyDelta);
        }
      } else {
        // قفل کنترل: هدف روی زاویه فعلی ثابت می‌شود تا سر بی‌حرکت بماند
        targetYawRef.current = yawRef.current;
      }

      const next = dampYaw(
        yawRef.current,
        targetYawRef.current,
        dt,
        smoothingLambda,
      );
      if (Math.abs(next - yawRef.current) > 0.005) {
        yawRef.current = next;
        setYaw(next);
        onYawChangeRef.current?.(next);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [keyboardSpeedDegPerSec, smoothingLambda]);

  /* ----------------------------- هندلرهای صحنه ----------------------------- */
  const onMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!enabledRef.current) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      // موقعیت افقی ماوس نسبت به مرکز صحنه در بازه [-1, +1]
      const normalizedX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetYawRef.current = clampYaw(normalizedX * POV_YAW_MAX_DEG);
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabledRef.current) return;
      // ماوس با Hover کنترل می‌شود؛ درگ فقط برای لمس و قلم است تا دو ورودی نجنگند
      if (event.pointerType === 'mouse') return;
      dragRef.current = { pointerId: event.pointerId, lastX: event.clientX };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabledRef.current) return;
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.lastX;
      drag.lastX = event.clientX;
      // کشیدن انگشت به سمت چپ = چرخش سر به سمت راست (حرکت طبیعی پانوراما)
      targetYawRef.current = clampYaw(
        targetYawRef.current - dx * dragSensitivityDegPerPx,
      );
    },
    [dragSensitivityDegPerPx],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }, []);

  return {
    yaw,
    normalizedYaw: yawToNormalized(yaw),
    yawRef,
    handlers: {
      onMouseMove,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    setTargetYaw,
    reset,
  };
}
