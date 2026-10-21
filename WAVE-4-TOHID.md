---
agent: Tohid
wave: 4
status: IMPLEMENTED_PENDING_REVIEW
intended_audience: coding_agents_only
---

# Tohid — موج ۴: state صحنهٔ کوچه و بازگشت پس از refresh

## تصمیم مرزی

- صحنهٔ قابل‌بازی فعلی با `ClientRoomView.phase` تعیین می‌شود؛ مقدارهای موجود چهار حالت پایدار `alley_puzzle`، `door_cutscene`، `theater_cutscene` و `in_theater` را پوشش می‌دهند. `roomCode`، `me.playerId` و `me.seatIndex` برای هویت/اسپاون اولیه کافی‌اند.
- فاز، `cutsceneStartedAt` و `restartedInTheaterAt` در state پایدار اتاق ذخیره می‌شوند. فازهای cutscene بر پایه ساعت سرور با خواندن مجدد پیش می‌روند.
- کد 3D علیرضا موقعیت renderer را جدا از سرور، در localStorage همین مرورگر و با کلید اتاق/بازیکن ذخیره می‌کند؛ بارگذاری آن bounds را اعتبارسنجی می‌کند و در نبود داده به spawn قطعی صندلی برمی‌گردد.
- این دو لایه را با `sceneId` دوم یا world position سروری تکراری نمی‌کنیم. همچنان هیچ قرارداد مشترک، endpoint، migration، مختصات صحنه یا renderer detail به سرور اضافه نمی‌شود.

## تحویل این موج

`tests/tohid/scene-state-refresh.test.ts` مسیر واقعی API/service را تا بازشدن در پیش می‌برد، SQLite را بین refreshها می‌بندد/دوباره باز می‌کند و بازیابی projection را در `alley_puzzle`، `door_cutscene`، `theater_cutscene` و `in_theater` بررسی می‌کند. آزمون همچنین ثابت می‌کند scene/transform renderer وارد state ماندگار سرور نشده است.

## اعتبارسنجی

- `npm run typecheck` — موفق.
- `npm test` — ۱۸ فایل، ۱۵۸ تست موفق.
- `npm run build` — موفق؛ ۱۴ مسیر.
- `npm run worklog:check` و `git diff --check` — موفق.

## محدودیت

localStorage فقط همان مرورگر/دستگاه را پوشش می‌دهد. بازیابی مختصات دقیق روی دستگاه دیگر همچنان خارج از نیاز/قرارداد تأییدشده است و اگر لازم شد باید جداگانه با مالکان توافق شود.
