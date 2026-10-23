// src/app/admin/updates/page.tsx — صفحهٔ کامل آپدیت‌ها و گزارش تغییرات فنی در پنل ادمین
import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminUpdatesExplorer from '@/components/admin/AdminUpdatesExplorer';
import { hintStyle, pageStyle, titleStyle } from '@/components/admin/styles';
import { loadAdminUpdatesOverview } from '@/updates/changelog-loader';
import { requireAdminPage } from '../guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'آپدیت‌ها و تغییرات فنی | پنل ادمین' };

export default async function AdminUpdatesPage() {
  const session = await requireAdminPage();
  const overview = loadAdminUpdatesOverview();

  return (
    <main style={pageStyle}>
      <AdminSidebar active="updates" username={session.username} role={session.role} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <h1 style={{ ...titleStyle, fontSize: '1.375rem' }}>
            آپدیت‌ها و تاریخچهٔ فنی پروژه
          </h1>
          <p style={{ ...hintStyle, margin: '4px 0 0' }}>
            کالبدشکافی کامل تغییرات فنی، ماژول‌های تغییریافته، زیرسیستم‌ها و پوشش تست‌ها (همگام با{' '}
            <code>CHANGELOG.md</code>)
          </p>
        </div>

        <Link
          href="/#updates"
          style={{
            color: 'var(--gold-light)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
          }}
        >
          مشاهدهٔ نسخهٔ عمومی در صفحهٔ اصلی →
        </Link>
      </div>

      <AdminUpdatesExplorer overview={overview} />
    </main>
  );
}
