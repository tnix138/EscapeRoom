import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import ControlsHelpOverlay from '@/components/alley/ControlsHelpOverlay';

export const metadata: Metadata = {
  title: 'پردهٔ سرخ | تماشاخانهٔ اُرفه‌ئو',
  description: 'یک شب، یک تماشاخانهٔ خاموش و رازی که فقط با همکاری دوستانتان آشکار می‌شود.',
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
      </body>
    </html>
  );
}
