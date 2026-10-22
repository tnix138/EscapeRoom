'use client';

/**
 * theater-seat.ts — منبع واحد ساخت صندلی تئاتر برای همه نماهای سه‌بعدی
 * ---------------------------------------------------------------------------
 * قرارداد جهت (مهم — علت باگ «پشتی جلوی صندلی» همین‌جا قفل می‌شود):
 *   • صحنه در جهت ‎-Z‎ است و تماشاگر رو به ‎-Z‎ می‌نشیند (زانوها و نوک پا سمت ‎-Z‎).
 *   • پشتی صندلی باید «پشتِ» بدن تماشاگر باشد، یعنی سمت ‎+Z‎ — نه جلوی او.
 *   هر دو مصرف‌کننده (سالن اصلی و کات‌سین) از همین ماژول صندلی می‌گیرند تا
 *   جهت و تناسباتشان دوباره از هم واگرا نشود.
 *
 * تناسبات (متر) بر اساس صندلی واقعی سالن تئاتر/سینما، نه صندلی کارتونی:
 *   ارتفاع نشیمن از کف ≈ ۰٫۴۶، ارتفاع کل تا تاج پشتی ≈ ۰٫۹۹ (سر تماشاگر باید
 *   از پشتی بیرون بزند)، عرض با دسته‌ها ≈ ۰٫۷۲، عمق نشیمن ≈ ۰٫۴۸،
 *   خواب پشتی ≈ ۷ درجه و دسته در ارتفاع ≈ ۰٫۶۵ از کف.
 * پیش‌تر پشتی در سالن اصلی روی ‎z=-0.38‎ (جلو) بود و در کات‌سین تا ۱٫۷۱ متر
 * قد می‌کشید؛ هر دو اینجا اصلاح شده‌اند.
 */

import * as THREE from 'three';
import { ProceduralTextures, type ProceduralSurfaceMaps } from './materials/procedural-textures';

export const THEATER_SEAT_DIMENSIONS = {
  /** جهت نگاه تماشاگر نشسته (به سمت صحنه) */
  facing: '-Z',
  /** سمتی که پشتی قرار می‌گیرد: پشت بدن تماشاگر */
  backrestSide: '+Z',
  /** عرض کلی با قاب‌های کناری و دسته‌ها */
  overallWidth: 0.705,
  /** عمق کلی از جلوی نشیمن تا پشت پوسته پشتی */
  overallDepth: 0.62,
  /** ارتفاع کلی از کف تا بالای تاج پشتی — عمداً کوتاه‌تر از سر نشسته (≈۱٫۳۳) */
  overallHeight: 0.99,
  /** ارتفاع روی تشک نشیمن از کف */
  seatHeight: 0.46,
  cushionWidth: 0.58,
  cushionDepth: 0.48,
  cushionThickness: 0.12,
  /** مرکز نشیمن کمی جلوتر از مبدأ صندلی است تا ران‌ها روی آن بنشینند */
  cushionCenterZ: -0.03,
  backrestWidth: 0.57,
  backrestHeight: 0.5,
  backrestThickness: 0.12,
  /** مرکز پشتی «پشت» نشیمن است (+Z)؛ مقدار منفی یعنی پشتی وارونه جلوی صندلی است */
  backrestCenterZ: 0.22,
  backrestCenterY: 0.7,
  /** خواب پشتی به عقب (رادیان) — علامت مثبت یعنی تاج پشتی به سمت +Z خم می‌شود */
  backrestReclineRad: 0.12,
  /** ارتفاع روی دسته از کف */
  armrestHeight: 0.65,
} as const;

export const THEATER_SEAT_COLORS = {
  /** مخمل شرابی کم‌اشباع و فرسوده، نه قرمز تخت کارتونی */
  velvet: 0x53202a,
  velvetSheen: 0xa34a58,
  wood: 0x31201a,
  woodShell: 0x241711,
  iron: 0x19191d,
  brass: 0x8a6d3b,
} as const;

const CUSHION_CENTER_Y = 0.4;
const CUSHION_TILT_RAD = 0.05;
const BACK_PIVOT = { y: 0.45, z: 0.19 } as const;
const SIDE_STANDARD_X = 0.315;
const ARMREST_Y = 0.625;

/**
 * ساخت هندسه تشک روکش‌دار با لبه‌های گرد (به‌جای مکعب تیز و کارتونی).
 * پروفایل گرد در صفحه XY اکسترود می‌شود و با bevel لبه‌های جلو/عقب هم نرم می‌شوند.
 * ابعاد نهایی باندینگ‌باکس دقیقاً width×height×depth است.
 */
export function createUpholsteredCushionGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.045,
): THREE.ExtrudeGeometry {
  const bevel = Math.max(
    0.003,
    Math.min(radius, depth * 0.45, width * 0.25, height * 0.25),
  );
  const shapeWidth = Math.max(width - bevel * 2, 0.01);
  const shapeHeight = Math.max(height - bevel * 2, 0.01);
  const corner = Math.max(
    Math.min(radius - bevel, Math.min(shapeWidth, shapeHeight) / 2 - 0.002),
    0.003,
  );
  const x = -shapeWidth / 2;
  const y = -shapeHeight / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + corner, y);
  shape.lineTo(x + shapeWidth - corner, y);
  shape.quadraticCurveTo(x + shapeWidth, y, x + shapeWidth, y + corner);
  shape.lineTo(x + shapeWidth, y + shapeHeight - corner);
  shape.quadraticCurveTo(x + shapeWidth, y + shapeHeight, x + shapeWidth - corner, y + shapeHeight);
  shape.lineTo(x + corner, y + shapeHeight);
  shape.quadraticCurveTo(x, y + shapeHeight, x, y + shapeHeight - corner);
  shape.lineTo(x, y + corner);
  shape.quadraticCurveTo(x, y, x + corner, y);

  const extrudeDepth = Math.max(depth - bevel * 2, 0.004);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 5,
  });
  geometry.translate(0, 0, -extrudeDepth / 2);
  return geometry;
}

/**
 * قاب کناری چدنی صندلی‌های قدیمی تئاتر: یک پروفایل یک‌تکه (پایه جلو، پایه عقب،
 * تکیه‌گاه نشیمن و دسته) با دهانه قوسی بین دو پایه — به‌جای مکعبِ یک‌تکه تا کف.
 * پروفایل در صفحه (z,y) کشیده و در راستای x اکسترود می‌شود.
 */
function createSideStandardGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // محور افقی شکل = z صندلی (جلو ‎-0.26‎ تا عقب ‎+0.25‎)، محور عمودی = y
  shape.moveTo(-0.26, 0);
  shape.lineTo(0.25, 0);
  shape.lineTo(0.25, 0.06);
  shape.quadraticCurveTo(0.19, 0.08, 0.19, 0.16);
  shape.lineTo(0.19, 0.56);
  shape.quadraticCurveTo(0.19, 0.6, 0.15, 0.6);
  shape.lineTo(-0.18, 0.6);
  shape.quadraticCurveTo(-0.24, 0.6, -0.24, 0.54);
  shape.lineTo(-0.24, 0.06);
  shape.quadraticCurveTo(-0.24, 0.02, -0.26, 0);

  // دهانه بین دو پایه تا قاب، بلوک توپر کارتونی نباشد
  const opening = new THREE.Path();
  opening.moveTo(-0.14, 0.07);
  opening.lineTo(0.1, 0.07);
  opening.lineTo(0.1, 0.21);
  opening.quadraticCurveTo(0.1, 0.3, -0.02, 0.3);
  opening.quadraticCurveTo(-0.14, 0.3, -0.14, 0.21);
  opening.closePath();
  shape.holes.push(opening);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.042,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geometry.translate(0, 0, -0.021);
  // چرخش: محور x شکل ← جهت z صندلی، عمق اکسترود ← ضخامت در راستای x صندلی
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

export interface TheaterSeatKit {
  geometries: {
    cushion: THREE.BufferGeometry;
    seatPan: THREE.BufferGeometry;
    backCushion: THREE.BufferGeometry;
    lumbarPad: THREE.BufferGeometry;
    backShell: THREE.BufferGeometry;
    topCap: THREE.BufferGeometry;
    armrest: THREE.BufferGeometry;
    sideStandard: THREE.BufferGeometry;
    numberPlate: THREE.BufferGeometry;
  };
  materials: {
    velvetVariants: readonly THREE.Material[];
    wood: THREE.Material;
    woodShell: THREE.Material;
    iron: THREE.Material;
    brass: THREE.Material;
  };
  dispose: () => void;
}

/** هندسه/متریال مشترک هر ۲۰ صندلی — یک‌بار ساخته می‌شود تا حافظه و draw state هدر نرود. */
export function createTheaterSeatKit(): TheaterSeatKit {
  const dim = THEATER_SEAT_DIMENSIONS;
  const velvetMaps: ProceduralSurfaceMaps = ProceduralTextures.createSurfaceMaps({
    size: 128,
    seed: 1907,
    baseColor: THEATER_SEAT_COLORS.velvet,
    repeat: { x: 2, y: 2 },
    normalStrength: 1.1,
  });

  const velvetMaterial = (tint: number) => {
    const material = new THREE.MeshPhysicalMaterial({
      map: velvetMaps.colorMap,
      normalMap: velvetMaps.normalMap,
      roughnessMap: velvetMaps.roughnessMap,
      color: tint,
      roughness: 0.96,
      metalness: 0,
      // برق لبه‌ای مخمل (sheen) — همان چیزی که سطح تخت را از کارتونی بودن درمی‌آورد
      sheen: 1,
      sheenColor: new THREE.Color(THEATER_SEAT_COLORS.velvetSheen),
      sheenRoughness: 0.55,
    });
    material.normalScale = new THREE.Vector2(0.25, 0.25);
    return material;
  };

  const geometries: TheaterSeatKit['geometries'] = {
    cushion: createUpholsteredCushionGeometry(dim.cushionWidth, dim.cushionThickness, dim.cushionDepth, 0.05),
    seatPan: new THREE.BoxGeometry(0.62, 0.04, 0.44),
    backCushion: createUpholsteredCushionGeometry(dim.backrestWidth, dim.backrestHeight, dim.backrestThickness, 0.055),
    lumbarPad: createUpholsteredCushionGeometry(0.48, 0.16, 0.055, 0.025),
    backShell: createUpholsteredCushionGeometry(0.6, 0.52, 0.032, 0.02),
    topCap: createUpholsteredCushionGeometry(0.6, 0.045, 0.14, 0.018),
    armrest: createUpholsteredCushionGeometry(0.075, 0.045, 0.42, 0.02),
    sideStandard: createSideStandardGeometry(),
    numberPlate: new THREE.PlaneGeometry(0.16, 0.045),
  };

  const materials: TheaterSeatKit['materials'] = {
    // سه ته‌رنگ بسیار نزدیک برای فرسودگی ناهمگن مخمل؛ کپیِ کاملاً یکسان کارتونی است
    velvetVariants: [velvetMaterial(0xffffff), velvetMaterial(0xe9dede), velvetMaterial(0xf5e9e9)],
    wood: new THREE.MeshPhysicalMaterial({
      color: THEATER_SEAT_COLORS.wood,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.55,
    }),
    woodShell: new THREE.MeshPhysicalMaterial({
      color: THEATER_SEAT_COLORS.woodShell,
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.7,
    }),
    iron: new THREE.MeshStandardMaterial({
      color: THEATER_SEAT_COLORS.iron,
      roughness: 0.55,
      metalness: 0.82,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: THEATER_SEAT_COLORS.brass,
      roughness: 0.38,
      metalness: 0.85,
    }),
  };

  let disposed = false;
  return {
    geometries,
    materials,
    dispose() {
      if (disposed) return;
      disposed = true;
      Object.values(geometries).forEach((geometry) => geometry.dispose());
      materials.velvetVariants.forEach((material) => material.dispose());
      materials.wood.dispose();
      materials.woodShell.dispose();
      materials.iron.dispose();
      materials.brass.dispose();
      velvetMaps.dispose();
    },
  };
}

function addSeatMesh(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotationX = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  if (rotationX) mesh.rotation.x = rotationX;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** پلاک برنجی کوچکِ شماره روی «پشتِ» پشتی؛ در محیط بدون DOM (تست) پلاک ساده برنجی ساخته می‌شود. */
function createNumberPlate(row: number, col: number, kit: TheaterSeatKit): THREE.Mesh {
  let material: THREE.Material = kit.materials.brass;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 72;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 72);
        gradient.addColorStop(0, '#9a7d42');
        gradient.addColorStop(0.5, '#7d6234');
        gradient.addColorStop(1, '#8f723c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 72);
        ctx.strokeStyle = 'rgba(43,26,8,0.75)';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 248, 64);
        ctx.fillStyle = '#2b1a08';
        ctx.font = 'bold 34px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${row} · ${col}`, 128, 38);
        ctx.beginPath();
        ctx.arc(18, 36, 5, 0, Math.PI * 2);
        ctx.arc(238, 36, 5, 0, Math.PI * 2);
        ctx.fill();
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.42,
          metalness: 0.55,
        });
      }
    } catch {
      material = kit.materials.brass;
    }
  }
  const plate = new THREE.Mesh(kit.geometries.numberPlate, material);
  plate.name = 'seat-number-plate';
  return plate;
}

/**
 * ساخت یک صندلی تئاتر با تناسبات واقعی.
 * مبدأ: مرکز صندلی روی کف؛ تماشاگر رو به ‎-Z‎ می‌نشیند و پشتی در ‎+Z‎ پشت اوست.
 */
export function createTheaterSeat(
  row: number,
  col: number,
  kit: TheaterSeatKit = createTheaterSeatKit(),
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Seat_${row}_${col}`;
  group.userData.facing = THEATER_SEAT_DIMENSIONS.facing;
  group.userData.backrestSide = THEATER_SEAT_DIMENSIONS.backrestSide;
  group.userData.seatDimensions = THEATER_SEAT_DIMENSIONS;

  const velvet = kit.materials.velvetVariants[(row * 7 + col * 3) % kit.materials.velvetVariants.length];

  // قاب‌های کناری چدنی و دسته‌های چوبی
  for (const side of [-1, 1] as const) {
    addSeatMesh(
      group,
      side < 0 ? 'seat-frame-left' : 'seat-frame-right',
      kit.geometries.sideStandard,
      kit.materials.iron,
      // ۰٫۰۰۴ بالاتر تا bevel لبه قاب زیر کف نرود
      [side * SIDE_STANDARD_X, 0.004, 0],
    );
    addSeatMesh(
      group,
      side < 0 ? 'seat-armrest-left' : 'seat-armrest-right',
      kit.geometries.armrest,
      kit.materials.wood,
      [side * SIDE_STANDARD_X, ARMREST_Y, -0.02],
    );
  }

  // سینی زیر نشیمن و تشک نشیمن با شیب اندک به عقب (لبه جلو کمی بالاتر)
  addSeatMesh(group, 'seat-pan', kit.geometries.seatPan, kit.materials.woodShell, [
    0,
    CUSHION_CENTER_Y - 0.08,
    THEATER_SEAT_DIMENSIONS.cushionCenterZ,
  ], CUSHION_TILT_RAD);
  addSeatMesh(group, 'seat-cushion', kit.geometries.cushion, velvet, [
    0,
    CUSHION_CENTER_Y,
    THEATER_SEAT_DIMENSIONS.cushionCenterZ,
  ], CUSHION_TILT_RAD);

  // پشتی: گروه لولا در پشت نشیمن (+Z) با خواب ملایم به عقب؛ تاج آن فقط تا ≈۰٫۹۹ متر می‌رسد
  const backGroup = new THREE.Group();
  backGroup.name = 'seat-backrest';
  backGroup.position.set(0, BACK_PIVOT.y, BACK_PIVOT.z);
  backGroup.rotation.x = THEATER_SEAT_DIMENSIONS.backrestReclineRad;
  group.add(backGroup);

  addSeatMesh(backGroup, 'seat-back-cushion', kit.geometries.backCushion, velvet, [0, 0.25, 0]);
  // برجستگی کمری جلوی پشتی تا سطح آن تخته تخت نباشد
  addSeatMesh(backGroup, 'seat-lumbar-pad', kit.geometries.lumbarPad, velvet, [0, 0.13, -0.065]);
  // پوسته چوبی پشت پشتی — چیزی که ردیف پشتی واقعاً می‌بیند
  addSeatMesh(backGroup, 'seat-back-shell', kit.geometries.backShell, kit.materials.woodShell, [0, 0.25, 0.079]);
  addSeatMesh(backGroup, 'seat-back-top-cap', kit.geometries.topCap, kit.materials.wood, [0, 0.512, 0.01]);

  const plate = createNumberPlate(row, col, kit);
  plate.position.set(0, 0.36, 0.0965); // روی پوسته، رو به ردیف پشتی (+Z)
  backGroup.add(plate);

  return group;
}

export interface TheaterSeatPosition {
  x: number;
  y?: number;
  z: number;
}

interface InstancedPart {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
}

/**
 * نسخه InstancedMesh همان صندلی (برای کات‌سین) — همان هندسه، همان جهت پشتی (+Z)
 * و همان ارتفاع واقعی؛ فقط به‌جای صدها Mesh جدا، چند draw call.
 */
export function createInstancedTheaterSeats(
  positions: readonly TheaterSeatPosition[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'InstancedTheaterSeats';
  group.userData.seatCount = positions.length;
  group.userData.facing = THEATER_SEAT_DIMENSIONS.facing;
  group.userData.backrestSide = THEATER_SEAT_DIMENSIONS.backrestSide;
  if (positions.length === 0) return group;

  const kit = createTheaterSeatKit();
  group.userData.seatKit = kit;
  const velvet = kit.materials.velvetVariants[0];

  const parts = new Map<string, InstancedPart>();
  const registerPart = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const part: InstancedPart = { name, geometry, material, matrices: [] };
    parts.set(name, part);
    return part;
  };
  const cushion = registerPart('instanced-seat-cushions', kit.geometries.cushion, velvet);
  const seatPan = registerPart('instanced-seat-pans', kit.geometries.seatPan, kit.materials.woodShell);
  const backCushion = registerPart('instanced-seat-back-cushions', kit.geometries.backCushion, velvet);
  const lumbar = registerPart('instanced-seat-lumbar-pads', kit.geometries.lumbarPad, velvet);
  const backShell = registerPart('instanced-seat-back-shells', kit.geometries.backShell, kit.materials.woodShell);
  const topCap = registerPart('instanced-seat-back-top-caps', kit.geometries.topCap, kit.materials.wood);
  const frames = registerPart('instanced-seat-frames', kit.geometries.sideStandard, kit.materials.iron);
  const armrests = registerPart('instanced-seat-armrests', kit.geometries.armrest, kit.materials.wood);

  const dummy = new THREE.Object3D();
  const pivotDummy = new THREE.Object3D();
  const matrixAt = (x: number, y: number, z: number, rotationX = 0): THREE.Matrix4 => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rotationX, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  };

  for (const pos of positions) {
    const baseY = pos.y ?? 0;
    cushion.matrices.push(matrixAt(pos.x, baseY + CUSHION_CENTER_Y, pos.z + THEATER_SEAT_DIMENSIONS.cushionCenterZ, CUSHION_TILT_RAD));
    seatPan.matrices.push(matrixAt(pos.x, baseY + CUSHION_CENTER_Y - 0.08, pos.z + THEATER_SEAT_DIMENSIONS.cushionCenterZ, CUSHION_TILT_RAD));

    // قطعات پشتی حول همان لولای +Z و با همان خواب گروهی
    pivotDummy.position.set(pos.x, baseY + BACK_PIVOT.y, pos.z + BACK_PIVOT.z);
    pivotDummy.rotation.set(THEATER_SEAT_DIMENSIONS.backrestReclineRad, 0, 0);
    pivotDummy.scale.set(1, 1, 1);
    pivotDummy.updateMatrix();
    const backMatrixAt = (localY: number, localZ: number): THREE.Matrix4 => {
      dummy.position.set(0, localY, localZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      return pivotDummy.matrix.clone().multiply(dummy.matrix);
    };
    backCushion.matrices.push(backMatrixAt(0.25, 0));
    lumbar.matrices.push(backMatrixAt(0.13, -0.065));
    backShell.matrices.push(backMatrixAt(0.25, 0.079));
    topCap.matrices.push(backMatrixAt(0.512, 0.01));

    for (const side of [-1, 1] as const) {
      frames.matrices.push(matrixAt(pos.x + side * SIDE_STANDARD_X, baseY + 0.004, pos.z));
      armrests.matrices.push(matrixAt(pos.x + side * SIDE_STANDARD_X, baseY + ARMREST_Y, pos.z - 0.02));
    }
  }

  for (const part of parts.values()) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, part.matrices.length);
    mesh.name = part.name;
    part.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}
