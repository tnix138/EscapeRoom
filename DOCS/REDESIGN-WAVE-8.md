---
document_type: implementation_record
status: implemented_pending_owner_review
wave: 8
owner: امیرعلی
intended_audience: coding_agents_only
human_reading: not_required
---

# موج ۸ — زیرنویس و روایت

**دامنه:** `src/components/hud/narration/{narration-track,audio-preferences,movement-notice}.ts`
(جدید)، `src/components/hud/NarrationLayer.tsx` (جدید)،
`src/components/hud/MovementNotice.tsx` (جدید)،
`src/components/invitation/InvitationCardVideo.tsx`، دو پوستهٔ کوچهٔ تحت مالکیت امیرعلی،
`src/app/globals.css` و `tests/amirali/narration-wave8.test.ts` (جدید).

**خارج از دامنه:** `src/components/cinema/**`، `src/components/auditorium/**`،
`src/app/room/**` و `src/app/preview/**` — مالکیت علیرضا. هیچ فایل او تغییر نکرد.

## مسئله

- پیش‌درآمد دعوت‌نامه موسیقی داشت ولی هیچ متن زمان‌بندی‌شده‌ای که برای صفحه‌خوان
  اعلام شود نداشت؛ متن صحنه تغییر می‌کرد بی‌آنکه کسی متوجه شود.
- بلندی صدا قابل تنظیم نبود (gain ثابت `۰.۰۱۸`) و هیچ میان‌بر صفحه‌کلیدی برای صدا یا
  زیرنویس وجود نداشت.
- در کوچه معلوم نبود چرا حرکت قطع شده است (مودال/پنل باز یا ماوس قفل) و بازگشت حرکت
  هم اعلام نمی‌شد.

## راه‌حل

### ۱) خط روایت خالص — `narration-track.ts`
- `INVITATION_CUES` (۰ تا ۱۶ ثانیه، سه کات) و `CUTSCENE_CUES` (۰ تا ۷۴ ثانیه، ۱۸ کات
  شامل ۴ کات دربان و ۱۴ کات سالن).
- هر کات `{id, startMs, endMs, chapter, speaker, text}` دارد؛ بازه‌ها **بدون شکاف و
  بدون هم‌پوشانی** کل صحنه را می‌پوشانند.
- مرزهای مهم با ثابت‌های علیرضا هم‌ترازند: `DOOR_CUTSCENE_DURATION_MS` (۱۱s)،
  `HAND_REJECTION_AT_MS` (۴۹.۶s)، `CHANDELIER_FALL_AT_MS` (۶۵.۵s)، غیب شدن (۶۷s) و
  `TOTAL_CUTSCENE_DURATION_MS` (۷۴s). تست این هم‌ترازی را تضمین می‌کند.
- `cueAt(track, ms)` کات فعال را می‌دهد (بیرون از بازه `null`)، `inspectTrack` شکاف/
  هم‌پوشانی/کلیدواژهٔ ممنوعه را بازرسی می‌کند، `phaseNotice` اعلان شروع/پایان
  (۵ ثانیهٔ اول و ۶ ثانیهٔ آخر) می‌سازد.
- در متن‌ها **هیچ پاسخ معمایی** نیست؛ تست الگوهای `\d{3,}`، «رمز»، «پاسخ» را رد می‌کند.

### ۲) مدل صدا — `audio-preferences.ts`
- `clampVolume` / `stepVolume` (پله‌های ۱۰٪) / `volumePercentLabel` با ارقام فارسی.
- `toggleMute` حجم قبلی را حفظ می‌کند و در حالت صفر به `DEFAULT_VOLUME` برمی‌گردد.
- `resolveAudioShortcut`: `M` = بی‌صدا/باصدا، `C` = زیرنویس، `↑/↓` = بلندی صدا؛
  با Ctrl/Alt/Meta یا وقتی فوکوس روی `input/textarea/select/contenteditable` است
  هیچ کلیدی گرفته نمی‌شود. حروف فارسی «م/ث» هم پذیرفته می‌شوند.
- `parse/serialize/read/writePreferences` نسخه‌دار (`v: 1`) و مقاوم به JSON خراب،
  نسخهٔ ناشناس و storage مسدود.

### ۳) لایهٔ روایت — `NarrationLayer`
- زیرنویس در `<p role="status" aria-live="polite" aria-atomic="true">` با فصل، متن و
  ساعت `m:ss` فارسی؛ فقط با تغییر کات متن عوض می‌شود.
- دکمهٔ «زیرنویس» (`aria-pressed`) + `C`، دکمهٔ صدا (`aria-pressed`) + `M` و اسلایدر
  بلندی صدا با `aria-valuetext` فارسی. همهٔ اهداف لمسی ۴۴px.
- اعلان وضعیت صدا/زیرنویس در ناحیهٔ زندهٔ جداگانه (`aria-live`) تا با متن روایت قاطی نشود.
- `showPhaseNotices` اعلان شروع/پایان صحنه را نشان می‌دهد؛ `variant="compact"` برای
  صحنه‌های سه‌بعدی.
- ترجیحات (زیرنویس/صدا/بلندی) در `localStorage` با کلید `orfeo:av-prefs` ذخیره می‌شود و
  فقط بعد از mount خوانده می‌شود (بدون hydration mismatch).
- بدون `fetch`/`EventSource`؛ هیچ اتصال دومی به سرور ساخته نمی‌شود.

### ۴) اعلان حرکت — `MovementNotice` + `movement-notice.ts`
- `resolveMovementMode` اولویت را روشن می‌کند: کات‌سین ← مودال ← ماوس قفل ← آزاد.
- حالت‌ها: «حرکت قفل شد» (با راهنمای Esc)، «حرکت در دسترس نیست» (کات‌سین)،
  «ماوس قفل شده» (راهنمای Esc) و «حرکت آزاد شد» که ۳.۲ ثانیه پس از رهاسازی محو می‌شود.
- در هر دو پوستهٔ کوچه نصب شد: نسخهٔ کلاسیک با `doorOpen || openClue` و نسخهٔ
  سه‌بعدی با `doorModalOpen || showPlaybill || showRowChart` و `isPointerLocked`.

### ۵) اتصال به دعوت‌نامه
- `InvitationCardVideo` حالا `NarrationLayer` را با `INVITATION_CUES`،
  `muted={!musicOn}` و `onToggleMute`/`onVolumeChange` رندر می‌کند.
- بلندی صدا روی gain موتور صوتی اعمال می‌شود (`۰.۰۱۸ × volume`)، بدون ساخت دوبارهٔ
  اسیلاتورها؛ مقدار در مرورگر ذخیره می‌شود.
- اگر کاربر در حالت بی‌صدا صدا را بالا ببرد، همان حرکت کاربر صدا را هم باز می‌کند.

### ۶) آمادهٔ کات‌سین (تحویل یک‌خطی)
`NarrationLayer` پیش‌فرض‌های کات‌سین را دارد؛ نصب در `FirstPersonCutsceneStage`
(مالکیت علیرضا) فقط این خط است:

```tsx
<NarrationLayer elapsedMs={clampedElapsed} muted={muted} onToggleMute={onToggleMute} showPhaseNotices />
```

تا هماهنگی مالک، فایل او دست‌نخورده مانده است (همان قاعدهٔ موج ۷).

## تست‌ها

`tests/amirali/narration-wave8.test.ts` — ۲۶ تست:
پوشش کامل ۷۴ ثانیه (نمونه‌برداری هر ثانیه = دقیقاً یک کات)، تطابق مرزها با ثابت‌های
`cutscene-timing`، نبود شکاف/هم‌پوشانی/پاسخ در متن‌ها، `cueAt` و `formatClock`،
اعلان شروع/پایان، همهٔ توابع صدا (clamp/step/percent/mute/keyboard/storage)،
اعلان‌های حرکت و گاردهای markup/CSS.

`npm run typecheck` ✅ · `npm run test:amirali` ۱۱۶ تست ✅ · `npm test` ۲۶۷ تست ✅ ·
`npm run build` ۱۴ مسیر ✅

## باقی‌مانده

- نصب یک‌خطی لایه در صحنهٔ کات‌سین و سالن توسط مالک سینما؛ پس از آن زیرنویس کات‌سین
  به‌صورت خودکار از همان خط ۷۴ ثانیه‌ای تغذیه می‌شود.
- بازبینی نهایی ۳۲۰px/زوم ۲۰۰٪ در موج ۱۰.
