// src/app/admin/login/page.tsx — صفحهٔ ورود ادمین
// مالک در docs/PHASE.md: امیرعلی (فاز ۰۹). این نسخه حداقلی فقط LoginForm را
// وسط صفحه می‌گذارد؛ جایگزینی‌اش اثری روی منطق احراز هویت ندارد.
import LoginForm from '@/components/admin/LoginForm';
import { pageStyle } from '@/components/admin/styles';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'ورود ادمین | پردهٔ سرخ' };

export default function AdminLoginPage() {
  return (
    <main style={{ ...pageStyle, placeItems: 'center', minHeight: '70vh' }}>
      <LoginForm />
    </main>
  );
}
