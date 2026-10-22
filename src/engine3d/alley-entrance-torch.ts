'use client';

/**
 * alley-entrance-torch.ts — دو چراغ کنار در ورودی تماشاخانه به شکل «مشعل» (علیرضا)
 * ---------------------------------------------------------------------------
 * خواستهٔ بازبینی: چراغ‌های دو طرف در ورودی باید حالت مشعل داشته باشند (پیاله،
 * بازوی نگه‌دارنده و هالهٔ گرم بالای آن) ولی همچنان «چراغ» باشند، نه شعلهٔ واقعی؛
 * و بدنه‌شان **هشت‌ضلعی** باشد.
 *
 * ساختار هر مشعل از پایین به بالا:
 *   ۱. صفحهٔ نصب هشت‌ضلعی روی دیوار + چهار پیچ
 *   ۲. بازوی لوله‌ای هشت‌ضلعی که از دیوار بیرون می‌آید و بالا می‌رود
 *   ۳. پیالهٔ مشعل (برنزی-آهنی، هشت‌ضلعی) با لبهٔ حلقه‌ای هشت‌ضلعی
 *   ۴. فانوس چراغ: شیشهٔ هشت‌ضلعی با هشت تیغهٔ عمودی، گوی نورانی، سرپوش
 *      هشت‌ضلعی و مهرهٔ بالایی
 *
 * پس «مشعل» از نظر حجم و حالت دیده می‌شود، ولی نور آن یک چراغ برقی است: گوی
 * نورانی، هالهٔ گرد و یک PointLight گرم با نفسِ ملایم (نه سوسوزدن آتش).
 */

import * as THREE from 'three';

/** اندازه‌ها و نور مشترک هر دو مشعل — تنها منبع حقیقت برای تست و ساخت */
export const ENTRANCE_TORCH = {
  /** ارتفاع صفحهٔ نصب روی دیوار */
  plateY: 2.34,
  /** ارتفاع مرکز پیالهٔ مشعل */
  cupY: 2.6,
  /** ارتفاع مرکز فانوس هشت‌ضلعی */
  lanternY: 2.84,
  /** ارتفاع شیشهٔ فانوس */
  glassHeight: 0.34,
  /** بیرون‌آمدگی فانوس از نمای دیوار (متر) */
  reach: 0.38,
  /** رنگ نور چراغ */
  color: 0xffb066,
  /** شدت پایهٔ چراغ */
  intensity: 2.2,
  distance: 7,
  decay: 1.8,
  /** ضریب نفس کشیدن ملایم نور (۰ یعنی ثابت) */
  breathe: 0.05,
} as const;

/** تعداد اضلاع بدنهٔ فانوس و پیاله — مشعل باید هشت‌ضلعی باشد */
export const TORCH_SIDES = 8;

export interface EntranceTorchOptions {
  id: string;
  /** موقعیت پایهٔ مشعل؛ محلی نسبت به گروهی که مشعل به آن اضافه می‌شود */
  position: { x: number; y: number; z: number };
  /** جهت بیرون‌آمدن بازو از دیوار: +1 برای دیوار رو به +Z، −1 برای دیوار رو به −Z */
  facing?: 1 | -1;
  seed?: number;
  haloTexture?: THREE.DataTexture;
  environmentMap?: THREE.Texture;
}

export interface EntranceTorchInstance {
  readonly group: THREE.Group;
  readonly light: THREE.PointLight;
  update(elapsedSeconds: number): number;
}

/**
 * نفسِ ملایم نور چراغ (نه سوسوزدن آتش): دو موج کم‌دامنه با فرکانس متفاوت،
 * کاملاً قطعی برای تست واحد.
 */
export function entranceTorchBreathe(elapsedSeconds: number, seed = 0): number {
  if (!Number.isFinite(elapsedSeconds)) return 1;
  const t = Math.max(0, elapsedSeconds);
  const slow = Math.sin(t * 0.9 + seed * 1.7) * 0.6;
  const fast = Math.sin(t * 2.6 + seed * 3.1) * 0.4;
  return 1 + ENTRANCE_TORCH.breathe * (slow + fast);
}

export function createEntranceTorch(options: EntranceTorchOptions): EntranceTorchInstance {
  const { id } = options;
  const facing = options.facing ?? 1;
  const seed = options.seed ?? 0;
  const group = new THREE.Group();
  group.name = `EntranceTorch_${id}`;
  group.position.set(options.position.x, options.position.y, options.position.z);

  // آهن تیره و برنج — همان خانوادهٔ متریال‌های نمای تماشاخانه
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x22262b,
    roughness: 0.52,
    metalness: 0.72,
    envMap: options.environmentMap,
    envMapIntensity: 0.75,
    flatShading: true,
  });
  ironMat.name = `EntranceTorchIron_${id}`;
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc8a258,
    roughness: 0.36,
    metalness: 0.78,
    envMap: options.environmentMap,
    envMapIntensity: 0.9,
    flatShading: true,
  });
  brassMat.name = `EntranceTorchBrass_${id}`;

  const reach = ENTRANCE_TORCH.reach * facing;

  // ۱. صفحهٔ نصب هشت‌ضلعی روی دیوار + چهار پیچ شش‌گوش
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.105, 0.05, TORCH_SIDES),
    ironMat,
  );
  plate.rotation.x = Math.PI / 2;
  plate.position.set(0, ENTRANCE_TORCH.plateY, facing * 0.025);
  plate.name = `TorchWallPlate_${id}`;
  plate.castShadow = true;
  group.add(plate);

  for (let bolt = 0; bolt < 4; bolt++) {
    const angle = (bolt / 4) * Math.PI * 2 + Math.PI / 4;
    const boltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 6), brassMat);
    boltMesh.rotation.x = Math.PI / 2;
    boltMesh.position.set(
      Math.cos(angle) * 0.062,
      ENTRANCE_TORCH.plateY + Math.sin(angle) * 0.062,
      facing * 0.055,
    );
    group.add(boltMesh);
  }

  // ۲. بازوی لوله‌ای هشت‌ضلعی: از دیوار بیرون می‌آید و به سمت پیاله بالا می‌رود
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, ENTRANCE_TORCH.plateY + 0.02, facing * 0.04),
    new THREE.Vector3(0, ENTRANCE_TORCH.plateY + 0.03, facing * 0.16),
    new THREE.Vector3(0, ENTRANCE_TORCH.plateY + 0.1, facing * 0.29),
    new THREE.Vector3(0, ENTRANCE_TORCH.cupY - 0.12, reach),
  ]);
  // radialSegments = ۸ ⇒ خودِ لوله هم هشت‌ضلعی دیده می‌شود
  const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 20, 0.022, TORCH_SIDES, false), ironMat);
  arm.name = `TorchBracket_${id}`;
  arm.castShadow = true;
  group.add(arm);

  // ۳. پیالهٔ مشعل (هشت‌ضلعی) با لبهٔ حلقه‌ای هشت‌ضلعی و گلوگاه زیر آن
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, 0.07, TORCH_SIDES),
    brassMat,
  );
  collar.position.set(0, ENTRANCE_TORCH.cupY - 0.1, reach);
  group.add(collar);

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.085, 0.16, TORCH_SIDES),
    ironMat,
  );
  cup.position.set(0, ENTRANCE_TORCH.cupY, reach);
  cup.name = `TorchCup_${id}`;
  cup.castShadow = true;
  group.add(cup);

  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.013, TORCH_SIDES, TORCH_SIDES), brassMat);
  cupRim.rotation.x = Math.PI / 2;
  cupRim.position.set(0, ENTRANCE_TORCH.cupY + 0.08, reach);
  cupRim.name = `TorchCupRim_${id}`;
  group.add(cupRim);

  // ۴. فانوس چراغ: شیشهٔ هشت‌ضلعی، هشت تیغهٔ عمودی، گوی نورانی، سرپوش و مهره
  const glassHeight = ENTRANCE_TORCH.glassHeight;
  const glassBottom = ENTRANCE_TORCH.cupY + 0.1;
  const glassCenter = ENTRANCE_TORCH.lanternY;

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffe3b0,
    emissive: new THREE.Color(0xffa94d),
    emissiveIntensity: 1.45,
    roughness: 0.18,
    metalness: 0.02,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
    flatShading: true,
  });
  glassMat.name = `EntranceTorchGlass_${id}`;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.132, glassHeight, TORCH_SIDES, 1, true),
    glassMat,
  );
  glass.position.set(0, glassCenter, reach);
  glass.name = `TorchLanternGlass_${id}`;
  group.add(glass);

  // هشت تیغهٔ عمودی روی گوشه‌های هشت‌ضلعی
  const ribRadius = 0.15;
  for (let side = 0; side < TORCH_SIDES; side++) {
    const angle = (side / TORCH_SIDES) * Math.PI * 2 + Math.PI / TORCH_SIDES;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.016, glassHeight + 0.02, 0.016), brassMat);
    rib.position.set(Math.cos(angle) * ribRadius, glassCenter, reach + Math.sin(angle) * ribRadius);
    rib.rotation.y = -angle;
    rib.name = `TorchLanternRib_${id}_${side}`;
    group.add(rib);
  }

  // پایه و سرپوش هشت‌ضلعی فانوس
  const lanternBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.162, 0.162, 0.035, TORCH_SIDES),
    brassMat,
  );
  lanternBase.position.set(0, glassBottom - 0.01, reach);
  group.add(lanternBase);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.195, 0.15, TORCH_SIDES), ironMat);
  cap.position.set(0, glassCenter + glassHeight / 2 + 0.07, reach);
  cap.name = `TorchLanternCap_${id}`;
  cap.castShadow = true;
  group.add(cap);

  const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.012, TORCH_SIDES, TORCH_SIDES), brassMat);
  capRim.rotation.x = Math.PI / 2;
  capRim.position.set(0, glassCenter + glassHeight / 2 + 0.005, reach);
  group.add(capRim);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.032, TORCH_SIDES, 6), brassMat);
  finial.position.set(0, glassCenter + glassHeight / 2 + 0.15, reach);
  group.add(finial);

  // گوی نورانی داخل شیشه — همان «چراغ» بودنِ مشعل
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d8,
    emissive: new THREE.Color(0xffc06a),
    emissiveIntensity: 2.4,
    roughness: 0.3,
    metalness: 0.0,
  });
  bulbMat.name = `EntranceTorchBulb_${id}`;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.072, TORCH_SIDES * 2, 10), bulbMat);
  bulb.position.set(0, glassCenter - 0.02, reach);
  bulb.name = `TorchLanternBulb_${id}`;
  group.add(bulb);

  // هالهٔ گرم گرد دور فانوس (همان بافت هالهٔ چراغ‌های کوچه)
  let haloMat: THREE.SpriteMaterial | null = null;
  if (options.haloTexture) {
    haloMat = new THREE.SpriteMaterial({
      map: options.haloTexture,
      color: 0xffb87a,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    haloMat.name = `EntranceTorchHaloMaterial_${id}`;
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(1.5, 1.5, 1);
    halo.position.set(0, glassCenter, reach);
    halo.name = `EntranceTorchHalo_${id}`;
    group.add(halo);
  }

  // نور واقعی چراغ
  const light = new THREE.PointLight(
    ENTRANCE_TORCH.color,
    ENTRANCE_TORCH.intensity,
    ENTRANCE_TORCH.distance,
    ENTRANCE_TORCH.decay,
  );
  light.name = `EntranceTorchLight_${id}`;
  light.position.set(0, glassCenter, reach + facing * 0.06);
  light.castShadow = false;
  group.add(light);

  return {
    group,
    light,
    update(elapsedSeconds: number) {
      const factor = entranceTorchBreathe(elapsedSeconds, seed);
      light.intensity = ENTRANCE_TORCH.intensity * factor;
      bulbMat.emissiveIntensity = 2.4 * factor;
      glassMat.emissiveIntensity = 1.45 * (0.94 + 0.06 * factor);
      if (haloMat) haloMat.opacity = Math.max(0.01, 0.18 * factor);
      return factor;
    },
  };
}
