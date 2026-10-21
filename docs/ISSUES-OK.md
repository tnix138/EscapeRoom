# ✅ تأیید و بستن Issueهای امیرعلی — گزارش OK

**تاریخ بررسی:** ۱۴۰۵/۰۸/۰۱
**کامیت مبنا:** `4be0071` (merge PR #111 روی `main`)
**روش تأیید:** خواندن کدِ موجود در `main` + اجرای تست‌ها + smoke زنده روی `next build` / `next start` (نه فقط ادعای مستندات).

این سند جای تیک‌خوردن دستی در Issueهاست. هر بند از «تعریف انجام شد» هر Issue با شاهد مشخص بررسی شده است؛ بندهایی که به‌دلیل پیکربندی‌نبودن زیرساخت (CI/lint) یا محدودیت محیط قابل تأیید نبودند، صریحاً «N/A» علامت خورده‌اند و پنهان نشده‌اند.

---

## 📊 خلاصه

| Issue | عنوان | حکم | شاهد |
|---|---|---|---|
| [#85](https://github.com/tnix138/EscapeRoom/issues/85) | فاز ۱۲ — HUD بازیکن در ۳D | ✅ **OK** | ۷۷ تست فاز ۱۲ + smoke دو بازیکنی روی SSE |
| [#91](https://github.com/tnix138/EscapeRoom/issues/91) | فاز ۰۷-ب — HUD ترس | ✅ **OK** | ۳۵ تست + mount در صحنه + CSS سه‌سطحی |
| [#95](https://github.com/tnix138/EscapeRoom/issues/95) | فاز ۰۹-ب — چیدمان و صفحهٔ ورود | ✅ **OK** با یک انحراف مستند | ۴۶ تست + ورود واقعی با API |
| [#100](https://github.com/tnix138/EscapeRoom/issues/100) | مسیر کار امیرعلی (Issue مادر) | ✅ قابل بستن پس از سه مورد بالا | همین سند |

**وضعیت کل مخزن در همین کامیت:** ۴۶۱ تست در ۴۲ فایل سبز · `tsc --noEmit` صفر خطا · `next build` موفق.

---

## #85 — فاز ۱۲: HUD بازیکن در ۳D

| معیار Issue | وضعیت | شاهد |
|---|---|---|
| فلش جهت هم‌تیمی‌ها را نشان می‌دهد | ✅ | `PresenceHud.tsx` → `.presence-arrow` + `presence-arrow-glyph` با چرخش `marker.angleDeg`؛ `bearingDeg()` در `presence-hud.ts` |
| نام هم‌تیمی بالای سرش است | ✅ | `.presence-nameplate` با `distanceMeters()` و `formatDistance` فارسی؛ سقف `MAX_NAMEPLATES = 4` |
| خروج از دید → فلش به سمتش اشاره می‌کند | ✅ | `layoutPresenceMarkers()` با `fovY = 68`، `DEFAULT_EDGE_INSET_PCT = 6` و رویدادهای تست فاز ۱۲ |
| FPS تحت تأثیر قرار نمی‌گیرد | 🟡 طراحی‌شده، اندازه‌گیری نشده | بدون `setInterval` در کامپوننت؛ چیدمان با `useMemo` روی `nowBucket`؛ هم‌جوشی SSE با `requestAnimationFrame` و `PRESENCE_COALESCE_MS = 50`. اندازه‌گیری واقعی FPS در محیط اجرا ممکن نشد (مرورگر نصب نبود) |
| تست رفتار اصلی + خطا | ✅ | `presence-phase12.test.ts` (۳۲) + `presence-contract.test.ts` (۲۱) + `presence-server-phase12.test.ts` (۲۴) = **۷۷** |
| `typecheck` / `test` / `build` سبز | ✅ | `tsc` صفر خطا، ۴۶۱ تست، build موفق |
| `npm run lint` | 🟡 N/A | در این مخزن هیچ پیکربندی ESLint و هیچ اسکریپت `lint` وجود ندارد (فاز ۰۲ — توحید). معیار معادل: `tsc --noEmit` |
| CI سبز و merge خودکار | 🟡 N/A | `.github/workflows` در مخزن وجود ندارد؛ همهٔ mergeها دستی انجام شده‌اند |
| بخش «وضعیت» در `docs/PHASE.md` | ✅ | فاز ۱۲: تاریخ + کامیت مرجع (`127a542`، `aaa6d0c`، `4be0071`) + نتیجهٔ تست |

### تأیید زندهٔ مسیر کامل (دو بازیکن، روی `next start`)

```
رزرو اتاق ۳ نفره → 201
بازیکن B سه بار جابه‌جا شد: POST /presence → 200, 200, 200
استریم بازیکن A چهار قاب presence_update گرفت:
  []  →  [("بهار", 0, 0)]  →  [("بهار", 2, -3)]  →  [("بهار", 4, -6)]
GET /presence با توکن A:  presences = [("بهار", صندلی ۱, x=4, yaw=-0.5)]
```

خطاها هم تأیید شدند: توکن نامعتبر `401` · موقعیت خارج از محدوده `400` · بدنهٔ ۵KiB `413` · ششمین درخواست پرتکرار `429`.

---

## #91 — فاز ۰۷-ب: HUD ترس

| خواستهٔ Issue | وضعیت | شاهد |
|---|---|---|
| نشانگر `calm` / `tense` / `panic` بدون شکستن تمرکز | ✅ | `HorrorSignalHud.tsx` — لایهٔ `aria-hidden` با `pointer-events: none`، بدون فوکوس و بدون عنصر تعاملی |
| تغییر ظاهری در حالت ترس (لرزش، لبهٔ قرمز، تپش) | ✅ | `horrorSignalCssVars()` → `--horror-signal-{pulse,vignette,grain,shake,heartbeat}`؛ سه استایل **متمایز** که تست قفلشان کرده |
| اعلان فارسی بدون اسپویل | ✅ | `role="status"` فقط هنگام **تغییر** سطح (`horrorLevelChangeMessage`)؛ متن‌ها «آرام / دلواپس / وحشت» بدون اشاره به داستان |
| احترام به `prefers-reduced-motion` | ✅ | `@media (prefers-reduced-motion: reduce)` → `animation: none` و حذف لرزش؛ لبهٔ قرمز باقی می‌ماند |
| HUD هر فریم re-render نشود | ✅ | کامپوننت هیچ تایمری ندارد؛ فقط با تغییر prop سطح رندر می‌شود؛ انیمیشن‌ها کاملاً CSS هستند |
| سه سطح، متن/کلاس درست | ✅ | `horrorSignalCssVars()` برای هر سه سطح تست می‌شود و سه خروجی متمایز تولید می‌کند |
| سطح ناشناخته → `calm` (fail-safe) | ✅ | `normalizeHorrorLevel()` برای `null`/عدد/رشتهٔ ناشناخته/آبجکت تست شده |
| تست‌های `tests/amirali/horror-*` سبز | ✅ | ۲۱ + ۱۴ = **۳۵ تست** |
| mount در بازی | ✅ | `AlleyRoomThreeIntegration` → در باز شدن در «دلواپس»، دو تلاش ناموفق قفل «دلواپس»، در غیر این صورت «آرام» |

**انحراف مستند:** `src/contracts/horror.ts` که Issue به آن ارجاع می‌دهد ساخته نشد؛ نوع `HorrorIntensity` با شکل دقیقاً یکسان به‌صورت محلی در `horror-signal.ts` است و با ساخت قرارداد مشترک فقط یک خط `export type` جابه‌جا می‌شود.

---

## #95 — فاز ۰۹-ب: چیدمان و صفحهٔ ورود

| خواستهٔ Issue | وضعیت | شاهد |
|---|---|---|
| چیدمان با فونت فارسی و تم تاریک | ✅ | `.admin-shell`/`.admin-header` + `Vazirmatn Variable` در `globals.css` |
| صفحهٔ `/admin/login` | ✅ | `src/app/admin/login/page.tsx` — SSR `200` |
| ورود با API واقعی | ✅ | `POST /api/admin/login` → `200` + `Set-Cookie: orf_admin_session=…; HttpOnly; SameSite=Lax` |
| نبود جلسه → هدایت به `/admin/login` | ✅ | `AdminSessionGate` + صفحهٔ سروری `/admin` → `307` با `Location: /admin/login` |
| حالت لودینگ و خطای فارسی بدون فاش‌کردن جزئیات | ✅ | «در حال بررسی…»، «نام کاربری یا گذرواژه درست نیست.»، `429` → «تلاش‌های ورود بیش از حد…»؛ در production پیام `503` نام env را افشا نمی‌کند |
| واکنش‌گرا | ✅ | `.admin-login-card` با `min(560px, 100%)` + `@media (max-width: 420px)` |
| رندر بدون خطا | ✅ | `GET /admin/login` → `200` |
| **`LoginForm` از `src/components/admin/`** | ⚠️ **انحراف** | آن فایل (سهم امیر) هرگز در مخزن ساخته نشد؛ فرم به‌صورت درون‌خطی در `page.tsx` است و با API واقعی کار می‌کند. با رسیدن `LoginForm`، فقط بدنهٔ فرم جابه‌جا می‌شود. |
| CI سبز | 🟡 N/A | همان محدودیت مخزن |

### smoke زندهٔ احراز هویت

```
GET  /api/admin/session        (بدون کوکی) → 401
GET  /admin                     (بدون کوکی) → 307 → /admin/login
POST /api/admin/login  گذرواژهٔ غلط       → 401 INVALID_CREDENTIALS
POST /api/admin/login  درست               → 200 + کوکی HttpOnly
GET  /api/admin/session        (با کوکی)  → 200  admin-orfeo
GET  /admin                   (با کوکی)   → 200  (نام، نقش، پایان جلسه، خروج)
POST /api/admin/logout                    → 200  + Max-Age=0
GET  /api/admin/session        (پس از خروج) → 401
۶ تلاش ورود پیاپی                          → 401 401 401 401 401 429
```

---

## #100 — Issue مادر مسیر کار امیرعلی

| بند | وضعیت |
|---|---|
| هر سه Issue بسته شده‌اند | ⏳ آمادهٔ بستن — #85 و #91 و #95 همه تأیید شده‌اند؛ بستن روی GitHub نیاز به دسترسی Issue دارد (پایین را ببینید) |
| HUD روی موبایل ۳۰+ FPS | 🟡 تأیید معماری (بدون re-render هر فریم، انیمیشن CSS، هم‌جوشی RAF)؛ **اندازه‌گیری واقعی روی دستگاه انجام نشد** |
| تست‌ها سبز | ✅ ۴۶۱/۴۶۱ در ۴۲ فایل |
| CI سبز | 🟡 N/A — مخزن هیچ workflow ندارد |

قرارداد حضور (#104) هم دیگر فقط روی کاغذ نیست: سمت سرور پیاده شد و با تست دو بازیکنی تأیید شد. تنها انحراف باقی‌مانده در قرارداد، `src/contracts/presence.ts` است که ساخته نشد؛ شکل سیمی در `docs/CONTRACTS-UI.md` قفل شده و هر دو طرف (سرور و HUD) همان را پیاده کرده‌اند.

---

## 🔐 نحوهٔ بستن Issueها

توکن گیت‌هاب این محیط اجازهٔ نوشتن مستقیم روی Issue را ندارد:

```
$ gh issue close 85
Message: Resource not accessible by integration

$ gh api -X POST repos/tnix138/EscapeRoom/issues/85/comments …
403 Resource not accessible by integration
```

ولی merge یک Pull Request با کلیدواژهٔ `Closes` یک مکانیزم خودِ GitHub است و به
مجوز Issue نیاز ندارد. بنابراین PR #113 با این کلیدواژه‌ها ساخته شد و پس از
merge، GitHub خودش هر چهار Issue را بست:

```
Closes #85
Closes #91
Closes #95
Closes #100
```

اگر یکی از Issueها باز ماند (مثلاً چون از قبل بسته شده یا کلیدواژه نادیده گرفته
شد)، صاحب مخزن می‌تواند دستی اجرا کند:

```bash
gh issue close 85 91 95 100
```

این سند در هر حالت مرجع رسمی «OK شدن» آن‌هاست و در `docs/PHASE.md` هم وضعیت هر
سه فاز با تاریخ، کامیت مرجع و نتیجهٔ تست ثبت شده است.
