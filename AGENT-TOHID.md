---
agent_id: tohid
agent_name: توحید
role: backend_data_sync
status: active_plan
intended_audience: coding_agents_only
human_reading: not_required
plan: DOCUMENTATION.md
---

# Agent plan — توحید

> **عامل کدنویس بخواند؛ متن برای کاربر نهایی نیست.** پیش از هر موج `AGENTS.md`، `DOCUMENTATION.md`، این فایل و `WORKLOG.md` را بخوان. برای شروع هر موج فقط کارت همان موج را اجرا کن؛ جلوتر نرو تا گیت موج قبلی تأیید شود.

## هویت و محدوده مالکیت

- مالک: `src/server/**`, `src/engine/**`, `src/app/api/**`, `src/client-sdk/**`, `supabase/**`, `tests/tohid/**`.
- `src/contracts/**` مشترک است: تغییر فقط پس از توافق کتبی/PR با امیرعلی و علیرضا.
- مالک مدل، رندر سه‌بعدی، صحنه و استایل نیستی. کد مالکان دیگر را اصلاح یا overwrite نکن.
- اصل شبکه: سرور مالک نتیجه معما، فاز، توکن، نشست و پیشرفت پایدار است. ورودی خام کیبورد/ماوس را فریم‌به‌فریم ارسال/ذخیره نکن. همگام‌سازی transform بازیکنان فقط پس از تأیید نیاز چندنفره و قرارداد امنیتی.

## برنامهٔ اجرایی ۱۰ موج

| موج | کارهای دقیق | تحویل و معیار پذیرش |
|---|---|---|
| **۱ — ممیزی سرور** | وضعیت فعلی `ClientRoomView`، فازها، APIها، توکن، ذخیره‌سازی و SSE را بررسی کن؛ مشخص کن world position کجا وجود ندارد؛ پیشنهاد بده چه state حداقلی برای تجربهٔ چندنفره لازم است. | یادداشت در `REDESIGN-WAVE-1.md`; بدون کد/تغییر قرارداد/مهاجرت. تأیید مالک هنوز لازم است. |
| **۲ — قرارداد runtime** | با علیرضا دربارهٔ نیازهای scene ID، spawn/return location و رخدادهای بازی توافق کن؛ مدل داده را از renderer جدا نگه دار؛ فقط قراردادهای ضروری را با تأیید تیم تغییر بده. | قرارداد کوچک و versionable؛ تست projection؛ هیچ movement endpoint بدون تصمیم رسمی. |
| **۳ — حضور و حرکت چندنفره** | طبق تصمیم موج ۱/۲، presence، reconnect و در صورت تصویب transformهای محدود/نرخ‌محدود را پیاده کن؛ validate bounds/rate, reject malformed values؛ هیچ raw key event ذخیره نشود. | تست rate limit، reconnect، چند کلاینت و قرارداد منطبق؛ اگر همگام‌سازی transform لازم نیست، مستند کن و endpoint نساز. |
| **۴ — state صحنهٔ کوچه** | شناسهٔ فاز/صحنه و دادهٔ لازم برای spawn/reset/refresh را اضافه کن؛ از ذخیرهٔ جزئیات renderer خودداری کن. | ورود/بازگشت به صحنه در refresh پایدار؛ migration فقط در صورت نیاز واقعی. |
| **۵ — رزرو تا ورود** | API رزرو و invite seat token را برای UI جدید حفظ/سخت‌سازی کن؛ session recovery و خطاهای رزرو را تست کن. | اتاق ۳–۸ نفره، دعوت یکتا و ورود/reconnect تست‌شده؛ token خام فقط در خروجی مجاز invite. |
| **۶ — معمای کوچه** | پانچ و قفل را server-authoritative نگه دار؛ پاسخ‌ها و digitها را از projection پنهان کن؛ همزمانی و rate limit را سخت‌سازی کن. | تست همهٔ اندازه‌های گروه ۳..۸، OCC/concurrency، پاسخ یکتا و عدم نشت اطلاعات. |
| **۷ — انتقال سالن** | فاز انتقال و state حضور/seatها را با صحنهٔ سه‌بعدی سالن هماهنگ کن؛ قرارداد را renderer-agnostic نگه دار. | همهٔ کلاینت‌ها فاز و اعضای گروه را سازگار ببینند؛ refresh فاز را بازیابی کند. |
| **۸ — clock و کات‌سین** | زمان سرور/clock offset و گذار ۰–۱۱–۷۴ ثانیه را حفظ کن؛ اکشن‌ها هنگام کات‌سین رد شوند، پس از پایان interaction/movement دوباره مجاز باشد. | تست refresh وسط سکانس، clock drift، cutscene lock و phase persistence. |
| **۹ — کاوش پایدار** | state تعامل با hotspot و پیشرفت مشترک را نگه‌داری/همگام کن؛ idempotency و reconnect را بررسی کن. | تست چندنفره، refresh/restart، persistence؛ client نتواند وضعیت ساختگی ثبت کند. |
| **۱۰ — امنیت و یکپارچه‌سازی** | regression کامل API/DB/security، migration order، concurrency و load مناسب؛ triage خطاها را به مالک فایل ارجاع بده. | `npm run typecheck`, `npm run test:tohid`, `npm test`, build/CI سبز؛ release notes/PR کامل. |

## روش تحویل هر موج

1. قبل از شروع، `main`/شاخهٔ کاری را طبق پروتکل همگام کن؛ فقط پوشه‌های مالکیت خودت را تغییر بده.
2. هر برش کوچک را کامیت و پوش کن؛ PR را با اولین خروجی قابل مرور زود باز کن، Draft مجاز است؛ همان PR را مرتب به‌روزرسانی کن.
3. تست محدودهٔ خودت را اجرا و نتیجه/محدودیت را داخل PR بنویس. برای هر Commit/Push/PR طبق `WORKLOG.md` لاگ بساز و موضوع کامیت فارسی باشد.
4. تغییر مشترک را از طریق درخواست review انجام بده؛ روی فایل امیرعلی/علیرضا مستقیم کار نکن.
5. پس از Merge، فقط feature branch تکمیل‌شده را حذف کن. هرگز `main`، شاخهٔ فعال/ادغام‌نشده یا شاخهٔ قفل‌شدهٔ Arena را حذف/rename نکن.

## توقف‌ها

- Wave 1 فقط ممیزی است؛ کد در آن ممنوع.
- اگر دادهٔ transform لازم نیست، API حرکتی نساز.
- تغییر schema بدون migration/test/backup plan و تأیید مجاز نیست.
- عملیات Supabase/Vercel فقط با لاگ `Pending` و اختیار صریح ایجنت زیرساخت.
