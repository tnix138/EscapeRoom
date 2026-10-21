'use client';

import { useEffect } from 'react';
import {
  ADMIN_LOGIN_PATH,
  ADMIN_SESSION_ENDPOINT,
  isAdminLoginPath,
  loginPathFor,
  shouldRedirectToLogin,
} from './login-rules';

export interface AdminSessionGateProps {
  /** خاموش کردن محافظ (مثلاً در پیش‌نمایش یا تست). */
  enabled?: boolean;
}

/**
 * محافظ جلسهٔ پنل مدیریت (فاز ۰۹-ب — امیرعلی).
 *
 * در `src/app/admin/layout.tsx` کنار محتوا رندر می‌شود و یک بار جلسه را با
 * `GET /api/admin/session` می‌سنجد (مسیر و کوکی `httpOnly` مال امیر در فاز ۰۹-الف):
 *  - ۴۰۱/۴۰۳ → ریدایرکت به `/admin/login?next=…`؛
 *  - ۴۰۴/۵۰۰/خطای شبکه → **هیچ کاری نمی‌کند** تا وقتی سرویس آماده نیست،
 *    پنل در حلقهٔ ریدایرکت گیر نکند؛
 *  - خودِ صفحهٔ ورود هم هرگز ریدایرکت نمی‌شود.
 *
 * هیچ داده یا توکنی در مرورگر ذخیره نمی‌کند و هیچ کنترلی رندر نمی‌کند.
 */
export default function AdminSessionGate({ enabled = true }: AdminSessionGateProps) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const pathname = window.location.pathname;
    if (isAdminLoginPath(pathname)) return undefined;

    let cancelled = false;
    void fetch(ADMIN_SESSION_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (cancelled || !shouldRedirectToLogin(response.status)) return;
        const target = loginPathFor(pathname);
        if (window.location.pathname === ADMIN_LOGIN_PATH) return;
        window.location.replace(target);
      })
      .catch(() => {
        // خطای شبکه = وضعیت نامعلوم؛ سمت سرور تصمیم بگیرد (fail-open).
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return null;
}
