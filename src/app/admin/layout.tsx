import type { Metadata } from 'next';
import AdminSessionGate from './login/admin-session-gate';

/**
 * چیدمان پنل مدیریت (فاز ۰۹ — سهم امیرعلی؛ فقط چیدمان).
 *
 * - پوستهٔ مشترک همهٔ صفحه‌های `/admin` است؛ صفحه‌های داشبورد، اتاق‌ها و
 *   بازیکنان را امیر در همین قالب اضافه می‌کند (بدون تغییر این فایل).
 * - پنل ادمین جدا از بازی است: هیچ استایل یا دادهٔ بازی را واکشی نمی‌کند؛
 *   اگر سرویس ادمین خراب شود، مسیر بازی دست‌نخورده می‌ماند.
 * - `noindex` است تا صفحه‌های مدیریتی در موتورهای جست‌وجو نیایند.
 * - نگهبانی مسیر با `AdminSessionGate` انجام می‌شود: یک بار
 *   `GET /api/admin/session` را می‌سنجد و فقط با ۴۰۱/۴۰۳ به صفحهٔ ورود
 *   می‌فرستد؛ اگر سرویس امیر هنوز آماده نباشد، پنل در حلقهٔ ریدایرکت گیر نمی‌کند.
 */
export const metadata: Metadata = {
  title: 'پنل مدیریت | تماشاخانهٔ اُرفه‌ئو',
  description: 'پنل مدیریت تماشاخانهٔ اُرفه‌ئو — آمار اتاق‌ها، بازیکنان و خطاها.',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <p className="admin-brand">
          <span aria-hidden="true">☗</span>
          <span>پنل مدیریت تماشاخانه</span>
        </p>
        <a className="admin-home-link" href="/">
          بازگشت به تماشاخانه
        </a>
      </header>
      <div className="admin-content">{children}</div>
      {/* محافظ جلسه: فقط روی ۴۰۱/۴۰۳ ریدایرکت می‌کند و با سرویس آماده‌نشده کاری ندارد. */}
      <AdminSessionGate />
    </div>
  );
}
