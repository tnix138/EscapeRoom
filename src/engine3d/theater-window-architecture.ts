'use client';

/**
 * theater-window-architecture.ts — نیم‌ستون‌ها و سایبانِ سنگیِ سه پنجرهٔ سردر (امیر)
 * ---------------------------------------------------------------------------
 * خواستهٔ بازبینی: «کنار هر پنجره دو نیم‌ستون از دیوار بیرون زده باشد و از پایین
 * تا بالای پنجره بیاید، و بالای پنجره یک سنگِ افقی روی همان دو ستون بنشیند و
 * برای پنجره نقشِ سایه‌بان داشته باشد.»
 *
 * چرا این ماژول جدا شد؟ سه پنجرهٔ سردر پیش‌تر فقط یک قابِ برنجی و شیشهٔ سرخ
 * داشتند و هر تزئینِ معمارانه‌ای که اضافه می‌شد، باید هم‌زمان با سه چیز جور
 * می‌افتاد: لبهٔ قابِ برنجی، ارتفاعِ پردهٔ مخمل و ستون‌های بزرگِ آزادِ ورودی.
 * این‌جا همهٔ آن اندازه‌ها یک‌جا و در یک قرارداد (`WINDOW_ARCHITECTURE`) نوشته
 * شده‌اند تا سازندهٔ کوچه (`alley-geometry.ts`) و تست‌ها از یک منبع بخوانند.
 *
 * سه نکتهٔ هندسی که رعایت شده:
 *  ۱. نیم‌ستون‌ها **نیم‌استوانهٔ** واقعی‌اند (`thetaStart = -π/2`، `thetaLength = π`)،
 *     پس صفحهٔ تختشان روی دیوار می‌نشیند و برجستگی‌شان از دیوار بیرون می‌زند.
 *     با `scale` در راستای z عمقِ بیرون‌زدگی از شعاع بیشتر می‌شود، بدون آن‌که
 *     ستون کلفت و بی‌تناسب شود.
 *  ۲. باریکهٔ سه پنجره تنگ است: دو ستونِ آزادِ ورودی (±۲٫۵۵ و ±۵٫۲) و
 *     سرستون‌های برنجی‌شان تا نزدیکی قابِ پنجره‌های کناری می‌آیند. پس محورِ
 *     نیم‌ستون روی `۰٫۸۴` است: لبۀ داخلی‌اش (`۰٫۷۵`) از لبهٔ شیشۀ سرخ
 *     (`۰٫۷۴`) بیرون‌تر می‌ماند و لبۀ بیرونی‌اش (`۰٫۹۳`) سه سانتی‌متر از
 *     نیم‌عرض قاب بیرون می‌زند — یعنی ستون واقعاً کنارِ پنجره است، نه روی
 *     شیشه، و به ستون‌های آزاد هم نمی‌رسد.
 *  ۳. مثل هر نیم‌ستونِ واقعی، از صفحۀ جلویِ قابِ برنجی بیرون می‌زند (نه از
 *     پشتِ آن): پنلِ سرخِ پنجره ۱۹ سانتی‌متر از دیوار جلوتر است، پس نیم‌ستونی
 *     که روی خودِ دیوار نصب شود پشتِ آن پنل گم می‌شود. `mountZ` همان صفحۀ
 *     جلوی قاب است و همهٔ مِش‌ها از آن به سمتِ کوچه ساخته می‌شوند.
 *  ۴. سایبان یک سانتی‌متر بالاتر از لبهٔ قاب می‌نشیند و کفِ آن دقیقاً روی سرِ
 *     نیم‌ستون‌ها است؛ هیچ دو صفحه‌ای هم‌سطح (coplanar) نیست، وگرنه زیرِ نورِ
 *     کوچه «نقطه‌های چشمک‌زن» z-fighting می‌ساخت. لبۀ «چکه»ٔ سایبان فقط در
 *     راستای عمق جلو می‌آید (نه در پهنا)، وگرنه گوشه‌اش به سرستون‌های برنجیِ
 *     ستون‌های آزاد می‌خورد.
 */

import * as THREE from 'three';
import { withUv2 } from './alley-materials';

export const WINDOW_ARCHITECTURE = {
  /** مرکز عمودیِ پنجره‌های طبقهٔ دوم سردر (همان y قابِ برنجی) */
  centerY: 7.25,
  /** پهنای قابِ برنجی: نیم‌ستون‌ها و سایبان با همین عدد تراز می‌شوند */
  frameWidth: 1.76,
  frameHeight: 3.14,
  /** ضخامتِ قابِ برنجی (نیم‌ستون‌ها روی صفحۀ جلوی همین قاب نصب می‌شوند) */
  frameDepth: 0.12,

  /** فاصلهٔ محورِ نیم‌ستون از محورِ پنجره. این نما تنگ است: هر پنجره دقیقاً
      بین دو ستونِ آزادِ ورودی نشسته و سرستونِ برنجیِ آن‌ها (نیم‌عرض ۰٫۴۶) تا
      `۰٫۸۴` به محورِ پنجره نزدیک می‌شود، پس کلِ این معمارى باید داخلِ همین
      `۰٫۸۳` بماند، وگرنه سنگِ سایبان در فلزِ سرستون فرو می‌رود.
      لبۀ داخلی `۰٫۶۹` هم پنج میلی‌متر از لبۀ پردهٔ مخمل (۰٫۶۸) بیرون‌تر است. */
  pilasterOffset: 0.76,
  /** نصفِ قطرِ نیم‌ستون؛ سرِ ستون کمی باریک‌تر = تناسبِ کلاسیک */
  radiusTop: 0.064,
  radiusBottom: 0.07,
  /** عمقِ بیرون‌زدگیِ نیم‌ستون از صفحۀ نصب (`mountZ` = جلوی قابِ برنجی). با
      این عدد، جلوی ستون ۲۰ سانتی‌متر جلوتر از قاب و ۱۴ سانتی‌متر جلوتر از
      پردهٔ مخمل است ⇒ برجستگی‌اش زیرِ نورِ کوچه سایه می‌سازد */
  protrusion: 0.2,
  /** چقدر صفحۀ تختِ نیم‌ستون در دیوار فرو می‌رود؛ حتی صفحۀ پشتی (که هرگز
      دیده نمی‌شود) هم با نمای سنگی هم‌سطح نیست تا هیچ z-fighting نماند */
  shaftEmbed: 0.006,

  /** بلوکِ سنگیِ پایه و سرستون: کف و سقفِ هر نیم‌ستون؛ کامل داخلِ پهنای سایبان */
  impostWidth: 0.13,
  impostHeight: 0.12,
  impostProtrusion: 0.25,
  /** چقدر از بلوکِ پایه در دیوار فرو می‌رود (هیچ صفحه‌ای با نمای سنگی هم‌سطح نشود) */
  impostEmbed: 0.03,

  /** سایبانِ سنگیِ افقی که روی دو نیم‌ستون می‌نشیند (۰٫۸۳ در هر طرف) */
  awningWidth: 1.66,
  awningHeight: 0.12,
  awningDepth: 0.5,
  /** لبۀ «چکه» زیرِ لبۀ جلوی سایبان: فقط به سمتِ کوچه جلو می‌آید تا سایه‌اش
      روی بالای پنجره بیفتد و لبهٔ سایبان ضخیم‌تر دیده شود */
  awningLipHeight: 0.05,
  awningLipDepth: 0.07,
  /** لبۀ چکه ۵ میلی‌متر در تنۀ سایبان فرو می‌رود تا دو صفحهٔ چسبیده هم‌سطح نشوند */
  awningLipEmbed: 0.005,
  /** پشتِ سایبان در دیوار فرو می‌رود تا صفحۀ پشتی‌اش با نمای سنگی هم‌سطح نشود */
  awningEmbed: 0.01,
  /** فاصلهٔ کفِ سایبان از لبهٔ بالای قاب (۱ سانتی‌متر) تا هم‌سطحیِ صفحه‌ها رخ ندهد */
  awningGap: 0.01,

  /** تعداد ضلع‌های نیم‌استوانه (۱۴ برای این شعاع، لبهٔ نرم و بی‌چندضلعی) */
  segments: 14,
} as const;

/** کف و سقفِ پنجره (از مرکز و ارتفاعِ قاب حساب می‌شوند تا یک منبع داشته باشند) */
export const WINDOW_BOTTOM_Y = WINDOW_ARCHITECTURE.centerY - WINDOW_ARCHITECTURE.frameHeight / 2;
export const WINDOW_TOP_Y = WINDOW_ARCHITECTURE.centerY + WINDOW_ARCHITECTURE.frameHeight / 2;

export interface TheaterWindowArchitectureInput {
  /** شمارهٔ پنجره (۰ تا ۲) — در نامِ گره‌ها می‌آید */
  index: number;
  /** محورِ افقیِ پنجره روی نما */
  x: number;
  /** z صفحه‌ای که نیم‌ستون‌ها رویش نصب می‌شوند (جلوی قابِ برنجی) */
  mountZ: number;
  /** متریالِ سنگِ نما برای بدنهٔ نیم‌ستون‌ها */
  shaftMaterial: THREE.Material;
  /** متریالِ سنگ‌تراشِ روشن‌تر برای پایه، سرستون و سایبان */
  trimMaterial: THREE.Material;
}

/**
 * گروهِ معمارانۀ یک پنجره: دو نیم‌ستون (پایه + بدنه + سرستون) و سایبانِ سنگی.
 * همهٔ اندازه‌ها از `WINDOW_ARCHITECTURE` می‌آیند تا سه پنجره دقیقاً هم‌اندازه
 * باشند و تست‌ها بتوانند همان قرارداد را بخوانند.
 */
export function buildTheaterWindowArchitecture(
  input: TheaterWindowArchitectureInput,
): THREE.Group {
  const A = WINDOW_ARCHITECTURE;
  const group = new THREE.Group();
  group.name = `TheaterWindowArchitecture_${input.index}`;
  group.userData = { windowIndex: input.index, windowX: input.x };

  const shaftBottom = WINDOW_BOTTOM_Y + A.impostHeight;
  const shaftTop = WINDOW_TOP_Y - A.impostHeight;
  const shaftHeight = shaftTop - shaftBottom;
  // میانگینِ شعاع ⇒ ضریبِ کششِ z طوری است که بیرون‌زدگیِ واقعی همان
  // `protrusion` باشد و ستون از دیوار بیشتر از قاب بیرون بزند
  const meanRadius = (A.radiusTop + A.radiusBottom) / 2;
  const depthScale = A.protrusion / meanRadius;
  const impostDepth = A.impostProtrusion + A.impostEmbed;

  for (const side of [-1, 1] as const) {
    const px = input.x + side * A.pilasterOffset;
    const suffix = side < 0 ? 'L' : 'R';

    // نیم‌استوانه: صفحهٔ تخت روی دیوار (z = ۰ محلی) و برجستگی به سمتِ +z
    const shaftGeo = new THREE.CylinderGeometry(
      A.radiusTop,
      A.radiusBottom,
      shaftHeight,
      A.segments,
      1,
      true,
      -Math.PI / 2,
      Math.PI,
    );
    shaftGeo.scale(1, 1, depthScale);
    shaftGeo.computeVertexNormals();
    withUv2(shaftGeo);

    const shaft = new THREE.Mesh(shaftGeo, input.shaftMaterial);
    shaft.name = `TheaterWindowPilaster_${input.index}_${suffix}`;
    shaft.position.set(px, (shaftBottom + shaftTop) / 2, input.mountZ - A.shaftEmbed);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    group.add(shaft);

    // بلوکِ سنگیِ پایه و سرستون؛ پشتشان ۳ سانتی‌متر در دیوار فرو می‌رود
    for (const [kind, y] of [
      ['Base', WINDOW_BOTTOM_Y + A.impostHeight / 2],
      ['Capital', WINDOW_TOP_Y - A.impostHeight / 2],
    ] as const) {
      const impost = new THREE.Mesh(
        withUv2(new THREE.BoxGeometry(A.impostWidth, A.impostHeight, impostDepth)),
        input.trimMaterial,
      );
      impost.name = `TheaterWindowPilaster${kind}_${input.index}_${suffix}`;
      impost.position.set(px, y, input.mountZ - A.impostEmbed + impostDepth / 2);
      impost.castShadow = true;
      impost.receiveShadow = true;
      group.add(impost);
    }
  }

  // ---------------------------------------------------------------- سایبان
  // کفِ سایبان روی سرِ نیم‌ستون‌ها (بالای قاب) می‌نشیند و تا ۵۸ سانتی‌متر از
  // دیوار بیرون می‌آید، پس هم روی پرده سایه می‌اندازد و هم از قاب جلوتر است
  const awningBottom = WINDOW_TOP_Y + A.awningGap;

  const awning = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(A.awningWidth, A.awningHeight, A.awningDepth)),
    input.trimMaterial,
  );
  awning.name = `TheaterWindowAwning_${input.index}`;
  awning.position.set(
    input.x,
    awningBottom + A.awningHeight / 2,
    input.mountZ - A.awningEmbed + A.awningDepth / 2,
  );
  awning.castShadow = true;
  awning.receiveShadow = true;
  group.add(awning);

  // لبۀ «چکه»: هم‌پهنا با سایبان (هیچ بیرون‌زدگیِ افقی ندارد تا به سرستون‌های
  // برنجیِ ستون‌های آزاد نخورد) و فقط ۷ سانتی‌متر جلوتر، زیرِ لبۀ جلویی
  const lip = new THREE.Mesh(
    withUv2(new THREE.BoxGeometry(A.awningWidth, A.awningLipHeight, A.awningLipDepth)),
    input.trimMaterial,
  );
  lip.name = `TheaterWindowAwningLip_${input.index}`;
  lip.position.set(
    input.x,
    awningBottom + (A.awningHeight - A.awningLipHeight) / 2,
    input.mountZ - A.awningEmbed + A.awningDepth - A.awningLipEmbed + A.awningLipDepth / 2,
  );
  lip.castShadow = true;
  lip.receiveShadow = true;
  group.add(lip);

  return group;
}
