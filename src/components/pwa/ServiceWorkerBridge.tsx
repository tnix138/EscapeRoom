'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerBridge — ثبت سرویس‌ورکر نصب (PWA)
 * -----------------------------------------------------------------
 * فقط در محیط تولید و مرورگرهایی که پشتیبانی می‌کنند ثبت می‌شود؛ در
 * `next dev` ثبت نمی‌کنیم تا هوت‌ری‌لود با کش قاطی نشود.
 *
 * هیچ خطایی به کاربر نشان داده نمی‌شود: ثبت سرویس‌ورکر «بهبود» است، نه شرط
 * اجرای بازی.
 */
export default function ServiceWorkerBridge() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* ثبت نشد؛ بازی بدون PWA هم کار می‌کند */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
