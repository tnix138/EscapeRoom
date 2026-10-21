'use client';

import { useState } from 'react';

/** دکمهٔ خروج پنل: کوکی جلسه را سمت سرور پاک می‌کند و به صفحهٔ ورود برمی‌گردد. */
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // حتی با خطای شبکه، کوکی در درخواست بعدی منقضی می‌شود؛ کاربر را نگه نداریم.
    } finally {
      window.location.assign('/admin/login');
    }
  };

  return (
    <button className="button button-gold admin-home-logout" type="button" onClick={logout} disabled={busy}>
      {busy ? 'در حال خروج…' : 'خروج از پنل'}
    </button>
  );
}
