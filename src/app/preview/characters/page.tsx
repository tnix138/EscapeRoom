// src/app/preview/characters/page.tsx — پیش‌نمایش آواتار rigged (مقایسه + نمای چهره)
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
          استودیوی کاراکترها — از مدل دست‌ساز تا آواتار استاندارد
        </h1>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 2, color: '#a99d8d' }}>
          مدل جدید از مجموعهٔ محلی GLB با rig مشترک ۵۳ استخوانی، morph targetهای چهره، بافت و
          انیمیشن استفاده می‌کند. «قبل/بعد» آن را با آواتار رویه‌ای قدیمی مقایسه می‌کند؛
          نمای نزدیک، صف هشت کاراکتر، ژست قدم‌زدن و سه حالت نور هم برای بررسی در دسترس‌اند.
        </p>
      </header>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <CharacterStudio />
      </div>
    </main>
  );
}
