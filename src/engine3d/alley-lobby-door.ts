'use client';

/**
 * alley-lobby-door.ts — درِ اصلی لابی تماشاخانه: نیم‌دایرهٔ شیشه‌ای + دو لنگهٔ چوبی (علیرضا)
 * ---------------------------------------------------------------------------
 * خواستهٔ بازبینی: درِ اصلی لابی از سه بخش ساخته شود:
 *   ۱. **نوار نیم‌دایره‌ای شیشه‌ای** بالای هر دو در، با **نقش‌نگاری آهنی** جلوی شیشه
 *   ۲. **دو لنگهٔ درِ قهوه‌ای تیره** با **دو دستگیرهٔ استوانه‌ای برنجی** کنار هم در وسط
 *   ۳. **مستطیل عمودی شیشه** در میانهٔ هر لنگه با نقش‌نگاری آهنی، و **نیمهٔ پایین چوبی**
 *
 * ساختار:
 *   - `LobbyDoorSurround` — قاب سنگی حکاکی‌شده با حفرهٔ در + قوس (بیرون‌نگاری با `Shape` و `hole`)
 *   - `LobbyDoorArcGlass` — نوار نیم‌دایره‌ای شیشه (نیم‌حلقهٔ ۰٫۳ متری)
 *   - `LobbyDoorArcTracery` — ۷ بازوی شعاعی آهنی + یک قوس هم‌مرکز + ۵ گل‌سر
 *   - `LobbyDoorLeafLeft/Right` — دو لنگهٔ چوبی با شیشهٔ مستطیلی و نقش‌نگاری آهنی
 *   - `LobbyDoorHandleLeft/Right` — دو استوانهٔ برنجی کنار هم در وسط در
 */

import * as THREE from 'three';

/** اندازه‌های مشترک در لابی — تنها منبع حقیقت برای ساخت و تست */
export const LOBBY_DOOR = {
  /** عرض هر لنگه */
  leafWidth: 1.265,
  /** ارتفاع لنگه‌ها؛ نیم‌دایره دقیقاً روی همین ارتفاع می‌نشیند */
  leafHeight: 2.2,
  leafThickness: 0.14,
  /** شکاف باریک بین دو لنگه در وسط */
  leafGap: 0.012,
  /** شعاع داخلی و بیرونی نوار نیم‌دایره‌ای شیشه */
  arcInnerRadius: 1.0,
  arcOuterRadius: 1.271,
  /** مستطیل عمودی شیشه در میانهٔ هر لنگه */
  windowWidth: 0.46,
  windowHeight: 1.02,
  windowCenterY: 1.6,
  /** نیمهٔ پایین چوبی: پنل برجستهٔ پایین لنگه */
  lowerPanelHeight: 0.9,
  lowerPanelCenterY: 0.55,
  /** دستگیرهٔ استوانه‌ای برنجی */
  handleRadius: 0.035,
  handleLength: 0.6,
  handleCenterY: 1.12,
  /** فاصلهٔ محور دستگیره از لبهٔ داخلی لنگه (کنار شکاف وسط در) */
  handleGapFromSeam: 0.083,
  /** ضخامت میله‌های نقش‌نگاری آهنی */
  barThickness: 0.018,
  /** قاب سنگی پیرامون در */
  surroundWidth: 3.05,
  surroundHeight: 3.7,
  surroundDepth: 0.22,
} as const;

/** تعداد بازوهای شعاعی نقش‌نگاری نیم‌دایره */
export const ARC_TRACERY_SPOKES = 7;

export interface LobbyDoorMaps {
  colorMap?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  roughnessMap?: THREE.Texture | null;
}

export interface LobbyDoorOptions {
  /** بافت‌های چوب تیرهٔ در (همان خانوادهٔ جعبه‌های کوچه) */
  woodMaps?: LobbyDoorMaps;
  /** بافت‌های سنگ قاب پیرامون */
  stoneMaps?: LobbyDoorMaps;
  environmentMap?: THREE.Texture | null;
}

export interface LobbyDoorInstance {
  readonly group: THREE.Group;
  readonly surround: THREE.Mesh;
  readonly arcGlass: THREE.Mesh;
  readonly leftLeaf: THREE.Group;
  readonly rightLeaf: THREE.Group;
  readonly handles: readonly THREE.Mesh[];
  readonly windowGlass: readonly THREE.Mesh[];
  /** نفسِ ملایم نور شیشه‌ها — کاملاً قطعی برای تست واحد */
  update(elapsedSeconds: number): void;
}

/** تغییر ملایم درخشش شیشه‌ها؛ همیشه نزدیک ۱ و هرگز صفر نمی‌شود */
export function lobbyDoorGlowPulse(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds)) return 1;
  const t = Math.max(0, elapsedSeconds);
  return 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.7) * Math.cos(t * 1.9 + 1.1));
}

export function createLobbyDoor(options: LobbyDoorOptions = {}): LobbyDoorInstance {
  const group = new THREE.Group();
  group.name = 'TheaterDoor';
  group.userData.anchorId = 'theaterDoor';

  const halfWidth = LOBBY_DOOR.leafWidth + LOBBY_DOOR.leafGap / 2;
  const leafCenterX = LOBBY_DOOR.leafWidth / 2 + LOBBY_DOOR.leafGap / 2;
  const frontZ = LOBBY_DOOR.leafThickness / 2;

  // ------------------------------------------------------------------ متریال
  // قهوه‌ای تیرهٔ در: بدون هیچ براقیت اضافه، با بافت چوب تیرهٔ کوچه
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x40281a,
    map: options.woodMaps?.colorMap ?? null,
    normalMap: options.woodMaps?.normalMap ?? null,
    roughnessMap: options.woodMaps?.roughnessMap ?? null,
    roughness: 0.72,
    metalness: 0.06,
  });
  woodMat.name = 'LobbyDoorWood';

  // چوب تیره‌تر برای پنل‌های پایین و تیمپانوم نیم‌دایره (عمق و کنتراست)
  const woodDeepMat = new THREE.MeshStandardMaterial({
    color: 0x2b1a10,
    roughness: 0.8,
    metalness: 0.05,
  });
  woodDeepMat.name = 'LobbyDoorWoodDeep';

  // آهن نقش‌نگاری: مات، با اندکی درخشش فلزی
  const ironTraceryMat = new THREE.MeshStandardMaterial({
    color: 0x1d2126,
    roughness: 0.44,
    metalness: 0.72,
    envMap: options.environmentMap ?? null,
    envMapIntensity: 0.55,
  });
  ironTraceryMat.name = 'LobbyDoorTraceryIron';

  // برنج طلایی دستگیره‌ها و تزئینات
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd0a85a,
    roughness: 0.28,
    metalness: 0.86,
    envMap: options.environmentMap ?? null,
    envMapIntensity: 1.05,
  });
  brassMat.name = 'LobbyDoorBrass';

  // شیشهٔ نوار نیم‌دایره و مستطیل‌های در
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xaec4d2,
    emissive: new THREE.Color(0x1d1309),
    emissiveIntensity: 0.55,
    roughness: 0.1,
    metalness: 0.04,
    envMap: options.environmentMap ?? null,
    envMapIntensity: 0.65,
    transparent: true,
    opacity: 0.46,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  glassMat.name = 'LobbyDoorGlass';

  // ------------------------------------------------------------------ ۱. قاب سنگی با حفرهٔ در + قوس
  const surroundShape = new THREE.Shape();
  surroundShape.moveTo(-LOBBY_DOOR.surroundWidth / 2, 0);
  surroundShape.lineTo(LOBBY_DOOR.surroundWidth / 2, 0);
  surroundShape.lineTo(LOBBY_DOOR.surroundWidth / 2, LOBBY_DOOR.surroundHeight);
  surroundShape.lineTo(-LOBBY_DOOR.surroundWidth / 2, LOBBY_DOOR.surroundHeight);
  surroundShape.closePath();

  const opening = new THREE.Path();
  opening.moveTo(-halfWidth, 0);
  opening.lineTo(-halfWidth, LOBBY_DOOR.leafHeight);
  // قوس نیم‌دایره از چپ به راست روی بالای لنگه‌ها (ساعتگرد ⇒ نیمهٔ بالایی)
  opening.absarc(0, LOBBY_DOOR.leafHeight, halfWidth, Math.PI, 0, true);
  opening.lineTo(halfWidth, 0);
  opening.closePath();
  surroundShape.holes.push(opening);

  const surroundGeo = new THREE.ExtrudeGeometry(surroundShape, {
    depth: LOBBY_DOOR.surroundDepth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 40,
  });
  const surroundMat = new THREE.MeshStandardMaterial({
    color: 0x6a615a,
    map: options.stoneMaps?.colorMap ?? null,
    normalMap: options.stoneMaps?.normalMap ?? null,
    roughnessMap: options.stoneMaps?.roughnessMap ?? null,
    roughness: 0.94,
    metalness: 0.03,
    envMap: options.environmentMap ?? null,
    envMapIntensity: 0.16,
  });
  surroundMat.name = 'LobbyDoorSurroundStone';
  const surround = new THREE.Mesh(surroundGeo, surroundMat);
  surround.name = 'LobbyDoorSurround';
  // پشت قاب کمی داخل نمای تماشاخانه می‌رود تا هیچ شکافی دیده نشود
  surround.position.z = -LOBBY_DOOR.surroundDepth + 0.01;
  surround.castShadow = true;
  surround.receiveShadow = true;
  group.add(surround);

  // نوار برنجی روی لبهٔ حفرهٔ قوس (تأکید روی نیم‌دایره)
  const arcTrim = new THREE.Mesh(
    new THREE.TorusGeometry(halfWidth, 0.028, 8, 64, Math.PI),
    brassMat,
  );
  arcTrim.name = 'LobbyDoorArcTrim';
  arcTrim.position.set(0, LOBBY_DOOR.leafHeight, 0.02);
  group.add(arcTrim);

  // نوار برنجی روی لبهٔ داخلی نیم‌دایره (مرز تیمپانوم چوبی و نوار شیشه)
  const arcInnerTrim = new THREE.Mesh(
    new THREE.TorusGeometry(LOBBY_DOOR.arcInnerRadius, 0.018, 8, 48, Math.PI),
    brassMat,
  );
  arcInnerTrim.name = 'LobbyDoorArcInnerTrim';
  arcInnerTrim.position.set(0, LOBBY_DOOR.leafHeight, 0.025);
  group.add(arcInnerTrim);

  // کتیبهٔ افقی برنجی روی سر دو لنگه: مرز درهای چوبی و نوار نیم‌دایرهٔ شیشه
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2 + 0.08, 0.06, 0.1),
    brassMat,
  );
  lintel.name = 'LobbyDoorLintel';
  lintel.position.set(0, LOBBY_DOOR.leafHeight, 0.03);
  lintel.castShadow = true;
  group.add(lintel);

  // دو نوار برنجی عمودی روی دو جدارهٔ قاب
  for (const side of [-1, 1] as const) {
    const jambTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, LOBBY_DOOR.leafHeight, 0.06),
      brassMat,
    );
    jambTrim.name = `LobbyDoorJambTrim${side < 0 ? 'Left' : 'Right'}`;
    jambTrim.position.set(side * (halfWidth + 0.038), LOBBY_DOOR.leafHeight / 2, 0.02);
    jambTrim.castShadow = true;
    group.add(jambTrim);
  }

  // ------------------------------------------------------------------ ۲. پردهٔ تاریک داخلی (پشت شیشه‌ها)
  // شیشه‌ها شفاف‌اند؛ بدون این پرده، سنگ نمای پشت از داخل شیشه دیده می‌شد و
  // «شیشه بودن» خوانده نمی‌شد. یک پردهٔ گرم و تاریک، عمق لابی را می‌سازد.
  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x120b06,
    emissive: new THREE.Color(0x1a0f06),
    emissiveIntensity: 0.5,
    roughness: 1,
    metalness: 0,
  });
  interiorMat.name = 'LobbyDoorInteriorShadow';
  const interior = new THREE.Mesh(
    new THREE.BoxGeometry(LOBBY_DOOR.surroundWidth - 0.4, LOBBY_DOOR.leafHeight + halfWidth, 0.012),
    interiorMat,
  );
  interior.name = 'LobbyDoorInterior';
  interior.position.set(0, (LOBBY_DOOR.leafHeight + halfWidth) / 2, -0.093);
  group.add(interior);

  // ------------------------------------------------------------------ ۳. نوار نیم‌دایره‌ای شیشه + نقش‌نگاری آهنی
  const bandCenterY = LOBBY_DOOR.leafHeight;
  const arcGlass = new THREE.Mesh(
    new THREE.RingGeometry(
      LOBBY_DOOR.arcInnerRadius,
      LOBBY_DOOR.arcOuterRadius,
      64,
      1,
      0,
      Math.PI,
    ),
    glassMat,
  );
  arcGlass.name = 'LobbyDoorArcGlass';
  arcGlass.position.set(0, bandCenterY, -0.02);
  group.add(arcGlass);

  // تیمپانوم نیم‌دایرهٔ چوبی داخل نوار شیشه (شعاع داخلی به سمت مرکز)
  const tympanum = new THREE.Mesh(
    new THREE.CircleGeometry(LOBBY_DOOR.arcInnerRadius - 0.005, 48, 0, Math.PI),
    woodDeepMat,
  );
  tympanum.name = 'LobbyDoorTympanum';
  tympanum.position.set(0, bandCenterY, -0.045);
  tympanum.receiveShadow = true;
  group.add(tympanum);

  // نقش‌نگاری آهنی نیم‌دایره: بازوهای شعاعی + قوس هم‌مرکز + گل‌سرها
  const arcTracery = new THREE.Group();
  arcTracery.name = 'LobbyDoorArcTracery';
  const bandMidRadius = (LOBBY_DOOR.arcInnerRadius + LOBBY_DOOR.arcOuterRadius) / 2;
  const bandWidth = LOBBY_DOOR.arcOuterRadius - LOBBY_DOOR.arcInnerRadius;
  for (let spoke = 0; spoke < ARC_TRACERY_SPOKES; spoke++) {
    const angle = (spoke / (ARC_TRACERY_SPOKES - 1)) * Math.PI;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(bandWidth, LOBBY_DOOR.barThickness, LOBBY_DOOR.barThickness),
      ironTraceryMat,
    );
    bar.name = `LobbyDoorArcSpoke_${spoke}`;
    bar.position.set(
      Math.cos(angle) * bandMidRadius,
      bandCenterY + Math.sin(angle) * bandMidRadius,
      0.03,
    );
    bar.rotation.z = angle;
    arcTracery.add(bar);
  }

  const midArc = new THREE.Mesh(
    new THREE.TorusGeometry(bandMidRadius, 0.012, 6, 48, Math.PI),
    ironTraceryMat,
  );
  midArc.name = 'LobbyDoorArcRail';
  midArc.position.set(0, bandCenterY, 0.03);
  arcTracery.add(midArc);

  // گل‌سرهای آهنی روی تقاطع بازوها با قوس میانی
  for (const spoke of [1, 2, 3, 4, 5]) {
    const angle = (spoke / (ARC_TRACERY_SPOKES - 1)) * Math.PI;
    const rosette = new THREE.Mesh(
      new THREE.TorusGeometry(0.042, 0.009, 6, 16),
      ironTraceryMat,
    );
    rosette.name = `LobbyDoorArcRosette_${spoke}`;
    rosette.position.set(
      Math.cos(angle) * bandMidRadius,
      bandCenterY + Math.sin(angle) * bandMidRadius,
      0.04,
    );
    arcTracery.add(rosette);
  }
  group.add(arcTracery);

  // ------------------------------------------------------------------ ۴. دو لنگهٔ چوبی
  const windowGlass: THREE.Mesh[] = [];
  const handles: THREE.Mesh[] = [];

  const buildLeaf = (side: -1 | 1): THREE.Group => {
    const leaf = new THREE.Group();
    leaf.name = side < 0 ? 'LobbyDoorLeafLeft' : 'LobbyDoorLeafRight';
    leaf.position.set(side * leafCenterX, 0, 0);

    // بدنهٔ چوبی قهوه‌ای تیره
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(LOBBY_DOOR.leafWidth, LOBBY_DOOR.leafHeight, LOBBY_DOOR.leafThickness),
      woodMat,
    );
    slab.name = `${leaf.name}_Slab`;
    slab.position.y = LOBBY_DOOR.leafHeight / 2;
    slab.castShadow = true;
    slab.receiveShadow = true;
    leaf.add(slab);

    // نیمهٔ پایین چوبی: پنل برجسته + قاب باریک
    const lowerPanel = new THREE.Mesh(
      new THREE.BoxGeometry(
        LOBBY_DOOR.leafWidth - 0.26,
        LOBBY_DOOR.lowerPanelHeight,
        0.04,
      ),
      woodDeepMat,
    );
    lowerPanel.name = `${leaf.name}_LowerPanel`;
    lowerPanel.position.set(0, LOBBY_DOOR.lowerPanelCenterY, frontZ + 0.018);
    lowerPanel.castShadow = true;
    leaf.add(lowerPanel);

    // قاب تزئینی پنل پایین (چهار نوار برنجی نازک)
    const panelFrameWidth = LOBBY_DOOR.leafWidth - 0.18;
    const panelFrameHeight = LOBBY_DOOR.lowerPanelHeight + 0.08;
    for (const py of [-1, 1] as const) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(panelFrameWidth, 0.03, 0.028),
        brassMat,
      );
      rail.position.set(
        0,
        LOBBY_DOOR.lowerPanelCenterY + py * (panelFrameHeight / 2),
        frontZ + 0.012,
      );
      leaf.add(rail);
    }
    for (const px of [-1, 1] as const) {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.03, panelFrameHeight, 0.028), brassMat);
      stile.position.set(
        px * (panelFrameWidth / 2),
        LOBBY_DOOR.lowerPanelCenterY,
        frontZ + 0.012,
      );
      leaf.add(stile);
    }

    // مستطیل عمودی شیشه در میانهٔ لنگه
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(LOBBY_DOOR.windowWidth, LOBBY_DOOR.windowHeight),
      glassMat,
    );
    glass.name = `${leaf.name}_WindowGlass`;
    glass.position.set(0, LOBBY_DOOR.windowCenterY, frontZ + 0.012);
    leaf.add(glass);
    windowGlass.push(glass);

    // قاب آهنی دور مستطیل شیشه
    const frameW = LOBBY_DOOR.windowWidth + 0.06;
    const frameH = LOBBY_DOOR.windowHeight + 0.06;
    for (const py of [-1, 1] as const) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(frameW, 0.035, 0.03),
        ironTraceryMat,
      );
      rail.name = `${leaf.name}_WindowFrameH${py > 0 ? 'Top' : 'Bottom'}`;
      rail.position.set(0, LOBBY_DOOR.windowCenterY + py * (frameH / 2), frontZ + 0.028);
      leaf.add(rail);
    }
    for (const px of [-1, 1] as const) {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.035, frameH, 0.03), ironTraceryMat);
      stile.name = `${leaf.name}_WindowFrameV${px > 0 ? 'Right' : 'Left'}`;
      stile.position.set(px * (frameW / 2), LOBBY_DOOR.windowCenterY, frontZ + 0.028);
      leaf.add(stile);
    }

    // نقش‌نگاری آهنی روی شیشهٔ مستطیلی: دو میلهٔ عمودی + دو میلهٔ افقی + گل‌سر میانی
    const tracery = new THREE.Group();
    tracery.name = `${leaf.name}_WindowTracery`;
    for (const offset of [-0.115, 0.115]) {
      const vBar = new THREE.Mesh(
        new THREE.BoxGeometry(LOBBY_DOOR.barThickness, LOBBY_DOOR.windowHeight, LOBBY_DOOR.barThickness),
        ironTraceryMat,
      );
      tracery.add(vBar);
      vBar.position.set(offset, LOBBY_DOOR.windowCenterY, frontZ + 0.048);
    }
    for (const offset of [-0.24, 0.24]) {
      const hBar = new THREE.Mesh(
        new THREE.BoxGeometry(LOBBY_DOOR.windowWidth, LOBBY_DOOR.barThickness, LOBBY_DOOR.barThickness),
        ironTraceryMat,
      );
      tracery.add(hBar);
      hBar.position.set(0, LOBBY_DOOR.windowCenterY + offset, frontZ + 0.048);
    }
    const rosette = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 6, 20), ironTraceryMat);
    rosette.name = `${leaf.name}_WindowRosette`;
    rosette.position.set(0, LOBBY_DOOR.windowCenterY, frontZ + 0.056);
    tracery.add(rosette);
    leaf.add(tracery);

    // دستگیرهٔ استوانه‌ای برنجی — عمودی و نزدیک شکاف وسط در تا دو دستگیره
    // در وسط در کنار هم بنشینند (لبهٔ داخلی هر لنگه سمت مرکز است)
    const handleX = -side * (LOBBY_DOOR.leafWidth / 2 - LOBBY_DOOR.handleGapFromSeam);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(LOBBY_DOOR.handleRadius, LOBBY_DOOR.handleRadius, LOBBY_DOOR.handleLength, 16),
      brassMat,
    );
    handle.name = side < 0 ? 'LobbyDoorHandleLeft' : 'LobbyDoorHandleRight';
    handle.position.set(handleX, LOBBY_DOOR.handleCenterY, frontZ + 0.1);
    handle.castShadow = true;
    leaf.add(handle);
    handles.push(handle);

    // دو پایهٔ اتصال دستگیره به در
    for (const py of [-1, 1] as const) {
      const standoff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.019, 0.019, 0.075, 12),
        brassMat,
      );
      standoff.rotation.x = Math.PI / 2;
      standoff.position.set(
        handleX,
        LOBBY_DOOR.handleCenterY + py * (LOBBY_DOOR.handleLength / 2 - 0.09),
        frontZ + 0.0375,
      );
      leaf.add(standoff);
    }

    // صفحهٔ برنجی پشت دستگیره
    const backplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, LOBBY_DOOR.handleLength + 0.12, 0.02),
      brassMat,
    );
    backplate.name = `${leaf.name}_HandlePlate`;
    backplate.position.set(handleX, LOBBY_DOOR.handleCenterY, frontZ + 0.008);
    leaf.add(backplate);

    // نوار آستراگال کنار شکاف وسط (کاملاً در لبهٔ داخلی لنگه)
    const astragal = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, LOBBY_DOOR.leafHeight - 0.02, 0.028),
      ironTraceryMat,
    );
    astragal.name = `${leaf.name}_Astragal`;
    astragal.position.set(
      -side * (LOBBY_DOOR.leafWidth / 2 - 0.012),
      LOBBY_DOOR.leafHeight / 2,
      frontZ + 0.004,
    );
    leaf.add(astragal);

    return leaf;
  };

  const leftLeaf = buildLeaf(-1);
  const rightLeaf = buildLeaf(1);
  group.add(leftLeaf, rightLeaf);

  // آستانهٔ برنجی زیر در
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2 + 0.1, 0.045, LOBBY_DOOR.leafThickness + 0.12),
    brassMat,
  );
  threshold.name = 'LobbyDoorThreshold';
  threshold.position.set(0, 0.022, 0.01);
  threshold.receiveShadow = true;
  group.add(threshold);

  return {
    group,
    surround,
    arcGlass,
    leftLeaf,
    rightLeaf,
    handles,
    windowGlass,
    update(elapsedSeconds: number) {
      glassMat.emissiveIntensity = 0.55 * lobbyDoorGlowPulse(elapsedSeconds);
    },
  };
}
