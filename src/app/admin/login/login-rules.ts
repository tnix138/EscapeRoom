/**
 * login-rules.ts — قواعد خالص صفحهٔ ورود پنل ادمین (فاز ۰۹، سهم امیرعلی)
 * -------------------------------------------------------------------------
 * این فایل هیچ DOM، fetch یا ذخیره‌سازی ندارد؛ فقط ورودی کاربر و پاسخ سرور را
 * به وضعیت قابل‌نمایش تبدیل می‌کند. بنابراین بدون مرورگر و بدون سرویس ورود
 * (که در حیطهٔ امیر است) هم کامل تست می‌شود.
 *
 * قراردادها:
 *  - قرارداد ۴ (پیام خطا): { ok: false, error: { code, message } }
 *  - قرارداد ۵ (احراز هویت ادمین): AdminSession با role محدود
 *  - گذرواژه هرگز در localStorage/sessionStorage یا آدرس صفحه نوشته نمی‌شود؛
 *    جلسه فقط در کوکی httpOnly سمت سرور نگه داشته می‌شود.
 */

export type AdminRole = 'superadmin' | 'moderator' | 'viewer';

export const ADMIN_ROLES: readonly AdminRole[] = ['superadmin', 'moderator', 'viewer'];

/** مسیرهای رسمی ورود/خروج (توحید و امیر پیاده می‌کنند). */
export const LOGIN_ENDPOINT = '/api/admin/login';
export const LOGOUT_ENDPOINT = '/api/admin/logout';
/** بررسی جلسهٔ فعلی؛ اگر امیر این مسیر را متفاوت ساخت، فقط همین ثابت عوض می‌شود. */
export const ADMIN_SESSION_ENDPOINT = '/api/admin/session';

/** مقصد پیش‌فرض پس از ورود موفق؛ داشبورد در فاز ۱۰ ساخته می‌شود. */
export const DEFAULT_ADMIN_LANDING = '/admin';

export const USERNAME_MAX_LENGTH = 32;
export const PASSWORD_MAX_LENGTH = 128;

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginErrors {
  username?: string;
  password?: string;
}

export interface LoginValidation {
  ok: boolean;
  errors: LoginErrors;
  /** ورودی پاک‌شده برای ارسال؛ گذرواژه هرگز trim نمی‌شود چون فاصله می‌تواند بخشی از آن باشد. */
  value: LoginInput;
}

/** حذف فاصله‌های ابتدا/انتها و یکسان‌سازی فاصله‌های داخلی نام کاربری. */
export function normalizeUsername(value: string): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** اعتبارسنجی سمت کلاینت؛ فقط جلوی ورودی خالی/بیش‌ازحد بلند را می‌گیرد. */
export function validateLoginInput(input: LoginInput): LoginValidation {
  const username = normalizeUsername(input?.username ?? '');
  const password = input?.password ?? '';
  const errors: LoginErrors = {};

  if (!username) errors.username = 'نام کاربری را وارد کنید.';
  else if (username.length > USERNAME_MAX_LENGTH) {
    errors.username = `نام کاربری حداکثر ${USERNAME_MAX_LENGTH} نویسه است.`;
  }

  if (!password) errors.password = 'گذرواژه را وارد کنید.';
  else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `گذرواژه حداکثر ${PASSWORD_MAX_LENGTH} نویسه است.`;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { username, password },
  };
}

/** پیام فارسی هر کد وضعیت پاسخ سرور؛ هرگز نمی‌گوید کدام فیلد اشتباه بوده. */
export function loginErrorMessage(status: number): string {
  if (!Number.isFinite(status) || status <= 0) return 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  if (status >= 500) return 'سرور در این لحظه پاسخ نمی‌دهد. کمی بعد دوباره تلاش کنید.';
  if (status === 429) return 'تلاش‌های ورود زیاد بوده است؛ چند لحظه صبر کنید و دوباره تلاش کنید.';
  if (status === 404 || status === 405) return 'سرویس ورود هنوز راه‌اندازی نشده است؛ بعداً تلاش کنید.';
  if (status === 400) return 'نام کاربری و گذرواژه را کامل و درست وارد کنید.';
  return 'نام کاربری یا گذرواژه درست نیست.';
}

export interface AdminSessionView {
  adminId: string;
  username: string;
  role: AdminRole;
  createdAt: number;
  expiresAt: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: AdminRole): string {
  if (role === 'superadmin') return 'مدیر ارشد';
  if (role === 'moderator') return 'ناظر';
  return 'بازبین';
}

/**
 * خواندن پاسخ سرور. شکل پذیرفته‌شده:
 *  - موفق: { ok: true, data: AdminSession }
 *  - ناموفق: { ok: false, error: { code, message } }
 * نقش ناشناخته با کمترین دسترسی («بازبین») نمایش داده می‌شود.
 */
export function parseSessionPayload(payload: unknown): AdminSessionView | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data) ?? root;
  const username = typeof data.username === 'string' ? normalizeUsername(data.username) : '';
  if (!username) return null;
  const role: AdminRole = isAdminRole(data.role) ? data.role : 'viewer';
  return {
    adminId: typeof data.adminId === 'string' && data.adminId.trim() ? data.adminId.trim() : 'admin',
    username,
    role,
    createdAt: asFiniteNumber(data.createdAt) ?? 0,
    expiresAt: asFiniteNumber(data.expiresAt) ?? 0,
  };
}

export type LoginResult =
  | { ok: true; session: AdminSessionView }
  | { ok: false; message: string };

/** ترکیب کد وضعیت و بدنهٔ پاسخ در یک نتیجهٔ قابل‌نمایش. */
export function readLoginResult(status: number, payload: unknown): LoginResult {
  if (status >= 200 && status < 300) {
    const session = parseSessionPayload(payload);
    if (session) return { ok: true, session };
    return { ok: false, message: 'پاسخ سرویس ورود معتبر نبود؛ دوباره تلاش کنید.' };
  }
  const root = asRecord(payload);
  const error = asRecord(root?.error);
  const serverMessage = typeof error?.message === 'string' ? error.message.trim() : '';
  return { ok: false, message: serverMessage || loginErrorMessage(status) };
}

/** اولین فیلد نامعتبر برای انتقال فوکوس. */
export function firstInvalidField(errors: LoginErrors): keyof LoginErrors | null {
  if (errors.username) return 'username';
  if (errors.password) return 'password';
  return null;
}

/**
 * مقصد امن پس از ورود: فقط مسیر داخلی پنل ادمین؛ جلوگیری از open redirect.
 * هر مقدار مشکوک (آدرس کامل، //، کاراکتر کنترلی یا مسیر بیرون از /admin) رد می‌شود.
 */
export function safeAdminLanding(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return DEFAULT_ADMIN_LANDING;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return DEFAULT_ADMIN_LANDING;
  if (/[\u0000-\u001f]/.test(value)) return DEFAULT_ADMIN_LANDING;
  if (value !== DEFAULT_ADMIN_LANDING && !value.startsWith(`${DEFAULT_ADMIN_LANDING}/`)) {
    return DEFAULT_ADMIN_LANDING;
  }
  return value;
}

/** متن دکمهٔ نمایش گذرواژه برای صفحه‌خوان. */
export function passwordToggleLabel(visible: boolean): string {
  return visible ? 'پنهان کردن گذرواژه' : 'نمایش گذرواژه';
}

/** اعلان وضعیت برای aria-live؛ متن خالی یعنی چیزی برای اعلام نیست. */
export function loginStatusMessage(options: { submitting: boolean; error: string; success: boolean }): string {
  if (options.success) return 'ورود موفق بود؛ در حال رفتن به داشبورد…';
  if (options.submitting) return 'در حال بررسی نام کاربری و گذرواژه…';
  return options.error;
}

/* ==========================================================================
 * محافظ جلسهٔ پنل (فاز ۰۹-ب — «اگر جلسه معتبر نیست، به /admin/login برو»)
 * ========================================================================== */

/** مسیر صفحهٔ ورود. */
export const ADMIN_LOGIN_PATH = '/admin/login';

/** آیا این مسیر خودِ صفحهٔ ورود است؟ (برای جلوگیری از حلقهٔ ریدایرکت) */
export function isAdminLoginPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string') return false;
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  return clean === ADMIN_LOGIN_PATH;
}

/**
 * فقط ۴۰۱/۴۰۳ یعنی «جلسه ندارید»؛ بقیهٔ حالت‌ها (۴۰۴ = سرویس آماده نیست،
 * ۵۰۰، خطای شبکه) نباید بازدیدکننده را بیرون بیندازند — وگرنه تا وقتی سرویس
 * امیر آماده نشده، پنل در حلقهٔ ریدایرکت گیر می‌کند.
 */
export function shouldRedirectToLogin(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * آمادگی مقصد پس از ورود: تا وقتی داشبورد پنل (فاز ۱۰ — امیر) ساخته نشده،
 * `/admin` صفحهٔ ۴۰۴ می‌دهد. به‌جای پرت کردن مدیر به ۴۰۴، وضعیت را می‌فهمیم و
 * پیام صادقانه نشان می‌دهیم. روزی که صفحه اضافه شود، خودکار «آماده» می‌شود.
 */
export function landingAvailabilityFromStatus(status: number): 'ready' | 'missing' | 'unknown' {
  if (status === 404 || status === 405) return 'missing';
  if (status >= 200 && status < 400) return 'ready';
  return 'unknown';
}

/** متن وضعیت «پنل هنوز آماده نیست» برای صفحهٔ ورود. */
export const ADMIN_PANEL_PENDING_MESSAGE =
  'ورود موفق بود، اما داشبورد پنل مدیریت هنوز ساخته نشده است (فاز ۱۰). ' +
  'با آماده شدن داشبورد، همین صفحه خودکار شما را به آن می‌فرستد.';

/** مقصد ورود همراه با بازگشت به همان صفحه؛ مسیر ناامن نادیده گرفته می‌شود. */
export function loginPathFor(pathname: string | null | undefined): string {
  const safe = safeAdminLanding(pathname);
  if (safe === DEFAULT_ADMIN_LANDING) return ADMIN_LOGIN_PATH;
  return `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(safe)}`;
}
