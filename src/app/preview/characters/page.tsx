// src/app/preview/characters/page.tsx — پیش‌نمایش کاراکترهای انسان (قبل/بعد + نمای چهره)
import CharacterStudio from '@/components/characters/CharacterStudio';

export const metadata = { title: 'استودیوی کاراکترها | تماشاخانه اُرفه‌ئو' };

export default function CharactersPreviewPage() {
  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#08060a',
        color: '#e8dcc8',
        padding: '20px clamp(12px, 3vw, 40px) 48px',
      }}
    >
      <header style={{ maxWidth: 1080, margin: '0 auto 16px' }}>
        <h1 style={{ fontSize: '1.35rem', margin: '0 0 6px', color: '#e9d8b4' }}>
          استودیوی کاراکترها — از مانکن تا انسان
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 2, color: '#a99d8d' }}>
          همهٔ چهره‌ها رویه‌ای (procedural) ساخته شده‌اند: جمجمهٔ مجسمه‌شده، منافذ و لک پوست،
          ابروی تاربه‌تار، عنبیهٔ بافت‌دار، پلکِ پلک‌زن، موی رشته‌ای و پارچهٔ بافت‌دار.
          حالت «قبل/بعد» همان آواتار قدیمی را کنار نسخهٔ جدید می‌گذارد تا تفاوت را در یک نگاه ببینید.
        </p>
      </header>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <CharacterStudio />
      </div>
    </main>
  );
}
