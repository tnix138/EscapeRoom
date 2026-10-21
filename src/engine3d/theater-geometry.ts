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
