'use client';

/**
 * theater-geometry.ts — هندسه سالن تئاتر ۲۰ نفره و شخصیت‌های بزرگسال باورپذیر (علیرضا — موج ۷)
 * - سالن ۴ ردیف × ۵ صندلی پلکانی
 * - سه سن (چپ/مرکز/راست) با پرده قرمز
 * - لوستر کریستالیِ هشت‌شاخه (هر شاخه دو چراغ + آویزِ کریستالِ عمودی)
 * - تابلوهای دیواری
 * - شخصیت‌های بزرگسال: رقصنده ایتالیایی و مرد سیاه‌پوش با تناسبات واقعی (قد ۱.۷۵ و ۱.۹۵ متر)
 * - بدون مدل خارجی — همه رویه‌ای با Capsule/Box — لایسنس MIT (Three.js)
 * - مستند منبع: procedural — جایگزین مدل‌های glTF آماده در موج‌های بعد با مجوز CC0/Mixamo
 */

import * as THREE from 'three';
import { resolvePlayerHumanPalette } from './presence/RemotePlayer';
import { HumanAvatar } from './characters/human-avatar';
import { resolveHumanLook } from './characters/human-presets';
import { createTheaterSeat, createTheaterSeatKit } from './theater-seat';
import { buildTheaterChandelier } from './theater-chandelier';

export {
  THEATER_SEAT_DIMENSIONS,
  THEATER_SEAT_COLORS,
  createInstancedTheaterSeats,
  createTheaterSeat,
  createUpholsteredCushionGeometry,
} from './theater-seat';

export interface SeatedPlayerCharacterOptions {
  playerId: string;
  playerName: string;
  seatIndex: number;
  isLocalPlayer?: boolean;
}

/**
 * ساخت کاراکتر سه‌بعدی انسان در حالت نشسته روی صندلی تئاتر (نگاه به سمت صحنه در جهت -Z)
 *
 * این تابع دیگر کپسول و کره نمی‌چیند؛ همان HumanAvatar را با ژست «نشسته» می‌سازد تا
 * تماشاگر سالن هم همان چهره، مو، دستِ انگشت‌دار و پلک‌زنِ حالت ایستاده را داشته باشد.
 * قرارداد نام‌ها (avatar-body/head/arm-leg) برای HUD و تست‌ها حفظ شده است.
 */
export function createSeatedPlayerCharacter(
  options: SeatedPlayerCharacterOptions,
): THREE.Group {
  const look = resolveHumanLook(options.playerId, options.seatIndex, {
    name: options.playerName,
  });
  if (options.isLocalPlayer) look.coatHex = 0xc9a86a;

  const avatar = new HumanAvatar({ look, pose: 'seated', displayName: options.playerName });
  const root = new THREE.Group();
  root.name = `Avatar_${options.playerName}`;
  root.userData.playerId = options.playerId;
  root.userData.playerName = options.playerName;
  root.userData.seatIndex = options.seatIndex;
  root.userData.humanAvatar = avatar;
  root.add(avatar);

  // سازگاری با کد قبلی: پالت در userData می‌ماند
  root.userData.palette = resolvePlayerHumanPalette(
    options.playerId,
    options.seatIndex,
    options.isLocalPlayer ? 0xc9a86a : undefined,
  );

  return root;
}

/** یک فریم از زندگیِ تماشاگر نشسته (تنفس، پلک، نگاه) را جلو می‌برد. */
export function updateSeatedPlayerCharacter(
  root: THREE.Object3D,
  deltaSeconds: number,
  options: { pitchDeg?: number } = {},
): void {
  const avatar = root.userData.humanAvatar as HumanAvatar | undefined;
  avatar?.update(deltaSeconds, { speed: 0, pitchDeg: options.pitchDeg ?? 0 });
}

/**
 * ارتفاع سطح قابل راه رفتن در سالن تئاتر (متر):
 * شامل سه سن نمایش (y = 0.60) و سکوهای پلکانی ردیف‌های ۲ تا ۴ (y = 0.32 / 0.64 / 0.96)
 * تا دوربین اول‌شخص و کفش هم‌تیمی‌ها همیشه دقیقاً روی سطح واقعی کف قرار بگیرند.
 */
export function auditoriumWalkableGroundAt(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;

  // سه سن نمایش در انتهای شمالی سالن (z ∈ [-7.25, -4.75])
  if (z >= -7.25 && z <= -4.75) {
    const onCenterStage = Math.abs(x) <= 2.925;
    const onSideStage = Math.abs(x) >= 3.25 && Math.abs(x) <= 7.75;
    if (onCenterStage || onSideStage) return 0.6;
  }

  // سکوهای پلکانی صندلی‌های ردیف ۲ تا ۴ (عرض ۵٫۶ متر در مرکز سالن)
  if (Math.abs(x) <= 2.8) {
    if (z >= 6.58 && z <= 7.9) return 0.96;
    if (z >= 5.5 && z <= 6.82) return 0.64;
    if (z >= 4.42 && z <= 5.74) return 0.32;
  }

  return 0;
}

export interface TheaterGeometryResult {
  group: THREE.Group;
  seats: THREE.Group[]; // 20 صندلی
  stages: { left: THREE.Group; center: THREE.Group; right: THREE.Group };
  chandelier: THREE.Group;
  dancer: THREE.Group;
  darkMan: THREE.Group;
  lights: THREE.Light[];
  dispose: () => void;
}

/**
 * دو شخصیت صحنه: بانوی ایتالیایی و مرد سیاه‌پوش.
 *
 * پیش‌تر هر دو از یک کپسول تنه + دو کرهٔ چشم ساخته می‌شدند و از نزدیک شبیه
 * مانکن بودند. حالا هر دو همان HumanAvatar را با «ظاهر» اختصاصی می‌گیرند:
 * رقصنده با موی بلند و لباس مخملی قرمز، مرد سیاه‌پوش با قد بلندتر، موی صاف و
 * کت تیره. قلاب‌های انیمیشن در userData می‌مانند تا صحنه دست‌ها را تکان دهد.
 */
function createAdultCharacter(type: 'dancer' | 'darkMan'): THREE.Group {
  const group = new THREE.Group();
  group.name = type === 'dancer' ? 'DancerCharacter' : 'DarkManCharacter';
  const isDancer = type === 'dancer';

  const look = resolveHumanLook(isDancer ? 'npc-dancer' : 'npc-darkman', isDancer ? 0 : 3, {
    name: isDancer ? 'بانوی ایتالیایی' : 'مرد سیاه‌پوش',
  });
  look.heightMeters = isDancer ? 1.72 : 1.95;
  look.build = isDancer ? 0.94 : 1.06;
  look.feminine = isDancer;
  look.coatHex = isDancer ? 0x9c1f28 : 0x14100f;
  look.hairHex = isDancer ? 0x2a160e : 0x0d0b0c;
  look.hair = {
    style: isDancer ? 'long' : 'slick',
    volume: isDancer ? 1.25 : 0.85,
    sidePart: isDancer ? -0.2 : 0.3,
  };
  look.facialHair = isDancer ? 'none' : 'moustache';
  look.accessory = 'none';
  look.skinHex = isDancer ? 0xefcfb2 : 0xb9b2ad;

  const avatar = new HumanAvatar({ look, displayName: look.displayName });
  group.add(avatar);
  group.userData.humanAvatar = avatar;
  group.userData.leftArm = avatar.getObjectByName('avatar-arm-left');
  group.userData.rightArm = avatar.getObjectByName('avatar-arm-right');
  group.userData.body = avatar.getObjectByName('avatar-body');
  group.userData.height = look.heightMeters;

  return group;
}

export function createTheaterGeometry(): TheaterGeometryResult {
  const group = new THREE.Group();
  group.name = 'TheaterRoot';

  // کف سالن
  const floorGeo = new THREE.PlaneGeometry(18, 22);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // دیوارها
  const wallGeo = new THREE.BoxGeometry(0.5, 6, 22);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a1a2a, roughness: 0.85 });
  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-9, 3, 0);
  group.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.position.set(9, 3, 0);
  group.add(rightWall);

  // سقف
  const ceilingGeo = new THREE.PlaneGeometry(18, 22);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.9, side: THREE.DoubleSide });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 6;
  group.add(ceiling);

  // صندلی‌ها — ۴ ردیف × ۵ ستون پلکانی
  // گام واقعی ردیف تئاتر ≈۱٫۰۵ متر و فاصله مرکز تا مرکز صندلی‌ها ≈۰٫۸۸ متر است؛
  // فاصله قبلی (۱٫۶×۱٫۴) صندلی‌ها را مثل مبل‌های جداافتاده کارتونی نشان می‌داد.
  const seats: THREE.Group[] = [];
  const seatKit = createTheaterSeatKit();
  const rowSpacing = 1.08;
  const colSpacing = 0.88;
  const startZ = 4; // نزدیک‌ترین ردیف به صحنه
  const riserMat = new THREE.MeshStandardMaterial({ color: 0x201822, roughness: 0.94 });
  const riserEdgeMat = new THREE.MeshStandardMaterial({
    color: 0x6d5626,
    roughness: 0.45,
    metalness: 0.55,
  });

  for (let row = 1; row <= 4; row++) {
    const rowY = (row - 1) * 0.32; // پلکانی
    const rowZ = startZ + (row - 1) * rowSpacing;

    // سکوی پلکانی زیر ردیف تا پایه‌های صندلی روی کف بنشینند، نه در هوا
    if (rowY > 0) {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(5.6, rowY, rowSpacing + 0.24), riserMat);
      riser.name = `SeatRiser_${row}`;
      riser.position.set(0, rowY / 2, rowZ);
      riser.castShadow = true;
      riser.receiveShadow = true;
      group.add(riser);
      const nosing = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.035, 0.06), riserEdgeMat);
      nosing.name = `SeatRiserNosing_${row}`;
      nosing.position.set(0, rowY - 0.018, rowZ - (rowSpacing + 0.24) / 2 + 0.03);
      nosing.receiveShadow = true;
      group.add(nosing);
    }

    for (let col = 1; col <= 5; col++) {
      const seat = createTheaterSeat(row, col, seatKit);
      const colX = (col - 3) * colSpacing; // مرکز
      seat.position.set(colX, rowY, rowZ);
      seat.userData.row = row;
      seat.userData.col = col;
      seat.userData.occupied = false;
      group.add(seat);
      seats.push(seat);
    }
  }

  // سه سن
  const stageGroup = new THREE.Group();
  stageGroup.name = 'Stages';

  const createStage = (x: number, name: string): THREE.Group => {
    const g = new THREE.Group();
    g.name = name;
    const platformGeo = new THREE.BoxGeometry(4.5, 0.6, 2.5);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x2a1a1a, roughness: 0.8 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = 0.3;
    platform.receiveShadow = true;
    platform.castShadow = true;
    g.add(platform);

    // پرده قرمز
    const curtainGeo = new THREE.PlaneGeometry(4.5, 3.5);
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.7, side: THREE.DoubleSide });
    const curtain = new THREE.Mesh(curtainGeo, curtainMat);
    curtain.position.set(0, 2.2, -1.2);
    curtain.name = 'Curtain';
    g.add(curtain);

    // نور صحنه
    const spot = new THREE.SpotLight(0xffd9a0, 1.5, 10, Math.PI / 5, 0.3);
    spot.position.set(0, 4, 1);
    spot.target = platform;
    g.add(spot);

    g.position.set(x, 0, -6);
    return g;
  };

  const leftStage = createStage(-5.5, 'StageLeft');
  const centerStage = createStage(0, 'StageCenter');
  const rightStage = createStage(5.5, 'StageRight');

  // سن مرکزی بزرگ‌تر
  centerStage.scale.set(1.3, 1, 1);

  stageGroup.add(leftStage);
  stageGroup.add(centerStage);
  stageGroup.add(rightStage);
  group.add(stageGroup);

  // لوستر: هشت شاخهٔ برنجی؛ روی هر شاخه دو چراغِ شمعی (وسط و نوک) و زیرِ هر
  // شاخه یک آویزِ کریستالِ عمودی. جزئیاتش در `theater-chandelier.ts` است و
  // نورهای واقعی‌اش هم از همان‌جا می‌آید (دو PointLight، نه شانزده تا).
  const chandelierKit = buildTheaterChandelier();
  const chandelier = chandelierKit.group;
  chandelier.position.set(0, 0, 1);
  group.add(chandelier);

  // تابلوها
  for (let i = 0; i < 4; i++) {
    const paintingGeo = new THREE.BoxGeometry(0.08, 1.2, 0.9);
    const paintingMat = new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x4a2a1a : 0x2a3a4a, roughness: 0.7 });
    const painting = new THREE.Mesh(paintingGeo, paintingMat);
    painting.position.set(i < 2 ? -8.7 : 8.7, 2.5, -2 + i * 3);
    painting.rotation.y = i < 2 ? Math.PI / 2 : -Math.PI / 2;
    painting.name = `Painting_${i}`;
    group.add(painting);
  }

  // شخصیت‌ها
  const dancer = createAdultCharacter('dancer');
  dancer.position.set(0, 0, -6);
  dancer.name = 'Dancer';
  group.add(dancer);

  const darkMan = createAdultCharacter('darkMan');
  darkMan.position.set(-3.5, 0, -5.5);
  darkMan.name = 'DarkMan';
  darkMan.visible = false; // در ابتدا مخفی، از ثانیه ۳۱ ظاهر می‌شود
  group.add(darkMan);

  // نورهای کلی
  const lights: THREE.Light[] = [];
  // دو نورِ گرمِ لوستر از سازندهٔ خودش می‌آیند (گوی‌های شمع‌ها emissive‌اند)
  lights.push(...chandelierKit.lights);
  const ambient = new THREE.AmbientLight(0x666688, 0.5);
  group.add(ambient);
  lights.push(ambient);

  const moon = new THREE.DirectionalLight(0x8899cc, 0.6);
  moon.position.set(0, 8, 2);
  group.add(moon);
  lights.push(moon);

  const dispose = () => {
    // هندسه/متریال صندلی‌ها بین هر ۲۰ صندلی مشترک‌اند؛ با Set هرکدام فقط یک‌بار آزاد می‌شوند
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        (Array.isArray(mat) ? mat : [mat]).forEach((m) => {
          materials.add(m);
          Object.values(m as unknown as Record<string, unknown>).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        });
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    seatKit.dispose();
  };

  return {
    group,
    seats,
    stages: { left: leftStage, center: centerStage, right: rightStage },
    chandelier,
    dancer,
    darkMan,
    lights,
    dispose,
  };
}
