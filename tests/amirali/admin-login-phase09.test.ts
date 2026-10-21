import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  DEFAULT_ADMIN_LANDING,
  LOGIN_ENDPOINT,
  LOGOUT_ENDPOINT,
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  firstInvalidField,
  isAdminRole,
  loginErrorMessage,
  loginStatusMessage,
  normalizeUsername,
  parseSessionPayload,
  passwordToggleLabel,
  readLoginResult,
  roleLabel,
  safeAdminLanding,
  validateLoginInput,
} from '../../src/app/admin/login/login-rules';

/**
 * فاز ۰۹ — پنل ادمین: ورود و چیدمان (سهم امیرعلی)
 * ---------------------------------------------------------------------------
 * این فایل قرارداد سهم UI را نگه می‌دارد: اعتبارسنجی روشن، پیام خطای فارسی و
 * بی‌طرف (نمی‌گوید کدام فیلد اشتباه بود)، مقصد امن پس از ورود، و اینکه هیچ
 * گذرواژه‌ای در مرورگر یا آدرس صفحه ذخیره نشود. شکل پاسخ سرور با قرارداد ۴ و ۵
 * هم‌خوان است؛ سرویس واقعی در حیطهٔ امیر است و اینجا با payload ساختگی تست می‌شود.
 */

const read = (relativePath: string) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const pageSource = read('../../src/app/admin/login/page.tsx');
const rulesSource = read('../../src/app/admin/login/login-rules.ts');
const layoutSource = read('../../src/app/admin/layout.tsx');
const css = read('../../src/app/globals.css');

const PHASE09_MARKER = 'فاز ۰۹ — پنل ادمین: چیدمان و صفحهٔ ورود';
const phase09Start = css.indexOf(PHASE09_MARKER);
const adminCss = phase09Start >= 0 ? css.slice(phase09Start) : '';

function rule(selector: string): string {
  const start = adminCss.indexOf(`${selector} {`);
  if (start < 0) return '';
  const end = adminCss.indexOf('}', start);
  return adminCss.slice(start, end);
}

const PERSIAN_TEXT = /[\u0600-\u06FF]/;

/** حذف توضیحات تا بررسی «ممنوعیت در کد» با ذکر نام در مستندات اشتباه گرفته نشود. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const pageCode = stripComments(pageSource);
const rulesCode = stripComments(rulesSource);

describe('فاز ۰۹ — اعتبارسنجی ورود', () => {
  it('نام کاربری را تمیز می‌کند و فاصله‌های اضافی را یکسان می‌سازد', () => {
    expect(normalizeUsername('  مدیر   ارشد ')).toBe('مدیر ارشد');
    expect(normalizeUsername('')).toBe('');
  });

  it('هر دو فیلد خالی را جدا گزارش می‌کند', () => {
    const result = validateLoginInput({ username: '   ', password: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.username).toContain('نام کاربری');
    expect(result.errors.password).toContain('گذرواژه');
    expect(firstInvalidField(result.errors)).toBe('username');
  });

  it('گذرواژه را trim نمی‌کند چون فاصله می‌تواند بخشی از آن باشد', () => {
    const result = validateLoginInput({ username: 'admin', password: '  secret  ' });
    expect(result.ok).toBe(true);
    expect(result.value.password).toBe('  secret  ');
    expect(result.value.username).toBe('admin');
  });

  it('طول بیش از حد مجاز را رد می‌کند', () => {
    const longName = validateLoginInput({ username: 'ا'.repeat(USERNAME_MAX_LENGTH + 1), password: 'x' });
    expect(longName.ok).toBe(false);
    expect(longName.errors.username).toContain(String(USERNAME_MAX_LENGTH));
    const longPass = validateLoginInput({ username: 'admin', password: 'x'.repeat(PASSWORD_MAX_LENGTH + 1) });
    expect(longPass.ok).toBe(false);
    expect(longPass.errors.password).toContain(String(PASSWORD_MAX_LENGTH));
    expect(validateLoginInput({ username: 'admin', password: 'x'.repeat(PASSWORD_MAX_LENGTH) }).ok).toBe(true);
  });

  it('ورودی نامعتبر را بدون استثنا مدیریت می‌کند', () => {
    const result = validateLoginInput({ username: undefined as unknown as string, password: undefined as unknown as string });
    expect(result.ok).toBe(false);
  });
});

describe('فاز ۰۹ — پیام‌های خطا', () => {
  it('برای ۴۰۱ و ۴۰۳ پیام یکسان می‌دهد تا وجود نام کاربری لو نرود', () => {
    expect(loginErrorMessage(401)).toBe(loginErrorMessage(403));
    expect(loginErrorMessage(401)).not.toContain('نام کاربری موجود');
  });

  it('هر کد وضعیت پیام فارسی و قابل‌فهم دارد', () => {
    for (const status of [0, 400, 401, 403, 404, 405, 429, 500, 503]) {
      const message = loginErrorMessage(status);
      expect(message, String(status)).toMatch(PERSIAN_TEXT);
      expect(message.length, String(status)).toBeGreaterThan(10);
    }
    expect(loginErrorMessage(429)).toContain('صبر');
    expect(loginErrorMessage(404)).toContain('راه‌اندازی نشده');
    expect(loginErrorMessage(500)).toContain('سرور');
    expect(loginErrorMessage(Number.NaN)).toContain('ارتباط');
  });
});

describe('فاز ۰۹ — خواندن پاسخ سرور (قرارداد ۴ و ۵)', () => {
  const session = {
    adminId: 'adm_1',
    username: 'modir',
    role: 'moderator',
    createdAt: 1_700_000_000_000,
    expiresAt: 1_700_003_600_000,
  };

  it('قرارداد ۵ را با پوشش data و بدون پوشش می‌خواند', () => {
    const wrapped = readLoginResult(200, { ok: true, data: session });
    expect(wrapped.ok).toBe(true);
    if (wrapped.ok) {
      expect(wrapped.session.username).toBe('modir');
      expect(wrapped.session.role).toBe('moderator');
      expect(wrapped.session.expiresAt).toBe(session.expiresAt);
    }
    const direct = parseSessionPayload(session);
    expect(direct?.adminId).toBe('adm_1');
  });

  it('نقش ناشناخته را با کمترین دسترسی نمایش می‌دهد', () => {
    const parsed = parseSessionPayload({ ...session, role: 'god-mode' });
    expect(parsed?.role).toBe('viewer');
    expect(isAdminRole('superadmin')).toBe(true);
    expect(isAdminRole('god-mode')).toBe(false);
    expect(ADMIN_ROLES).toEqual(['superadmin', 'moderator', 'viewer']);
  });

  it('پاسخ موفقِ بی‌شکل را موفق حساب نمی‌کند', () => {
    expect(readLoginResult(200, null).ok).toBe(false);
    expect(readLoginResult(200, { data: { role: 'viewer' } }).ok).toBe(false);
    expect(parseSessionPayload('ok')).toBeNull();
    expect(parseSessionPayload([])).toBeNull();
  });

  it('پیام خطای سرور را ترجیح می‌دهد و در نبودش پیام پیش‌فرض می‌گذارد', () => {
    const withMessage = readLoginResult(403, { ok: false, error: { code: 'FORBIDDEN', message: 'دسترسی ندارید.' } });
    expect(withMessage).toEqual({ ok: false, message: 'دسترسی ندارید.' });
    const withoutMessage = readLoginResult(500, { ok: false });
    expect(withoutMessage).toEqual({ ok: false, message: loginErrorMessage(500) });
  });

  it('برچسب فارسی نقش‌ها و دکمهٔ گذرواژه یکتا است', () => {
    for (const role of ADMIN_ROLES) {
      expect(roleLabel(role)).toMatch(PERSIAN_TEXT);
    }
    expect(new Set(ADMIN_ROLES.map(roleLabel)).size).toBe(ADMIN_ROLES.length);
    expect(passwordToggleLabel(false)).toContain('نمایش');
    expect(passwordToggleLabel(true)).toContain('پنهان');
    expect(passwordToggleLabel(true)).not.toBe(passwordToggleLabel(false));
  });
});

describe('فاز ۰۹ — مقصد امن پس از ورود', () => {
  it('مسیرهای داخلی پنل را می‌پذیرد', () => {
    expect(safeAdminLanding('/admin')).toBe('/admin');
    expect(safeAdminLanding('/admin/')).toBe('/admin/');
    expect(safeAdminLanding('/admin/rooms?page=2')).toBe('/admin/rooms?page=2');
    expect(safeAdminLanding('  /admin/players  ')).toBe('/admin/players');
  });

  it('آدرس بیرونی، مسیر بیرون از پنل و ورودی مشکوک را رد می‌کند', () => {
    for (const raw of [
      null,
      undefined,
      '',
      'https://evil.example/admin',
      '//evil.example/admin',
      '/admin\\..\\etc',
      '/room/ABC123',
      '/adminx',
      '/',
      '/admin\u0000',
      'javascript:alert(1)',
    ]) {
      expect(safeAdminLanding(raw), String(raw)).toBe(DEFAULT_ADMIN_LANDING);
    }
    expect(DEFAULT_ADMIN_LANDING).toBe('/admin');
  });
});

describe('فاز ۰۹ — اعلان وضعیت', () => {
  it('اولویت موفق، سپس در حال ارسال و در پایان خطا را می‌دهد', () => {
    expect(loginStatusMessage({ submitting: true, error: '', success: true })).toContain('موفق');
    expect(loginStatusMessage({ submitting: true, error: 'خطا', success: false })).toContain('در حال بررسی');
    expect(loginStatusMessage({ submitting: false, error: 'خطای شبکه', success: false })).toBe('خطای شبکه');
    expect(loginStatusMessage({ submitting: false, error: '', success: false })).toBe('');
  });
});

describe('فاز ۰۹ — صفحهٔ ورود و چیدمان', () => {
  it('صفحه کلاینتی است و فقط به مسیر رسمی ورود درخواست می‌دهد', () => {
    expect(pageSource.startsWith("'use client';")).toBe(true);
    expect(pageSource).toContain('fetch(LOGIN_ENDPOINT');
    expect(pageSource).toContain("credentials: 'same-origin'");
    expect(LOGIN_ENDPOINT).toBe('/api/admin/login');
    expect(LOGOUT_ENDPOINT).toBe('/api/admin/logout');
    expect(pageSource).not.toContain('dangerouslySetInnerHTML');
  });

  it('هیچ گذرواژه‌ای در مرورگر، آدرس صفحه یا لاگ نوشته نمی‌شود', () => {
    for (const forbidden of ['localStorage', 'sessionStorage', 'document.cookie', 'console.log']) {
      expect(pageCode, forbidden).not.toContain(forbidden);
      expect(rulesCode, forbidden).not.toContain(forbidden);
    }
    expect(pageCode).not.toMatch(/searchParams.*password/);
    expect(pageCode).not.toMatch(/\?.*password=/);
    expect(pageCode).toContain("setPassword('')");
  });

  it('فیلدها برچسب، autocomplete و وضعیت خطای دسترس‌پذیر دارند', () => {
    expect(pageSource).toContain('htmlFor="admin-username"');
    expect(pageSource).toContain('htmlFor="admin-password"');
    expect(pageSource).toContain('autoComplete="username"');
    expect(pageSource).toContain('autoComplete="current-password"');
    expect(pageSource).toContain('aria-invalid={errors.username ? true : undefined}');
    expect(pageSource).toContain('aria-describedby={errors.username ?');
    expect(pageSource).toContain('aria-pressed={showPassword}');
    expect(pageSource).toContain("type={showPassword ? 'text' : 'password'}");
    expect(pageSource).toContain('noValidate');
    expect(pageSource).toContain('aria-busy={submitting}');
    expect(pageSource).toContain('role="alert"');
    expect(pageSource).toContain('aria-live="polite"');
    expect(pageSource).toContain("tabIndex={-1}");
  });

  it('چیدمان ادمین سروری، noindex و بدون وابستگی به بازی است', () => {
    expect(layoutSource).not.toContain("'use client'");
    expect(layoutSource).not.toContain('fetch(');
    expect(layoutSource).toContain('robots: { index: false, follow: false }');
    expect(layoutSource).toContain('className="admin-shell"');
    expect(layoutSource).toContain('className="admin-header"');
    expect(layoutSource).toContain('{children}');
    expect(layoutSource).toContain('href="/"');
  });

  it('استایل‌های ادمین هدف لمسی ۴۴px و عرض مهارشده دارند', () => {
    expect(adminCss).not.toBe('');
    expect(rule('.admin-home-link')).toContain('min-height: var(--control-height)');
    expect(rule('.admin-password-toggle')).toContain('min-height: var(--control-height)');
    expect(rule('.admin-login-card')).toContain('calc(100vw - 24px)');
    expect(adminCss).toContain('@media (max-width: 420px)');
    expect(rule('.admin-field.has-error .input-wrap')).toContain('border-color');
  });

  it('هیچ min-width بزرگ‌تر از ۲۸۸px و هیچ متن زیر ۱۴px در بخش ادمین نیست', () => {
    const offenders: string[] = [];
    for (const match of adminCss.matchAll(/(?:^|[;{\s])min-width:\s*([^;]+);/g)) {
      const value = match[1].trim();
      if (value === 'var(--control-height)') continue;
      const px = Number((/([\d.]+)px/.exec(value) ?? [])[1] ?? 0);
      if (px > 288) offenders.push(`min-width: ${value}`);
    }
    for (const match of adminCss.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = match[1].trim();
      if (value.startsWith('clamp(')) continue;
      if (value.includes('var(--text-xs)')) continue; // ۱۲px فقط برای پانویس غیرحیاتی
      if (value.includes('var(--text-sm)') || value.includes('var(--text-base)') || value.includes('var(--text-lg)')) continue;
      offenders.push(`font-size: ${value}`);
    }
    expect(offenders).toEqual([]);
  });

  it('متن‌های صفحه فارسی و بدون واژهٔ انگلیسی قابل‌نمایش هستند', () => {
    expect(pageSource).toContain('ورود به پنل مدیریت');
    expect(pageSource).toContain('نام کاربری');
    expect(pageSource).toContain('گذرواژه');
    expect(pageSource).toContain('ورود به پنل');
    expect(layoutSource).toContain('بازگشت به تماشاخانه');
    expect(layoutSource).toContain('پنل مدیریت تماشاخانه');
  });
});
