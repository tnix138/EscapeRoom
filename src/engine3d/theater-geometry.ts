'use client';

/**
 * theater-geometry.ts — هندسه سالن تئاتر ۲۰ نفره و شخصیت‌های بزرگسال باورپذیر (علیرضا — موج ۷)
 * - سالن ۴ ردیف × ۵ صندلی پلکانی
 * - سه سن (چپ/مرکز/راست) با پرده قرمز
 * - لوستر کریستالی
 * - تابلوهای دیواری
 * - شخصیت‌های بزرگسال: رقصنده ایتالیایی و مرد سیاه‌پوش با تناسبات واقعی (قد ۱.۷۵ و ۱.۹۵ متر)
 * - بدون مدل خارجی — همه رویه‌ای با Capsule/Box — لایسنس MIT (Three.js)
 * - مستند منبع: procedural — جایگزین مدل‌های glTF آماده در موج‌های بعد با مجوز CC0/Mixamo
 */

import * as THREE from 'three';
import { resolvePlayerHumanPalette } from './presence/RemotePlayer';

export interface SeatedPlayerCharacterOptions {
  playerId: string;
  playerName: string;
  seatIndex: number;
  isLocalPlayer?: boolean;
}

/**
 * ساخت کاراکتر سه‌بعدی انسان در حالت نشسته روی صندلی تئاتر (نگاه به سمت صحنه در جهت -Z)
 */
export function createSeatedPlayerCharacter(
  options: SeatedPlayerCharacterOptions,
): THREE.Group {
  const palette = resolvePlayerHumanPalette(
    options.playerId,
    options.seatIndex,
    options.isLocalPlayer ? 0xc9a86a : undefined,
  );

  const root = new THREE.Group();
  root.name = `Avatar_${options.playerName}`;
  root.userData.playerId = options.playerId;
  root.userData.playerName = options.playerName;
  root.userData.seatIndex = options.seatIndex;

  const coatMat = new THREE.MeshStandardMaterial({
    color: palette.coatColor,
    roughness: 0.74,
    metalness: 0.06,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: palette.coatTrimColor,
    roughness: 0.8,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: palette.skinColor,
    roughness: 0.66,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: palette.hairColor,
    roughness: 0.86,
  });
  const trouserMat = new THREE.MeshStandardMaterial({
    color: palette.trouserColor,
    roughness: 0.85,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: palette.shoeColor,
    roughness: 0.5,
    metalness: 0.14,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: palette.shirtColor,
    roughness: 0.78,
  });
  const cravatMat = new THREE.MeshStandardMaterial({
    color: palette.cravatColor,
    roughness: 0.72,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x161219,
    roughness: 0.4,
  });

  // ۱. تنه در حالت نشسته (روی تشک صندلی در ارتفاع y=0.45)
  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'avatar-body';
  torsoGroup.position.set(0, 0.78, 0.04);

  const chest = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.32, 6, 12),
    coatMat,
  );
  chest.scale.set(1.2, 1, 0.78);
  chest.castShadow = true;
  chest.receiveShadow = true;
  torsoGroup.add(chest);

  const shirtFront = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.2, 0.024),
    shirtMat,
  );
  shirtFront.position.set(0, 0.08, -0.12);
  torsoGroup.add(shirtFront);

  const cravat = new THREE.Mesh(
    new THREE.BoxGeometry(0.044, 0.13, 0.028),
    cravatMat,
  );
  cravat.position.set(0, 0.07, -0.128);
  torsoGroup.add(cravat);

  for (const side of [-1, 1] as const) {
    const lapel = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.22, 0.026),
      trimMat,
    );
    lapel.position.set(side * 0.064, 0.07, -0.124);
    lapel.rotation.z = side * 0.22;
    torsoGroup.add(lapel);

    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.074, 10, 8),
      coatMat,
    );
    shoulder.position.set(side * 0.205, 0.16, 0);
    shoulder.castShadow = true;
    torsoGroup.add(shoulder);
  }
  root.add(torsoGroup);

  // ۲. سر، گردن، صورت و مو (avatar-head)
  const headGroup = new THREE.Group();
  headGroup.name = 'avatar-head';
  headGroup.position.set(0, 1.2, 0.03);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.062, 0.11, 10),
    skinMat,
  );
  neck.position.set(0, -0.1, 0);
  headGroup.add(neck);

  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.118, 16, 14),
    skinMat,
  );
  skull.scale.set(0.92, 1.08, 0.98);
  skull.castShadow = true;
  headGroup.add(skull);

  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 8, 8),
      skinMat,
    );
    ear.scale.set(0.45, 1.1, 0.7);
    ear.position.set(side * 0.108, -0.008, 0);
    headGroup.add(ear);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      eyeMat,
    );
    eye.position.set(side * 0.04, 0.016, -0.11);
    headGroup.add(eye);
  }

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.017, 0.048, 6),
    skinMat,
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.004, -0.12);
  headGroup.add(nose);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.124, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    hairMat,
  );
  hairCap.scale.set(0.95, 1.08, 1.02);
  hairCap.position.set(0, 0.012, 0.006);
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 10),
    hairMat,
  );
  hairBack.scale.set(0.94, 1.05, 0.88);
  hairBack.position.set(0, -0.012, 0.032);
  headGroup.add(hairBack);

  root.add(headGroup);

  // ۳. بازوها و دست‌ها در حالت نشسته روی پا/دسته صندلی
  for (const side of [-1, 1] as const) {
    const armGroup = new THREE.Group();
    armGroup.name = side < 0 ? 'avatar-arm-left' : 'avatar-arm-right';
    armGroup.position.set(side * 0.22, 0.94, 0.04);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.19, 5, 10),
      coatMat,
    );
    upperArm.position.set(0, -0.11, -0.02);
    upperArm.rotation.x = 0.22;
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.18, 5, 10),
      coatMat,
    );
    forearm.position.set(-side * 0.03, -0.22, -0.14);
    forearm.rotation.x = Math.PI / 2.3;
    forearm.rotation.z = side * 0.18;
    forearm.castShadow = true;
    armGroup.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      skinMat,
    );
    hand.scale.set(0.85, 0.65, 1.2);
    hand.position.set(-side * 0.055, -0.24, -0.26);
    armGroup.add(hand);

    root.add(armGroup);
  }

  // ۴. ران‌ها (افقی روی صندلی) و ساق پاها (عمودی تا کف زمین)
  for (const side of [-1, 1] as const) {
    const legGroup = new THREE.Group();
    legGroup.name = side < 0 ? 'avatar-leg-left' : 'avatar-leg-right';

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.068, 0.24, 5, 10),
      trouserMat,
    );
    thigh.rotation.x = Math.PI / 2;
    thigh.position.set(side * 0.105, 0.51, -0.08);
    thigh.castShadow = true;
    legGroup.add(thigh);

    const calf = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.25, 5, 10),
      trouserMat,
    );
    calf.position.set(side * 0.105, 0.28, -0.25);
    calf.castShadow = true;
    legGroup.add(calf);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.065, 0.19),
      shoeMat,
    );
    shoe.position.set(side * 0.105, 0.04, -0.29);
    shoe.castShadow = true;
    legGroup.add(shoe);

    root.add(legGroup);
  }

  return root;
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

function createSeat(row: number, col: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `Seat_${row}_${col}`;

  // پایه صندلی مخملی — تناسب واقعی
  const baseGeo = new THREE.BoxGeometry(0.85, 0.45, 0.85);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a1a1a, roughness: 0.8 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.225;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const backGeo = new THREE.BoxGeometry(0.85, 0.9, 0.12);
  const backMat = new THREE.MeshStandardMaterial({ color: 0x5a2222, roughness: 0.75 });
  const back = new THREE.Mesh(backGeo, backMat);
  back.position.set(0, 0.8, -0.38);
  back.castShadow = true;
  group.add(back);

  // پلاک ردیف
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128;
  labelCanvas.height = 32;
  const ctx = labelCanvas.getContext('2d')!;
  ctx.fillStyle = '#c9a86a';
  ctx.font = 'bold 20px Vazirmatn';
  ctx.textAlign = 'center';
  ctx.fillText(`R${row} C${col}`, 64, 22);
  const tex = new THREE.CanvasTexture(labelCanvas);
  const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const labelGeo = new THREE.PlaneGeometry(0.6, 0.15);
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.set(0, 0.5, 0.43);
  group.add(label);

  return group;
}

function createAdultCharacter(
  type: 'dancer' | 'darkMan',
): THREE.Group {
  const group = new THREE.Group();
  group.name = type === 'dancer' ? 'DancerCharacter' : 'DarkManCharacter';

  const height = type === 'dancer' ? 1.72 : 1.95;
  const skinColor = type === 'dancer' ? 0xe8c4a8 : 0xd0d0d0;
  const costumeColor = type === 'dancer' ? 0xc94a4a : 0x111111;

  // تنه — تناسب بزرگسال باورپذیر (نه کارتونی)
  const torsoGeo = new THREE.CapsuleGeometry(0.28, height * 0.45, 4, 12);
  const torsoMat = new THREE.MeshStandardMaterial({ color: costumeColor, roughness: 0.7 });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = height * 0.55;
  torso.castShadow = true;
  group.add(torso);

  // سر — نسبت واقعی 1/7.5 قد
  const headGeo = new THREE.SphereGeometry(height * 0.11, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = height * 0.92;
  head.castShadow = true;
  group.add(head);

  // بازوها
  const armGeo = new THREE.CapsuleGeometry(0.08, height * 0.35, 4, 8);
  const armMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.38, height * 0.55, 0);
  leftArm.rotation.z = -0.2;
  group.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.set(0.38, height * 0.55, 0);
  rightArm.rotation.z = 0.2;
  group.add(rightArm);

  // پاها
  const legGeo = new THREE.CapsuleGeometry(0.11, height * 0.45, 4, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: type === 'dancer' ? 0xe8c4a8 : 0x222222, roughness: 0.7 });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.15, height * 0.22, 0);
  group.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.set(0.15, height * 0.22, 0);
  group.add(rightLeg);

  // دامن برای رقصنده — پف‌دار
  if (type === 'dancer') {
    const skirtGeo = new THREE.ConeGeometry(0.65, 0.6, 16, 1, true);
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xc94a4a, roughness: 0.8, side: THREE.DoubleSide });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.position.y = height * 0.35;
    skirt.rotation.x = Math.PI;
    group.add(skirt);
  }

  // کلاه/مو برای مرد سیاه‌پوش
  if (type === 'darkMan') {
    const hatGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.18, 16);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = height * 1.02;
    group.add(hat);
  }

  group.userData.height = height;
  group.userData.type = type;

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
  const seats: THREE.Group[] = [];
  const rowSpacing = 1.6;
  const colSpacing = 1.4;
  const startZ = 4; // نزدیک‌ترین ردیف به صحنه

  for (let row = 1; row <= 4; row++) {
    const rowY = (row - 1) * 0.35; // پلکانی
    const rowZ = startZ + (row - 1) * rowSpacing;
    for (let col = 1; col <= 5; col++) {
      const seat = createSeat(row, col);
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

  // لوستر
  const chandelier = new THREE.Group();
  chandelier.name = 'Chandelier';
  const chainGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.5, 6);
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, metalness: 0.8, roughness: 0.2 });
  const chain = new THREE.Mesh(chainGeo, chainMat);
  chain.position.y = 4.75;
  chandelier.add(chain);

  const crystalGeo = new THREE.OctahedronGeometry(0.6, 0);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444466, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.position.y = 3.2;
  chandelier.add(crystal);

  // نور لوستر
  const chandelierLight = new THREE.PointLight(0xffe8c0, 1.2, 12);
  chandelierLight.position.set(0, 3.2, 0);
  chandelier.add(chandelierLight);

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
  const ambient = new THREE.AmbientLight(0x666688, 0.5);
  group.add(ambient);
  lights.push(ambient);

  const moon = new THREE.DirectionalLight(0x8899cc, 0.6);
  moon.position.set(0, 8, 2);
  group.add(moon);
  lights.push(moon);

  const dispose = () => {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
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
