# 🎭 تماشاخانه اُرفه‌ئو (EscapeRoom: Orféo)

> **بازی اتاق فرار ترسناک و چندنفرهٔ آنلاین (۳ تا ۸ بازیکن)** در دل یک تماشاخانهٔ متروکه با نمای اول‌شخص سه‌بعدی (Three.js)، کات‌سین سینمایی همگام، صدای فضایی و حل معمای تیمی.

[![وب‌سایت آنلاین — Vercel](https://img.shields.io/badge/🌐_سایت_آنلاین-escaperoom--orfeo.vercel.app-d4af63?style=for-the-badge)](https://escaperoom-orfeo.vercel.app)
[![مخزن گیت‌هاب](https://img.shields.io/badge/📦_GitHub-tnix138%2FEscapeRoom-181717?style=for-the-badge&logo=github)](https://github.com/tnix138/EscapeRoom)
[![پایپ‌لاین CI/CD](https://img.shields.io/badge/⚙️_GitHub_Actions-CI_%2F_Auto--Merge_%2F_Deploy-2088FF?style=for-the-badge&logo=githubactions)](https://github.com/tnix138/EscapeRoom/actions)

---

## 🔗 دسترسی سریع به لینک‌های اصلی

| عنوان | لینک مستقیم و قابل کلیک |
| --- | --- |
| 🌐 **نسخهٔ آنلاین (Production — Vercel)** | [https://escaperoom-orfeo.vercel.app](https://escaperoom-orfeo.vercel.app) |
| 💻 **سرور توسعهٔ محلی (Local Dev)** | [http://localhost:3000](http://localhost:3000) |
| 🩺 **سلامت سرور آنلاین (`/api/health`)** | [https://escaperoom-orfeo.vercel.app/api/health](https://escaperoom-orfeo.vercel.app/api/health) |
| 📦 **مخزن گیت‌هاب پروژه** | [https://github.com/tnix138/EscapeRoom](https://github.com/tnix138/EscapeRoom) |
| ⚙️ **وضعیت اجراهای GitHub Actions** | [https://github.com/tnix138/EscapeRoom/actions](https://github.com/tnix138/EscapeRoom/actions) |
| 🔀 **فهرست Pull Requestها** | [https://github.com/tnix138/EscapeRoom/pulls](https://github.com/tnix138/EscapeRoom/pulls) |
| 📋 **تابلوی Issueها و نقشهٔ کار** | [https://github.com/tnix138/EscapeRoom/issues](https://github.com/tnix138/EscapeRoom/issues) |
| 📜 **تاریخچهٔ نسخه‌ها (`CHANGELOG.md`)** | [./CHANGELOG.md](./CHANGELOG.md) |

---

## 🎮 ۱. لینک‌های صفحات بازی (مسیر بازیکن)

| بخش | مسیر | لینک آنلاین (Production) | لینک محلی (Localhost) | توضیح |
| --- | --- | --- | --- | --- |
| 🎭 **لابی و رزرو اتاق** | `/` | [escaperoom-orfeo.vercel.app/](https://escaperoom-orfeo.vercel.app/) | [localhost:3000/](http://localhost:3000/) | ساخت اتاق ۳ تا ۸ نفره و دریافت لینک اختصاصی هر بازیکن |
| 📰 **بخش آپدیت‌های پروژه** | `/#updates` | [escaperoom-orfeo.vercel.app/#updates](https://escaperoom-orfeo.vercel.app/#updates) | [localhost:3000/#updates](http://localhost:3000/#updates) | مرور کلی جدیدترین به‌روزرسانی‌های بازی در صفحهٔ اصلی |
| ✉️ **پاکت دعوت‌نامهٔ اختصاصی** | `/invite/[code]/[seatToken]` | `https://escaperoom-orfeo.vercel.app/invite/{CODE}/{TOKEN}` | `http://localhost:3000/invite/{CODE}/{TOKEN}` | باز شدن پاکت مهروموم‌شده، موسیقی پیش‌درآمد و ورود به اتاق |
| 🚪 **اتاق بازی چندنفره زنده** | `/room/[code]` | `https://escaperoom-orfeo.vercel.app/room/{CODE}?token={TOKEN}` | `http://localhost:3000/room/{CODE}?token={TOKEN}` | کوچهٔ سه‌بعدی ⟵ کات‌سین ۷۴ ثانیه‌ای ⟵ سالن تاریک ویران |
| 📱 **مانیفست وب‌اپلیکیشن (PWA)** | `/manifest.webmanifest` | [escaperoom-orfeo.vercel.app/manifest.webmanifest](https://escaperoom-orfeo.vercel.app/manifest.webmanifest) | [localhost:3000/manifest.webmanifest](http://localhost:3000/manifest.webmanifest) | مشخصات نصب روی موبایل و دسکتاپ |

---

## 🧪 ۲. لینک‌های پیش‌نمایش و استودیوهای سه‌بعدی (بدون نیاز به ساخت اتاق)

با کلیک روی هر کدام از لینک‌های زیر می‌توانید مستقیماً وارد صحنه‌ها و ابزارهای تست شوید:

| صحنه / ابزار | مسیر | لینک آنلاین (Production) | لینک محلی (Localhost) | کاربرد |
| --- | --- | --- | --- | --- |
| ✉️ **پیش‌نمایش دعوت‌نامه** | `/preview/invitation` | [escaperoom-orfeo.vercel.app/preview/invitation](https://escaperoom-orfeo.vercel.app/preview/invitation) | [localhost:3000/preview/invitation](http://localhost:3000/preview/invitation) | تست مستقیم انیمیشن پاکت دعوت‌نامه، برگهٔ بلیط و صدای محیطی |
| 🌧️ **پیش‌نمایش کوچهٔ سه‌بعدی** | `/preview/alley` | [escaperoom-orfeo.vercel.app/preview/alley](https://escaperoom-orfeo.vercel.app/preview/alley) | [localhost:3000/preview/alley](http://localhost:3000/preview/alley) | گشت‌وگذار اول‌شخص سه‌بعدی در کوچه، بلیط شیشه‌ای و قفل در |
| 🖼️ **پیش‌نمایش کوچه (نمای کلاسیک)** | `/preview/alley?mode=css` | [escaperoom-orfeo.vercel.app/preview/alley?mode=css](https://escaperoom-orfeo.vercel.app/preview/alley?mode=css) | [localhost:3000/preview/alley?mode=css](http://localhost:3000/preview/alley?mode=css) | نمای کلاسیک دوبعدی کوچه و چیدمان هم‌سفران |
| 🎬 **پیش‌نمایش کات‌سین سینمایی** | `/preview/cinema` | [escaperoom-orfeo.vercel.app/preview/cinema](https://escaperoom-orfeo.vercel.app/preview/cinema) | [localhost:3000/preview/cinema](http://localhost:3000/preview/cinema) | پخش مستقل کات‌سین ۷۴ ثانیه‌ای اول‌شخص با نوار پرش زمانی |
| 🕯️ **پیش‌نمایش سالن تئاتر و سالن تاریک** | `/preview/auditorium` | [escaperoom-orfeo.vercel.app/preview/auditorium](https://escaperoom-orfeo.vercel.app/preview/auditorium) | [localhost:3000/preview/auditorium](http://localhost:3000/preview/auditorium) | بررسی سالن ۲۰ نفره، سالن تاریک پس از کات‌سین و نقاط داغ |
| 🧍 **استودیوی کاراکترهای انسان** | `/preview/characters` | [escaperoom-orfeo.vercel.app/preview/characters](https://escaperoom-orfeo.vercel.app/preview/characters) | [localhost:3000/preview/characters](http://localhost:3000/preview/characters) | بررسی چهره‌های رویه‌ای، اسکلت، پلک‌زدن و مقایسهٔ قبل/بعد |
| ⚡ **بنچمارک کارایی موتور سه‌بعدی** | `/preview/performance` | [escaperoom-orfeo.vercel.app/preview/performance](https://escaperoom-orfeo.vercel.app/preview/performance) | [localhost:3000/preview/performance](http://localhost:3000/preview/performance) | سنجش FPS، تعداد مثلث‌ها و Draw Call صحنه‌های سه‌بعدی |
| 🧭 **صفحهٔ بازبینی QA کاوش و نجوا** | `/qa/exploration` | [escaperoom-orfeo.vercel.app/qa/exploration](https://escaperoom-orfeo.vercel.app/qa/exploration) | [localhost:3000/qa/exploration](http://localhost:3000/qa/exploration) | تست تعاملی HUD کاوش سالن و پنل نجوای گروهی |

---

## 🛡️ ۳. لینک‌های پنل مدیریت (Admin Panel)

| صفحهٔ مدیریتی | مسیر | لینک آنلاین (Production) | لینک محلی (Localhost) | کاربرد |
| --- | --- | --- | --- | --- |
| 🔐 **ورود مدیر سیستم** | `/admin/login` | [escaperoom-orfeo.vercel.app/admin/login](https://escaperoom-orfeo.vercel.app/admin/login) | [localhost:3000/admin/login](http://localhost:3000/admin/login) | احراز هویت امن ادمین با کوکی نشست امضاشده |
| 📊 **داشبورد اصلی ادمین** | `/admin` | [escaperoom-orfeo.vercel.app/admin](https://escaperoom-orfeo.vercel.app/admin) | [localhost:3000/admin](http://localhost:3000/admin) | نمای کلی آمار اتاق‌ها، بازیکنان، سلامت سرور و خطاها |
| 🏛️ **مدیریت اتاق‌ها** | `/admin/rooms` | [escaperoom-orfeo.vercel.app/admin/rooms](https://escaperoom-orfeo.vercel.app/admin/rooms) | [localhost:3000/admin/rooms](http://localhost:3000/admin/rooms) | مشاهدهٔ وضعیت لحظه‌ای فازها و اتاق‌های ساخته‌شده |
| 👥 **مدیریت بازیکنان** | `/admin/players` | [escaperoom-orfeo.vercel.app/admin/players](https://escaperoom-orfeo.vercel.app/admin/players) | [localhost:3000/admin/players](http://localhost:3000/admin/players) | فهرست بازیکنان، صندلی‌ها، وضعیت آنلاین و جزئیات هر پلیر |
| 🚨 **لاگ خطاها و رخدادها** | `/admin/errors` | [escaperoom-orfeo.vercel.app/admin/errors](https://escaperoom-orfeo.vercel.app/admin/errors) | [localhost:3000/admin/errors](http://localhost:3000/admin/errors) | پایش خطاهای سرور و رویدادهای امنیتی |
| 🎭 **نمایشگاه کاراکترها در ادمین** | `/admin/characters` | [escaperoom-orfeo.vercel.app/admin/characters](https://escaperoom-orfeo.vercel.app/admin/characters) | [localhost:3000/admin/characters](http://localhost:3000/admin/characters) | کالبدشکافی سه‌بعدی هر ۸ کاراکتر پلیر و شخصیت‌های نمایش |
| 🛠️ **اکسپلورر جامع آپدیت‌ها** | `/admin/updates` | [escaperoom-orfeo.vercel.app/admin/updates](https://escaperoom-orfeo.vercel.app/admin/updates) | [localhost:3000/admin/updates](http://localhost:3000/admin/updates) | گزارش فنی و کامل تمامی نسخه‌ها، فایل‌های تغییریافته و PRها |

---

## 🔌 ۴. مسیرهای وب‌سرویس و بلادرنگ (API & Realtime SSE)

| متد | مسیر API | لینک مستقیم نمونه / الگو | کاربرد |
| --- | --- | --- | --- |
| `GET` | `/api/health` | [escaperoom-orfeo.vercel.app/api/health](https://escaperoom-orfeo.vercel.app/api/health) · [localhost:3000/api/health](http://localhost:3000/api/health) | بررسی سلامت سرویس، ساعت سرور و نوع درایور ذخیره‌سازی (`sqlite` / `supabase`) |
| `POST` | `/api/rooms` | `https://escaperoom-orfeo.vercel.app/api/rooms` | ساخت اتاق جدید (۳ تا ۸ بازیکن) و تولید توکن صندلی‌ها |
| `GET` | `/api/rooms/[code]` | `https://escaperoom-orfeo.vercel.app/api/rooms/{CODE}?token={TOKEN}` | خواندن وضعیت کامل اتاق بر اساس صندلی بازیکن |
| `POST` | `/api/rooms/[code]/action` | `https://escaperoom-orfeo.vercel.app/api/rooms/{CODE}/action` | ارسال اکشن‌های بازی (پانچ بلیط، باز کردن قفل در، بررسی نقاط داغ) |
| `POST` | `/api/rooms/[code]/chat` | `https://escaperoom-orfeo.vercel.app/api/rooms/{CODE}/chat` | ارسال پیام متنی و اشتراک سرنخ/کوپن بلیط در «نجوای گروهی» |
| `GET` / `POST` | `/api/rooms/[code]/presence` | `https://escaperoom-orfeo.vercel.app/api/rooms/{CODE}/presence` | انتشار و دریافت مختصات سه‌بعدی و زاویهٔ دید هم‌تیمی‌ها (۱۰Hz) |
| `GET` | `/api/rooms/[code]/stream` | `https://escaperoom-orfeo.vercel.app/api/rooms/{CODE}/stream?token={TOKEN}` | استریم بلادرنگ تغییرات اتاق و همگام‌سازی ساعت کات‌سین (SSE) |
| `GET` | `/api/admin/session` | [escaperoom-orfeo.vercel.app/api/admin/session](https://escaperoom-orfeo.vercel.app/api/admin/session) · [localhost:3000/api/admin/session](http://localhost:3000/api/admin/session) | بررسی وضعیت نشست مدیر |
| `POST` | `/api/admin/login` · `/api/admin/logout` | `https://escaperoom-orfeo.vercel.app/api/admin/login` | ورود و خروج امن مدیر |
| `GET` | `/api/admin/stats` · `/rooms` · `/players` · `/errors` | `https://escaperoom-orfeo.vercel.app/api/admin/stats` | داده‌های آماری و مدیریتی پنل ادمین (شامل `/api/admin/players/[id]`) |

---

## 📚 ۵. مستندات پروژه، معماری و گردش کار (`docs/`)

### مستندات هسته و راهنمای ایجنت‌ها
| سند | لینک فایل در مخزن | مخاطب | محتوا |
| --- | --- | --- | --- |
| راهنمای ورود مستندات | [docs/README.md](./docs/README.md) | همه | نقطهٔ شروع سریع مطالعهٔ مستندات |
| چشم‌انداز محصول | [docs/VISION.md](./docs/VISION.md) | همه | اتمسفر، حس ترس بزرگسال و تجربهٔ هدف بازی |
| قوانین همکاری | [docs/RULES.md](./docs/RULES.md) | همه | مرز مالکیت فایل‌ها و قواعد توسعهٔ موازی |
| پرامپت و نقش ایجنت‌ها | [docs/AGENTS.md](./docs/AGENTS.md) | ایجنت‌ها | شرح وظایف و پرامپت آغازین هر ۵ ایجنت |
| نقشهٔ کلان فازها | [docs/PHASES.md](./docs/PHASES.md) | همه | نمای کلی فازهای توسعه |
| جزئیات اجرایی فازها | [docs/PHASE.md](./docs/PHASE.md) | همه | وضعیت دقیق هر فاز، وابستگی‌ها و معیارهای پذیرش |
| قراردادهای مشترک سرور/کلاینت | [docs/CONTRACTS.md](./docs/CONTRACTS.md) | ایجنت‌ها | تایپ‌ها و قراردادهای رسمی ارتباط بین لایه‌ها |
| قراردادهای رابط کاربری | [docs/CONTRACTS-UI.md](./docs/CONTRACTS-UI.md) | ایجنت‌ها | اصول چیدمان HUD، دسترس‌پذیری و واکنش‌گرایی |
| اتوماسیون CI/CD | [docs/AUTO.md](./docs/AUTO.md) | توحید و همه | چرخهٔ تست، ادغام خودکار و انتشار |
| گزارش Issueهای تکمیل‌شده | [docs/ISSUES-OK.md](./docs/ISSUES-OK.md) | همه | فهرست تسک‌ها و Issueهای بسته‌شده |

### اسناد ویژگی‌های فنی (`docs/features/`)
| ویژگی | لینک فایل در مخزن |
| --- | --- |
| پنل مدیریت (Admin Panel) | [docs/features/admin-panel.md](./docs/features/admin-panel.md) |
| واقع‌گرایی کاراکترهای سه‌بعدی انسان | [docs/features/character-realism.md](./docs/features/character-realism.md) |
| کات‌سین سینمایی اول‌شخص | [docs/features/cinematic-cutscene.md](./docs/features/cinematic-cutscene.md) |
| نورپردازی و اتمسفر وحشت | [docs/features/lighting-horror.md](./docs/features/lighting-horror.md) |
| قرارداد جهت نگاه و کنترل دوربین | [docs/features/look-direction.md](./docs/features/look-direction.md) |
| پوستهٔ موبایل و وب‌اپلیکیشن | [docs/features/mobile-app-shell.md](./docs/features/mobile-app-shell.md) |
| طراحی واکنش‌گرا (Mobile Responsive) | [docs/features/mobile-responsive.md](./docs/features/mobile-responsive.md) |
| حضور چندنفرهٔ بلادرنگ (Multiplayer Presence) | [docs/features/multiplayer-presence.md](./docs/features/multiplayer-presence.md) |
| روایت و داستان اُرفه‌ئو | [docs/features/story.md](./docs/features/story.md) |

### چک‌لیست‌ها، پایپ‌لاین‌ها و پیکربندی زیرساخت
| مورد | لینک فایل در مخزن |
| --- | --- |
| چک‌لیست پیش از ادغام (Before Merge) | [docs/checklists/before-merge.md](./docs/checklists/before-merge.md) |
| چک‌لیست پیش از انتشار (Before Release) | [docs/checklists/before-release.md](./docs/checklists/before-release.md) |
| پایپ‌لاین بررسی کیفیت و تست (`CI`) | [.github/workflows/ci.yml](./.github/workflows/ci.yml) |
| پایپ‌لاین ادغام خودکار (`Auto-Merge`) | [.github/workflows/auto-merge.yml](./.github/workflows/auto-merge.yml) |
| پایپ‌لاین استقرار تولیدی (`Deploy`) | [.github/workflows/deploy.yml](./.github/workflows/deploy.yml) |
| پایپ‌لاین همگام‌سازی Issueها | [.github/workflows/issue-sync.yml](./.github/workflows/issue-sync.yml) |
| اسکیمای اولیهٔ دیتابیس Supabase | [supabase/migrations/001_initial_schema.sql](./supabase/migrations/001_initial_schema.sql) |
| جدول رخدادها و خطاهای ادمین در Supabase | [supabase/migrations/002_admin_events.sql](./supabase/migrations/002_admin_events.sql) |
| نمونه متغیرهای محیطی | [.env.example](./.env.example) |
| تنظیمات استقرار Vercel | [vercel.json](./vercel.json) |

---

## 👥 تیم پروژه و نقش‌ها

ما ۵ هم‌تیمی برابر هستیم و هر کدام یک ایجنت هوش مصنوعی را هدایت می‌کنیم:

| عضو تیم | ایجنت | حوزهٔ مسئولیت |
| --- | --- | --- |
| **توحید** | Arena Agent | زیرساخت، سرور، دیتابیس (SQLite / Supabase)، امنیت و دیپلوی |
| **علیرضا** | Arena Agent | موتور سه‌بعدی (Three.js)، کاراکترهای انسانی، نورپردازی، صدا و کات‌سین |
| **امیرعلی** | Arena Agent | رابط کاربری، تجربهٔ بازیکن، بلیط شیشه‌ای، نجوای گروهی و HUD |
| **امیر** | Arena Agent | پنل ادمین، آمار زنده، پایش خطاها و ابزارهای مدیریتی |
| **نازنین** | Arena Agent | تضمین کیفیت (QA)، تست تجربهٔ کاربری و مستندسازی فازها |

---

## 🚀 راه‌اندازی سریع روی سیستم محلی

```bash
# ۱. نصب وابستگی‌ها
npm ci

# ۲. اجرای سرور توسعه روی http://localhost:3000
npm run dev

# ۳. اجرای کامل بررسی تایپ، لینت و تمام تست‌های Vitest
npm run ci

# ۴. ساخت نسخهٔ تولیدی و اجرای اسمک‌تست ۱۵ مرحله‌ای
npm run build
npm run smoke
```
