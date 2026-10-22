'use client';

/**
 * use-swipe-dismiss.ts — بستن کشوی کناری با کشیدنِ انگشت
 * ---------------------------------------------------------------------
 * روی گوشی، نجوای گروهی به تبِ لبهٔ چپ و همراهِ تماشاخانه به تبِ لبهٔ راست
 * تبدیل می‌شوند. بازیکن انتظار دارد مثل شیت‌های iOS، با کشیدنِ سربرگ به سمت
 * همان لبه (فلشِ روی تب) کشو بسته شود.
 *
 * قواعد:
 *  - جابه‌جایی افقی بیش از ۵۶px در جهت لبه = بستن؛
 *  - جابه‌جایی کمتر = مثل قبل «کلیک» و باز/بستهٔ عادی؛
 *  - اسکرول عمودی داخل پنل دست‌نخورده می‌ماند (فقط افقی سنجیده می‌شود).
 */

import { useEffect, useRef } from 'react';

export const SWIPE_DISMISS_PX = 56;

export type SheetEdge = 'start' | 'end';

export interface SwipeDismissHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onClickCapture: (event: React.MouseEvent<HTMLElement>) => void;
}

/** آیا این جابه‌جایی باید کشو را ببندد؟ (خالص، برای تست) */
export function isDismissSwipe(deltaX: number, edge: SheetEdge, threshold = SWIPE_DISMISS_PX): boolean {
  // در RTL، جهت کشیدن سنجیده نمی‌شود؛ خودِ لبه تعیین می‌کند به کدام سمت باشد.
  return edge === 'start' ? deltaX <= -threshold : deltaX >= threshold;
}

export function useSwipeDismiss(
  open: boolean,
  close: () => void,
  edge: SheetEdge,
): SwipeDismissHandlers {
  const startX = useRef<number | null>(null);
  const dragged = useRef(false);
  const resetTimer = useRef<number | null>(null);

  /* اگر مرورگر بعد از کشیدن، رویداد click نفرستد، پرچم نباید کلیک بعدی را بخورد. */
  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  const armClickGuard = () => {
    dragged.current = true;
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      dragged.current = false;
      resetTimer.current = null;
    }, 500);
  };

  return {
    onPointerDown: (event) => {
      if (!open) return;
      startX.current = event.clientX;
      dragged.current = false;
    },
    onPointerUp: (event) => {
      if (!open || startX.current === null) return;
      const deltaX = event.clientX - startX.current;
      startX.current = null;
      if (!isDismissSwipe(deltaX, edge)) return;
      // کلیکِ بعدیِ مرورگر نباید پنل را دوباره باز کند.
      armClickGuard();
      close();
    },
    onPointerCancel: () => {
      startX.current = null;
    },
    onClickCapture: (event) => {
      if (!dragged.current) return;
      dragged.current = false;
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
