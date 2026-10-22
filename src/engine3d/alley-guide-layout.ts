'use client';

/**
 * alley-guide-layout.ts — چیدمان مشترک دو تابلوی راهنمای کوچه (علیرضا)
 * ---------------------------------------------------------------------------
 * دو تابلوِ راهنمای کوچه، «پوستر اعلانات» روی دیوار چپ و «جدول تبدیل ردیف‌ها»
 * در گیشهٔ راست هستند. تا پیش از این، ویترین چپ کاملاً به دیوار چسبیده بود ولی
 * اتاقک گیشهٔ راست حدود ۰٫۶۵ متر جلوتر از دیوار ایستاده بود؛ نتیجه اینکه دو
 * تابلو با دو فاصلهٔ متفاوت از دیوار دیده می‌شدند و سمت راست «شناور» به نظر می‌رسید.
 *
 * این ماژول تنها منبع حقیقت چیدمان است و هیچ وابستگی به Three.js ندارد تا هم
 * `alley-geometry.ts` (ساخت مش) و هم `collision.ts` (جعبهٔ برخورد) و هم تست‌های
 * واحد از یک عدد تغذیه شوند. با تغییر یک ثابت، هر دو تابلو هم‌زمان و هم‌فاصله
 * جابه‌جا می‌شوند و دیگر امکان ناهم‌ترازی وجود ندارد.
 */

/** فاصلهٔ پایهٔ نمای ساختمان‌های دو سوی کوچه از محور مرکزی */
export const ALLEY_FACADE_BASE_X = 8.72;

/** تورفتگی نمای ساختمان میانی چپ (تابلوی اعلانات) و راست (گیشهٔ جدول ردیف‌ها) */
export const ALLEY_GUIDE_WALL_INSET = { left: 0.12, right: -0.04 } as const;

/**
 * نمای داخلی دیوارهایی که دو تابلوی راهنما روی آن‌ها نصب‌اند.
 * چپ: −(۸٫۷۲ + ۰٫۱۲) = −۸٫۸۴ · راست: ۸٫۷۲ − ۰٫۰۴ = ۸٫۶۸
 */
export const ALLEY_GUIDE_WALL_X = {
  left: -(ALLEY_FACADE_BASE_X + ALLEY_GUIDE_WALL_INSET.left),
  right: ALLEY_FACADE_BASE_X + ALLEY_GUIDE_WALL_INSET.right,
} as const;

/**
 * فاصلهٔ یکسانِ سطح هر دو تابلو از دیوار خودشان (متر).
 * پوستر چپ از ابتدا این‌قدر از دیوار فاصله داشت و حالا جدول راست هم دقیقاً
 * همان‌قدر می‌شود: هر دو تابلو با یک فاصلهٔ مساوی به دیوار می‌چسبند.
 */
export const ALLEY_GUIDE_BOARD_WALL_GAP = 0.865;

/** موقعیت افقی سطح هر دو تابلو (پوستر چپ منفی، جدول راست مثبت) */
export const ALLEY_GUIDE_BOARD_SURFACE_X = {
  playbill: ALLEY_GUIDE_WALL_X.left + ALLEY_GUIDE_BOARD_WALL_GAP,
  rowChart: ALLEY_GUIDE_WALL_X.right - ALLEY_GUIDE_BOARD_WALL_GAP,
} as const;

/** فاصلهٔ صفحهٔ پوستر از قاب چوبی‌اش و همان فاصله برای جدول از قاب برنجی‌اش */
export const ALLEY_GUIDE_BOARD_FRAME_CLEARANCE = 0.045;

/**
 * فاصلهٔ افقی صفحهٔ جدول ردیف‌ها از لنگر گیشه؛ اتاقک گیشه با همین عدد جابه‌جا
 * می‌شود تا صفحه دقیقاً روی `ALLEY_GUIDE_BOARD_SURFACE_X.rowChart` بنشیند.
 */
export const ALLEY_ROW_CHART_LOCAL_OFFSET_X = -0.34;

/** فاصلهٔ چراغ مطالعهٔ هر تابلو از سطح آن — یکسان و قرینه برای هر دو سمت */
export const ALLEY_GUIDE_LAMP_DISTANCE = 1.125;

/** موقعیت افقی چراغ‌های مطالعهٔ تابلوها؛ هر دو دقیقاً هم‌فاصله از تابلو خودشان */
export const ALLEY_GUIDE_LAMP_X = {
  playbill: ALLEY_GUIDE_BOARD_SURFACE_X.playbill + ALLEY_GUIDE_LAMP_DISTANCE,
  rowChart: ALLEY_GUIDE_BOARD_SURFACE_X.rowChart - ALLEY_GUIDE_LAMP_DISTANCE,
} as const;

/** جعبهٔ برخورد هر تابلو تا کمی جلوتر از سطح تابلو و کمی عقب‌تر از دیوار امتداد دارد */
export const ALLEY_GUIDE_COLLISION_DEPTH = { beyondSurface: 0.075, behindWall: 0.16 } as const;
