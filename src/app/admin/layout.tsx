// src/app/admin/layout.tsx — چیدمان پنل ادمین
// مالک در docs/PHASE.md: امیرعلی (فاز ۰۹). این نسخه حداقلی و بدون منطق است تا
// پنل با نبودِ مالک اصلی هم قابل استفاده بماند؛ جایگزینی‌اش هیچ اثری روی بقیه ندارد.
import type { ReactNode } from 'react';

export const metadata = { title: 'پنل ادمین | پردهٔ سرخ' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', paddingBlock: 'var(--space-4)' }}>
      {children}
    </div>
  );
}
