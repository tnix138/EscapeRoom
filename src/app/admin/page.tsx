// صفحهٔ ورود به پنل مدیریت — نسخهٔ حداقلی فاز ۰۹.
// جایگزین موقت داشبورد فاز ۱۰ (امیر): فقط جلسه را نشان می‌دهد تا مسیر
// «ورود → پنل» بسته و قابل تست باشد. با آمدن داشبورد واقعی، همین صفحه
// جایگزین می‌شود.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ADMIN_COOKIE_NAME,
  readAdminConfig,
  verifyAdminSessionToken,
} from '../../server/auth/admin-session';
import { roleLabel } from './login/login-rules';
import LogoutButton from './logout-button';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value ?? null;
  const { secret } = readAdminConfig();
  const session = secret ? verifyAdminSessionToken(token, secret) : null;

  if (!session) redirect('/admin/login');

  return (
    <section className="admin-home" aria-labelledby="admin-home-title">
      <div className="admin-home-card">
        <p className="admin-home-badge">☗ پنل مدیریت</p>
        <h1 className="admin-home-title" id="admin-home-title">
          خوش آمدید، {session.username}
        </h1>
        <dl className="admin-home-meta">
          <div>
            <dt>نقش</dt>
            <dd>{roleLabel(session.role)}</dd>
          </div>
          <div>
            <dt>پایان جلسه</dt>
            <dd>
              {new Intl.DateTimeFormat('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              }).format(new Date(session.expiresAt))}
            </dd>
          </div>
        </dl>
        <p className="admin-home-note">
          داشبورد آمار اتاق‌ها و بازیکنان در فاز ۱۰ به همین صفحه اضافه می‌شود. تا آن
          زمان این صفحه فقط تأیید می‌کند که ورود و جلسه درست کار می‌کند.
        </p>
        <LogoutButton />
      </div>
    </section>
  );
}
