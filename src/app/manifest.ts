import type { MetadataRoute } from 'next';

/**
 * manifest — پروندهٔ نصب (PWA)
 * ------------------------------------------------------------------
 * بازی روی گوشی در حالت «مرورگر» نوار آدرس دارد و ارتفاع دید مدام عوض
 * می‌شود؛ در حالت نصب‌شده صحنه تمام‌صفحه است و `dvh` پایدار می‌ماند. این
 * پرونده باعث می‌شود iOS/Safari و اندروید/کروم گزینهٔ «افزودن به صفحهٔ خانه»
 * را به‌صورت اپ کامل ارائه کنند.
 *
 * آیکن‌ها با `node scripts/generate-pwa-icons.mjs` از نشانِ ✳ ساخته می‌شوند.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'پردهٔ سرخ — تماشاخانهٔ اُرفه‌ئو',
    short_name: 'پردهٔ سرخ',
    description: 'یک شب، یک تماشاخانهٔ خاموش و رازی که فقط با همکاری دوستانتان آشکار می‌شود.',
    lang: 'fa',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    /* چرخش قفل نمی‌شود: دعوت‌نامه و کوچه در هر دو جهت استفاده می‌شوند. */
    orientation: 'any',
    background_color: '#120d10',
    theme_color: '#120d10',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
