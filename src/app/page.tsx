import ReservationForm from '@/components/reservation/ReservationForm';
import LandingUpdatesSection from '@/components/updates/LandingUpdatesSection';

export default function HomePage() {
  return (
    <main className="site-shell">
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="پردهٔ سرخ، صفحهٔ اصلی">
          <span className="brand-mark" aria-hidden="true">✳</span>
          <span><strong>پردهٔ سرخ</strong><small>تماشاخانهٔ اُرفه‌ئو</small></span>
        </a>
        <div className="topbar-actions">
          <a className="topbar-updates-link" href="#updates">آپدیت‌ها</a>
          <div className="topbar-note"><span className="status-dot" /> تجربهٔ گروهی ۳ تا ۸ نفره</div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> دعوتی برای یک شبِ فراموش‌نشدنی</p>
          <h1>پرده بالا می‌رود.<br /><em>شما آماده‌اید؟</em></h1>
          <p className="hero-description">
            دوستانتان را به تماشاخانه‌ای دعوت کنید که هیچ‌کس از آن چیزی به یاد نمی‌آورد.
            اتاق را رزرو کنید؛ هر مهمان، دعوت‌نامهٔ مخصوص خودش را دریافت می‌کند.
          </p>
          <a className="text-link" href="#reservation">آغاز یک شب اسرارآمیز <span aria-hidden="true">←</span></a>
          <div className="hero-meta"><span>فصل اول</span><i /> <span>بازی مشارکتی آنلاین</span><i /> <span>حدود ۲۰ دقیقه</span></div>
        </div>
        <div className="theater-art" aria-label="تصویرسازی پردهٔ مخملی تماشاخانه" role="img">
          <div className="art-halo" />
          <div className="art-frame">
            <div className="art-ceiling"><span className="chandelier">✧</span></div>
            <div className="stage-glow" />
            <div className="curtain curtain-left" />
            <div className="curtain curtain-right" />
            <div className="stage-floor" />
            <div className="art-caption"><span>IL SIPARIO ROSSO</span><small>یک نمایش. یک راز. هیچ راهِ بازگشتی نیست.</small></div>
          </div>
          <span className="art-stamp">۱۹۲۴<br /><small>اُرفه‌ئو</small></span>
        </div>
      </section>

      <section className="reservation-section" id="reservation">
        <div className="section-heading">
          <span className="section-index">۰۱ <i /></span>
          <div><p className="eyebrow">پیش از خاموش شدن چراغ‌ها</p><h2>مهمانانتان را دعوت کنید</h2></div>
          <p className="section-aside">برای هر نفر یک صندلی،<br />و یک دعوت‌نامهٔ اختصاصی.</p>
        </div>
        <ReservationForm />
      </section>

      <LandingUpdatesSection />

      <footer className="footer"><span>تماشاخانهٔ اُرفه‌ئو</span><span>بعضی رازها را باید با هم کشف کرد.</span><span>✳</span></footer>
    </main>
  );
}
