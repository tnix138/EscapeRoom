'use client';
// src/components/admin/LoginForm.tsx — فرم ورود ادمین (فاز ۰۹)
// با موفقیت، کوکی httpOnly از سرور ست می‌شود و کاربر به داشبورد می‌رود.
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { buttonStyle, errorTextStyle, inputStyle, panelStyle } from './styles';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || payload.ok !== true) {
        setError(payload.error?.message || 'ورود ناموفق بود.');
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ ...panelStyle, display: 'grid', gap: 'var(--space-3)', maxWidth: 380 }}
    >
      <h1 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--gold-light)' }}>
        ورود به پنل ادمین
      </h1>

      <label style={{ display: 'grid', gap: 6, fontSize: 'var(--text-sm)' }}>
        نام کاربری
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'grid', gap: 6, fontSize: 'var(--text-sm)' }}>
        رمز عبور
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={inputStyle}
        />
      </label>

      {error ? (
        <p role="alert" style={errorTextStyle}>
          {error}
        </p>
      ) : null}

      <button type="submit" style={buttonStyle} disabled={pending}>
        {pending ? 'در حال بررسی…' : 'ورود'}
      </button>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        دسترسی فقط برای ادمین‌های تعریف‌شده در تنظیمات سرور است.
      </span>
    </form>
  );
}
