import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import ControlsHelpOverlay from '@/components/alley/ControlsHelpOverlay';
import ServiceWorkerBridge from '@/components/pwa/ServiceWorkerBridge';
import InstallPrompt from '@/components/pwa/InstallPrompt';

export const metadata: Metadata = {
  title: 'پردهٔ سرخ | تماشاخانهٔ اُرفه‌ئو',
  description: 'یک شب، یک تماشاخانهٔ خاموش و رازی که فقط با همکاری دوستانتان آشکار می‌شود.',
  /* نصب به‌عنوان اپ: iOS از این آیکن و متاتگ‌های `appleWebApp` استفاده می‌کند. */
  manifest: '/manifest.webmanifest',
  applicationName: 'پردهٔ سرخ',
  appleWebApp: {
    capable: true,
    title: 'پردهٔ سرخ',
    /* نوار وضعیت شفاف است تا صحنه زیر آن کشیده شود؛ فاصلهٔ ایمن با env() می‌آید. */
    statusBarStyle: 'black-translucent',
  },
  /* iOS پیش از ۱۶.۴ برای باز شدن تمام‌صفحه به همین متاتگ نیاز دارد. */
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  /* گوشی‌های دارای بریدگی/نوار خانه: صحنه تا زیر لبه کشیده می‌شود و
     فاصلهٔ ایمن با env(safe-area-inset-*) در CSS تأمین می‌شود. */
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#120d10',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <a className="skip-link" href="#main-content">پرش به محتوای اصلی</a>
        <div id="main-content" tabIndex={-1}>{children}</div>
        <ControlsHelpOverlay />
        <InstallPrompt />
        <ServiceWorkerBridge />
      </body>
    </html>
  );
}
