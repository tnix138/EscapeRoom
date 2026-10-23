'use client';

/**
 * theater-chandelier.ts — لوسترِ هشت‌شاخهٔ کریستالیِ سالن سینما (امیر)
 * ---------------------------------------------------------------------------
 * خواستهٔ بازبینی: «داخل سینما یه لوستر هست؛ قسمتِ شاخه برای لامپ‌هاش رو درست
 * کن: هشت شاخه، روی هر شاخه دو لامپ — یکی وسطِ شاخه و یکی سرِ شاخه — و زیرِ
 * هر شاخه هم یک تیکه کریستالِ عمودی.»
 *
 * پیش‌تر این «لوستر» فقط یک زنجیر، یک هشت‌وجهیِ بزرگِ شناور و یک نورِ نقطه‌ای
 * بود؛ یعنی هیچ شاخه‌ای نداشت. این‌جا:
 *   ۱. `arms = ۸` شاخهٔ برنجیِ منحنی از گلوییِ مرکزی بیرون می‌زند (هر ۴۵ درجه)
 *   ۲. روی هر شاخه **دو** چراغِ شمعی: یکی در `lampMidT` (وسط) و یکی در نوکِ
 *      شاخه؛ هر چراغ بوبِش، جام، شمعِ عاجی و گویِ نورانیِ خودش را دارد
 *   ۳. **زیرِ هر شاخه** یک آویزِ کریستالِ عمودی: سیمِ نازک + یک بلورِ کشیدهٔ
 *      هشت‌وجهی (مقطعِ باریک، ارتفاعِ بلند ⇒ «تیکه کریستالِ عمودی»)
 *   ۴. زیرِ گلویی هم یک آبشارِ کریستالِ مرکزی نشسته تا مرکزِ لوستر خالی نماند
 *
 * چرا فقط دو نورِ واقعی؟ شانزده چراغِ شمعی هر کدام یک `PointLight` بشوند،
 * بودجهٔ نورِ WebGL را می‌سوزانند و روی موبایل افتِ فریم می‌دهند. پس همهٔ
 * گوی‌ها `emissive` هستند (خودشان می‌درخشند) و فقط دو `PointLight` گرم روشناییِ
 * سالن را تأمین می‌کنند — همان کاری که در چراغ‌های کوچه هم شده است.
 *
 * همهٔ نام‌ها شماره‌دار و قطعی‌اند (`ChandelierArm_0..7`،
 * `ChandelierLampMidBulb_3`، `ChandelierCrystal_5` و …) تا تست بتواند ساختار
 * را بشمارد. هندسه/متریال‌ها بین شاخه‌ها مشترک‌اند و آزادسازی با پیمایشِ خودِ
 * گروه در `theater-geometry.dispose()` انجام می‌شود (Set، بدون آزادسازیِ تکراری).
 */

import * as THREE from 'three';

export const THEATER_CHANDELIER = {
  /** شمارِ شاخه‌ها (خواستۀ امیر: هشت شاخه) */
  arms: 8,
  /** روی هر شاخه دو چراغ: وسط و نوک */
  lampsPerArm: 2,
  /** سقفِ سالن؛ زنجیر از همین‌جا آویزان است */
  ceilingY: 6,
  /** گلوییِ مرکزی (هاب) که شاخه‌ها از آن بیرون می‌زنند */
  hubY: 3.5,
  hubRadius: 0.17,
  /** شعاعِ افقیِ نوکِ شاخه و ارتفاعِ نوک (شاخه کمی رو به بالا می‌پیچد) */
  armReach: 1.26,
  armTipY: 3.8,
  /** قطرِ لولهٔ شاخه */
  armThickness: 0.042,
  /** جای چراغِ میانی روی منحنیِ شاخه (۰ = گلویی، ۱ = نوک) */
  lampMidT: 0.56,
  /** جای آویزِ کریستال روی شاخه — بینِ دو چراغ، زیرِ خودِ شاخه */
  crystalT: 0.62,
  /** سیمِ آویز و اندازۀ بلورِ عمودی (متر) */
  crystalWire: 0.09,
  crystalLength: 0.34,
  crystalWidth: 0.095,
  /** آبشارِ کریستالِ مرکزی زیرِ گلویی */
  centerCrystalLength: 0.44,
  centerCrystalWidth: 0.13,
  /** چراغِ شمعی: جام، شمع و گوی */
  bobecheRadius: 0.085,
  candleHeight: 0.16,
  bulbRadius: 0.062,
  /** رنگ‌ها */
  brassColor: 0xc9a86a,
  candleColor: 0xf2e6cf,
  bulbColor: 0xfff2d2,
  bulbEmissive: 0xffd9a0,
  crystalColor: 0xeaf6ff,
} as const;

/** چند ضلعی‌سازی — ثابت تا ظاهرِ لوستر بین دستگاه‌ها یکی باشد */
const TUBE_SEGMENTS = 20;
const TUBE_RADIAL = 8;
const CRYSTAL_DETAIL = 0;

/**
 * چراغِ شمعیِ روی شاخه: بوبِشِ برنجی (تشتی زیرِ شمع)، جام، شمعِ عاجی و گویِ
 * نورانی. مبدأ گروه **کفِ بوبِش** است تا روی نقطهٔ منحنیِ شاخه بنشیند.
 */
function createCandleLamp(
  id: string,
  materials: { brass: THREE.Material; candle: THREE.Material; bulb: THREE.Material },
): THREE.Group {
  const C = THEATER_CHANDELIER;
  const lamp = new THREE.Group();
  lamp.name = `ChandelierLamp${id}`;

  const bobeche = new THREE.Mesh(
    new THREE.CylinderGeometry(C.bobecheRadius, C.bobecheRadius * 0.62, 0.026, 14),
    materials.brass,
  );
  bobeche.name = `ChandelierBobeche${id}`;
  bobeche.position.y = 0.013;
  lamp.add(bobeche);

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.055, 0.05, 12),
    materials.brass,
  );
  cup.name = `ChandelierCup${id}`;
  cup.position.y = 0.045;
  lamp.add(cup);

  const candle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, C.candleHeight, 12),
    materials.candle,
  );
  candle.name = `ChandelierCandle${id}`;
  candle.position.y = 0.07 + C.candleHeight / 2;
  lamp.add(candle);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(C.bulbRadius, 16, 12),
    materials.bulb,
  );
  bulb.name = `ChandelierLamp${id}Bulb`;
  bulb.position.y = 0.07 + C.candleHeight + C.bulbRadius * 0.75;
  lamp.add(bulb);

  return lamp;
}

/**
 * آویزِ کریستالِ عمودی: سیمِ نازکِ برنجی از زیرِ شاخه و یک بلورِ کشیده.
 * مبدأ گروه نقطهٔ اتصال روی شاخه است؛ محتوایِ آویز به سمتِ پایین می‌رود.
 */
function createCrystalDrop(
  id: string,
  materials: { brass: THREE.Material; crystal: THREE.Material },
): THREE.Group {
  const C = THEATER_CHANDELIER;
  const drop = new THREE.Group();
  drop.name = `ChandelierCrystalDrop${id}`;

  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, C.crystalWire, 6),
    materials.brass,
  );
  wire.name = `ChandelierCrystalWire${id}`;
  wire.position.y = -C.crystalWire / 2;
  drop.add(wire);

  // هشت‌وجهیِ کشیده: نصفِ ارتفاع در راستای y و مقطعِ باریک در x/z ⇒
  // یک بلورِ عمودیِ آبشاری، نه یک گویِ گرد
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1, CRYSTAL_DETAIL),
    materials.crystal,
  );
  crystal.name = `ChandelierCrystal${id}`;
  crystal.scale.set(C.crystalWidth, C.crystalLength / 2, C.crystalWidth);
  crystal.position.y = -C.crystalWire - C.crystalLength / 2;
  drop.add(crystal);

  // مهرهٔ کوچکِ برنجیِ ته آویز تا بلور «آویزان» دیده شود، نه چسبیده به هوا
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), materials.brass);
  finial.name = `ChandelierCrystalFinial${id}`;
  finial.position.y = -C.crystalWire - C.crystalLength - 0.012;
  drop.add(finial);

  return drop;
}

export interface TheaterChandelier {
  readonly group: THREE.Group;
  /** ۸ گروهِ شاخه — هر کدام دو چراغ و یک آویزِ کریستال دارد */
  readonly arms: THREE.Group[];
  /** شمارِ کلِ چراغ‌ها (باید arms × lampsPerArm باشد) */
  readonly lampCount: number;
  /** نورهای واقعیِ لوستر (نه گوی‌های emissive) */
  readonly lights: THREE.PointLight[];
}

/**
 * ساختِ کاملِ لوستر: زنجیر، میلهٔ مرکزی، گلویی، هشت شاخه با دو چراغ و آویزِ
 * کریستال، آبشارِ کریستالِ مرکزی و دو نورِ گرم.
 *
 * مبدأ گروه، مرکزِ گلویی در `y = 0` نیست: کلِ لوستر حولِ محورِ y ساخته می‌شود
 * و `position` آن در صحنه صفر است (همان قراردادِ قبلی)، پس مرکزِ گلویی روی
 * `hubY = 3.5` می‌نشیند و زنجیر تا سقف (۶ متر) می‌رسد.
 */
export function buildTheaterChandelier(): TheaterChandelier {
  const C = THEATER_CHANDELIER;
  const group = new THREE.Group();
  group.name = 'Chandelier';

  const brass = new THREE.MeshStandardMaterial({
    color: C.brassColor,
    metalness: 0.82,
    roughness: 0.26,
  });
  brass.name = 'ChandelierBrass';
  const candleMat = new THREE.MeshStandardMaterial({
    color: C.candleColor,
    roughness: 0.68,
    metalness: 0.02,
  });
  candleMat.name = 'ChandelierCandleWax';
  const bulbMat = new THREE.MeshStandardMaterial({
    color: C.bulbColor,
    emissive: new THREE.Color(C.bulbEmissive),
    emissiveIntensity: 1.7,
    roughness: 0.3,
    metalness: 0,
  });
  bulbMat.name = 'ChandelierBulb';
  const crystalMat = new THREE.MeshStandardMaterial({
    color: C.crystalColor,
    emissive: new THREE.Color(0x5d7fa8),
    emissiveIntensity: 0.55,
    roughness: 0.06,
    metalness: 0.12,
    transparent: true,
    opacity: 0.82,
  });
  crystalMat.name = 'ChandelierCrystal';
  const materials = { brass, candle: candleMat, bulb: bulbMat, crystal: crystalMat };

  // ------------------------------------------------------------------ زنجیر
  const chainTop = C.ceilingY - 0.05;
  const chainHeight = chainTop - (C.hubY + 0.55);
  const chain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, chainHeight, 8),
    brass,
  );
  chain.name = 'ChandelierChain';
  chain.position.y = (chainTop + C.hubY + 0.55) / 2;
  group.add(chain);

  // ------------------------------------------------------------------- میله
  // از زیرِ زنجیر تا گلویی: بدنهٔ اصلیِ لوستر
  const stemHeight = 0.55;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.075, stemHeight, 12),
    brass,
  );
  stem.name = 'ChandelierStem';
  stem.position.y = C.hubY + stemHeight / 2 + 0.02;
  group.add(stem);

  // گلویی: حلقهٔ برنجی که شاخه‌ها از آن بیرون می‌زنند + مهرهٔ تزئینیِ بالای آن
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(C.hubRadius, C.hubRadius * 0.82, 0.2, 16),
    brass,
  );
  hub.name = 'ChandelierHub';
  hub.position.y = C.hubY;
  group.add(hub);

  const hubCollar = new THREE.Mesh(new THREE.TorusGeometry(C.hubRadius, 0.022, 8, 20), brass);
  hubCollar.name = 'ChandelierHubCollar';
  hubCollar.rotation.x = Math.PI / 2;
  hubCollar.position.y = C.hubY + 0.11;
  group.add(hubCollar);

  // ------------------------------------------------------- هشت شاخه و چراغ‌ها
  const arms: THREE.Group[] = [];
  let lampCount = 0;

  for (let i = 0; i < C.arms; i++) {
    const angle = (i / C.arms) * Math.PI * 2;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);

    const arm = new THREE.Group();
    arm.name = `ChandelierArm_${i}`;
    arm.userData.index = i;
    arm.userData.angle = angle;

    // منحنیِ شاخه: از گلویی بیرون، کمی پایین، بعد رو به بالا تا نوک
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dirX * 0.09, C.hubY + 0.02, dirZ * 0.09),
      new THREE.Vector3(dirX * 0.42, C.hubY - 0.17, dirZ * 0.42),
      new THREE.Vector3(dirX * 0.92, C.hubY - 0.04, dirZ * 0.92),
      new THREE.Vector3(dirX * C.armReach, C.armTipY, dirZ * C.armReach),
    ]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, TUBE_SEGMENTS, C.armThickness, TUBE_RADIAL, false),
      brass,
    );
    tube.name = `ChandelierArmTube_${i}`;
    arm.add(tube);

    // مهرهٔ محلِ اتصالِ شاخه به گلویی
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), brass);
    knuckle.name = `ChandelierArmKnuckle_${i}`;
    knuckle.position.copy(curve.getPointAt(0));
    arm.add(knuckle);

    // چراغِ وسط و چراغِ نوک — هر دو عمودی، سوار بر نقطهٔ منحنی
    const midT = Math.min(0.95, Math.max(0.05, C.lampMidT));
    for (const [kind, t] of [
      ['Mid', midT],
      ['End', 1],
    ] as const) {
      const point = curve.getPointAt(t);
      const lamp = createCandleLamp(`_${i}_${kind}`, materials);
      lamp.position.copy(point);
      lamp.userData.tAlongArm = t;
      arm.add(lamp);
      lampCount++;
    }

    // آویزِ کریستالِ عمودی، زیرِ شاخه (بین دو چراغ)
    const dropPoint = curve.getPointAt(C.crystalT);
    const drop = createCrystalDrop(`_${i}`, materials);
    drop.position.copy(dropPoint);
    arm.add(drop);

    arms.push(arm);
    group.add(arm);
  }

  // ---------------------------------------------- آبشارِ کریستالِ مرکزی
  // زیرِ گلویی: سیم، بلورِ کشیدهٔ مرکزی و یک مهره؛ جایگزینِ هشت‌وجهیِ بزرگِ
  // قبلی که مثل یک گویِ شناور وسطِ سالن بود
  const centerWire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), brass);
  centerWire.name = 'ChandelierCenterWire';
  centerWire.position.y = C.hubY - 0.19;
  group.add(centerWire);

  const centerCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1, CRYSTAL_DETAIL),
    crystalMat,
  );
  centerCrystal.name = 'ChandelierCenterCrystal';
  centerCrystal.scale.set(C.centerCrystalWidth, C.centerCrystalLength / 2, C.centerCrystalWidth);
  centerCrystal.position.y = C.hubY - 0.28 - C.centerCrystalLength / 2;
  group.add(centerCrystal);

  const centerFinial = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), brass);
  centerFinial.name = 'ChandelierCenterFinial';
  centerFinial.position.y = C.hubY - 0.28 - C.centerCrystalLength - 0.02;
  group.add(centerFinial);

  // -------------------------------------------------------------- نورِ واقعی
  const lights: THREE.PointLight[] = [];
  const coreLight = new THREE.PointLight(0xffe8c0, 1.2, 12);
  coreLight.name = 'ChandelierLight';
  coreLight.position.set(0, C.hubY, 0);
  group.add(coreLight);
  lights.push(coreLight);

  const downLight = new THREE.PointLight(0xffd9a8, 0.7, 10);
  downLight.name = 'ChandelierDownLight';
  downLight.position.set(0, C.hubY - 0.75, 0);
  group.add(downLight);
  lights.push(downLight);

  // نورِ گرمِ شاخه‌ها باید سایه هم بیندازد (بدنه‌ها روی یکدیگر)
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  return { group, arms, lampCount, lights };
}
