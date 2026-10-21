'use client';

import { useRef, useState, type FormEvent } from 'react';
import {
  LOGIN_ENDPOINT,
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  firstInvalidField,
  loginErrorMessage,
  loginStatusMessage,
  passwordToggleLabel,
  readLoginResult,
  safeAdminLanding,
  validateLoginInput,
  type AdminSessionView,
  type LoginErrors,
} from './login-rules';

/**
 * صفحهٔ ورود پنل مدیریت (فاز ۰۹ — سهم امیرعلی؛ فقط همین صفحه و چیدمان).
 *
 * - ارسال به `POST /api/admin/login` (قرارداد ۵ — ساختهٔ امیر)؛ تا آماده شدن
 *   سرویس، پاسخ ۴۰۴/۴۰۵ با پیام روشن «سرویس ورود هنوز راه‌اندازی نشده» نشان
 *   داده می‌شود و صفحه نمی‌شکند.
 * - گذرواژه فقط در state همین فرم می‌ماند؛ نه در localStorage، نه در آدرس
 *   صفحه و نه در لاگ. جلسه را سرور در کوکی httpOnly می‌گذارد.
 * - خطای هر فیلد با `aria-describedby`/`aria-invalid` و خطای کلی با
 *   `role="alert"` اعلام می‌شود و فوکوس به مقصد منطقی برمی‌گردد.
 * - همهٔ هدف‌های لمسی ≥۴۴px، متن‌ها ≥۱۴px و چیدمان تا ۳۲۰px می‌شکند.
 */
export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<AdminSessionView | null>(null);

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  const success = session !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || success) return;

    setFormError('');
    const validation = validateLoginInput({ username, password });
    setErrors(validation.errors);
    if (!validation.ok) {
      const field = firstInvalidField(validation.errors);
      (field === 'password' ? passwordRef : usernameRef).current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          username: validation.value.username,
          password: validation.value.password,
        }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const result = readLoginResult(response.status, payload);
      if (!result.ok) {
        setFormError(result.message);
        setSubmitting(false);
        window.requestAnimationFrame(() => errorRef.current?.focus({ preventScroll: true }));
        return;
      }

      setSession(result.session);
      setPassword('');
      setSubmitting(false);
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.assign(safeAdminLanding(next));
    } catch {
      setFormError(loginErrorMessage(0));
      setSubmitting(false);
      window.requestAnimationFrame(() => errorRef.current?.focus({ preventScroll: true }));
    }
  }

  return (
    <section className="admin-login" aria-labelledby="admin-login-title">
      <div className="admin-login-card">
        <p className="admin-login-badge">
          <span aria-hidden="true">☗</span> دسترسی محدود
        </p>
        <h1 className="admin-login-title" id="admin-login-title">
          ورود به پنل مدیریت
        </h1>
        <p className="admin-login-lede">
          فقط مدیران تماشاخانه می‌توانند آمار اتاق‌ها و بازیکنان را ببینند. نشست شما
          پس از بی‌کاری به‌طور خودکار بسته می‌شود.
        </p>

        <form
          className="admin-login-form"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={submitting}
          aria-describedby="admin-login-footnote"
        >
          <div className={`admin-field ${errors.username ? 'has-error' : ''}`.trim()}>
            <label htmlFor="admin-username">نام کاربری</label>
            <span className="input-wrap">
              <span aria-hidden="true">☰</span>
              <input
                id="admin-username"
                ref={usernameRef}
                name="username"
                type="text"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setErrors((previous) => ({ ...previous, username: undefined }));
                  setFormError('');
                }}
                maxLength={USERNAME_MAX_LENGTH}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={submitting || success}
                aria-invalid={errors.username ? true : undefined}
                aria-describedby={errors.username ? 'admin-username-error' : undefined}
              />
            </span>
            {errors.username && (
              <span className="field-error" id="admin-username-error">
                {errors.username}
              </span>
            )}
          </div>

          <div className={`admin-field ${errors.password ? 'has-error' : ''}`.trim()}>
            <label htmlFor="admin-password">گذرواژه</label>
            <span className="input-wrap admin-password-wrap">
              <span aria-hidden="true">✶</span>
              <input
                id="admin-password"
                ref={passwordRef}
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((previous) => ({ ...previous, password: undefined }));
                  setFormError('');
                }}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="current-password"
                disabled={submitting || success}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'admin-password-error' : undefined}
              />
              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-pressed={showPassword}
                aria-controls="admin-password"
                aria-label={passwordToggleLabel(showPassword)}
                title={passwordToggleLabel(showPassword)}
                disabled={submitting || success}
              >
                {showPassword ? 'پنهان' : 'نمایش'}
              </button>
            </span>
            {errors.password && (
              <span className="field-error" id="admin-password-error">
                {errors.password}
              </span>
            )}
          </div>

          {formError && (
            <p className="form-error" role="alert" tabIndex={-1} ref={errorRef}>
              <span aria-hidden="true">!</span>
              {formError}
            </p>
          )}

          <p className="sr-only" role="status" aria-live="polite">
            {loginStatusMessage({ submitting, error: formError, success })}
          </p>

          <button
            className="button button-gold admin-login-submit"
            type="submit"
            disabled={submitting || success}
          >
            <span>{success ? 'ورود موفق — انتقال…' : submitting ? 'در حال بررسی…' : 'ورود به پنل'}</span>
            <span className="button-arrow" aria-hidden="true">
              ←
            </span>
          </button>
        </form>

        <p className="admin-login-footnote" id="admin-login-footnote">
          گذرواژه در مرورگر ذخیره نمی‌شود؛ جلسه در کوکی امن <span dir="ltr">httpOnly</span> سمت
          سرور نگه داشته می‌شود.
        </p>
      </div>
    </section>
  );
}
