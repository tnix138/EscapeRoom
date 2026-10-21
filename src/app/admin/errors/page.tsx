// src/app/admin/errors/page.tsx — آخرین خطاهای ثبت‌شده (فاز ۱۳)
import AdminSidebar from '@/components/admin/AdminSidebar';
import ErrorsTable from '@/components/admin/ErrorsTable';
import { hintStyle, pageStyle, panelStyle, titleStyle } from '@/components/admin/styles';
import { loadAdminErrors } from '@/server/admin/queries';
import { getRoomRepository } from '@/server/db/repository';
import { requireAdminPage } from '../guard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'خطاها | پنل ادمین' };

export default async function AdminErrorsPage() {
  const session = await requireAdminPage();
  const now = Date.now();
  const errors = await loadAdminErrors(getRoomRepository(), 100);

  return (
    <main style={pageStyle}>
      <AdminSidebar active="errors" username={session.username} role={session.role} />
      <section style={panelStyle}>
        <h1 style={titleStyle}>خطاهای سرور</h1>
        <p style={hintStyle}>
          رویدادهای نوع <code>error</code> از جدول <code>admin_events</code> خوانده می‌شوند.
        </p>
        <ErrorsTable errors={errors} now={now} />
      </section>
    </main>
  );
}
