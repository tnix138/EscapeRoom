import type { Metadata } from 'next';
import '@fontsource-variable/vazirmatn';
import './globals.css';

export const metadata: Metadata = {
  title: 'پردهٔ سرخ | تماشاخانهٔ اُرفه‌ئو',
  description: 'یک شب، یک تماشاخانهٔ خاموش و رازی که فقط با همکاری دوستانتان آشکار می‌شود.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
