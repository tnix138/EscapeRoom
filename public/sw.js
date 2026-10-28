/**
 * sw.js — سرویس‌ورکر سبک برای نصب‌پذیر کردن بازی
 * -------------------------------------------------------------
 * هدف فقط «نصب‌پذیری» است، نه کار آفلاین کامل: دارایی‌های تغییرناپذیر
 * Next (`/_next/static/…`)، صدا/آیکون و مدل‌های شخصیت پس از اولین درخواست کش می‌شوند
 * تا بازیِ نصب‌شده سریع‌تر و در بازگشایی بعدی قابل‌استفاده باشد؛ صفحه‌ها و API شبکه‌ای می‌مانند.
 *
 * عمداً نسخه‌دار نیست: کش با تغییر نام دارایی‌ها خودبه‌خود تازه می‌شود.
 */

const STATIC_CACHE = 'orfeo-static-v3';
const STATIC_PREFIXES = ['/_next/static/', '/icons/', '/audio/', '/models/characters/'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== STATIC_CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
