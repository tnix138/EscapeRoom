---
agent: Tohid
wave: 9
status: COMPLETE
intended_audience: coding_agents_only
---

# Tohid — موج ۹: کاوش پایدار سالن تاریک و مصونیت وضعیت داخلی

## دامنه و اصلاحات runtime

- **جداسازی کامل مرجع در `createDarkAuditoriumState` و `projectRoomView` (`src/engine/index.ts`، `src/engine/view-projector.ts`):**
  - پیش‌تر آرایه‌های `inspectedHotspots` به‌صورت مرجع مستقیم از `InternalRoomState` به خروجی `ClientRoomView` داده می‌شدند و اشیای `messages` نیز کپی سطحی نداشتند.
  - اکنون هر چهار آرایهٔ هات‌اسپات (`shattered-chandelier`، `crooked-paintings`، `three-dark-stages`، `locked-exit-doors`) و پیام‌ها به‌صورت مستقل کپی می‌شوند تا هیچ دستکاری روی خروجی projection نتواند وضعیت داخلی سرور را تغییر دهد.
- **اقتدار سرور و ماندگاری کاوش مشترک:**
  - اکشن `INSPECT_AUDITORIUM_HOTSPOT` فقط در فاز `in_theater` و فقط با `seatToken` معتبر پذیرفته می‌شود؛ در فازهای کوچه/کات‌سین با `409` رد می‌شود.
  - نام ثبت‌شده از صندلی احرازشده می‌آید، تکرار بررسی همان هات‌اسپات توسط همان بازیکن idempotent است و همزمانی ۸ بازیکن از طریق حلقه OCC بدون گم‌شدن هیچ ثبتی ماندگار می‌شود.

## پوشش آزمون

- `tests/tohid/persistent-exploration.test.ts`
- `tests/tohid/exploration-immutability-and-chat-security.test.ts` (بررسی همزمان ۸ نفره همهٔ هات‌اسپات‌ها، idempotency، بستن/بازکردن مجدد SQLite و عدم آلودگی وضعیت داخلی در صورت تغییر آرایه خروجی)

## مرز دامنه

مرجع پیشرفت کاوش در سرور است؛ مختصات بازیکنان یا transform رندرر در سرور ذخیره یا همگام نمی‌شود و قرارداد مشترک `src/contracts/**` دست‌نخورده باقی مانده است.

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm run test:tohid` — ۱۴ فایل، ۵۷ تست موفق.
- `npm test` — ۲۷ فایل، ۲۰۴ تست موفق.
- `npm run build` — موفق؛ ۱۵ مسیر.
