'use client';

import * as THREE from 'three';
import type { PresenceSnapshot } from './types';

export interface RemotePlayerOptions {
  color?: number;
  eyeHeight?: number;
}

export interface PlayerHumanPalette {
  coatColor: number;
  coatTrimColor: number;
  skinColor: number;
  hairColor: number;
  trouserColor: number;
  shoeColor: number;
  shirtColor: number;
  cravatColor: number;
}

const SEAT_COAT_COLORS = [
  0x5b2a86,
  0x1f5f7a,
  0x7a1626,
  0x2e6b34,
  0x8a6a24,
  0x37474f,
  0x6d3b1f,
  0x7a2e5f,
] as const;

const SKIN_TONES = [0xe4be9c, 0xd9ad87, 0xecd0b6, 0xcf9f78, 0xe0b592] as const;
const HAIR_TONES = [0x221710, 0x3b2516, 0x151218, 0x4d311d, 0x2c221b] as const;
const CRAVAT_COLORS = [0x8b1e2f, 0xc9a86a, 0x284b63, 0x5c2751, 0x3d5a45] as const;

function hashString(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function colorFromId(id: string): number {
  const hash = hashString(id);
  // Keep the hue bright enough to distinguish silhouettes in a dark scene.
  return new THREE.Color().setHSL((hash % 360) / 360, 0.62, 0.52).getHex();
}

export function resolvePlayerHumanPalette(
  playerId: string,
  seatIndex?: number,
  colorOverride?: number,
): PlayerHumanPalette {
  const hash = hashString(playerId || 'guest');
  const index = typeof seatIndex === 'number' && Number.isInteger(seatIndex) && seatIndex >= 0
    ? seatIndex
    : hash;

  const coatColor =
    colorOverride ??
    (typeof seatIndex === 'number' && seatIndex >= 0
      ? SEAT_COAT_COLORS[seatIndex % SEAT_COAT_COLORS.length]
      : colorFromId(playerId));

  const trimColorObj = new THREE.Color(coatColor).multiplyScalar(0.68);

  return {
    coatColor,
    coatTrimColor: trimColorObj.getHex(),
    skinColor: SKIN_TONES[index % SKIN_TONES.length],
    hairColor: HAIR_TONES[(index + (hash % 3)) % HAIR_TONES.length],
    trouserColor: 0x1b1922,
    shoeColor: 0x110e14,
    shirtColor: 0xf1e6d2,
    cravatColor: CRAVAT_COLORS[index % CRAVAT_COLORS.length],
  };
}

interface RemoteNameTag {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
}

function createNameTag(label: string): RemoteNameTag | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(8, 5, 10, 0.82)';
  context.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.strokeStyle = 'rgba(214, 184, 103, 0.82)';
  context.lineWidth = 3;
  context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  context.direction = 'rtl';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 42px sans-serif';
  context.fillStyle = '#f4e4c8';
  context.fillText(label.slice(0, 28), canvas.width / 2, canvas.height / 2, canvas.width - 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.4, 0.45, 1);
  sprite.renderOrder = 2;
  return { sprite, material, texture };
}

/** Articulated Three.js human character avatar driven by received snapshots. */
export class RemotePlayer extends THREE.Group {
  readonly playerId: string;
  private readonly eyeHeight: number;
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly torsoGroup: THREE.Group;
  private readonly headGroup: THREE.Group;
  private readonly leftArmGroup: THREE.Group;
  private readonly rightArmGroup: THREE.Group;
  private readonly leftLegGroup: THREE.Group;
  private readonly rightLegGroup: THREE.Group;
  private target: PresenceSnapshot['transform'];
  private targetTimestamp = -Infinity;
  private walkPhase = 0;
  private idlePhase = 0;
  private strideBlend = 0;

  constructor(snapshot: PresenceSnapshot, options: RemotePlayerOptions = {}) {
    super();
    this.playerId = snapshot.playerId;
    this.eyeHeight = options.eyeHeight ?? 1.65;
    this.target = { ...snapshot.transform };
    this.targetTimestamp = snapshot.updatedAt;
    this.name = `RemotePlayer:${snapshot.playerId}`;

    const palette = resolvePlayerHumanPalette(
      snapshot.playerId,
      snapshot.seatIndex,
      options.color,
    );

    const coatMaterial = new THREE.MeshStandardMaterial({
      color: palette.coatColor,
      roughness: 0.76,
      metalness: 0.05,
    });
    const coatTrimMaterial = new THREE.MeshStandardMaterial({
      color: palette.coatTrimColor,
      roughness: 0.82,
      metalness: 0.04,
    });
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: palette.skinColor,
      roughness: 0.68,
      metalness: 0.02,
    });
    const hairMaterial = new THREE.MeshStandardMaterial({
      color: palette.hairColor,
      roughness: 0.88,
      metalness: 0.02,
    });
    const trouserMaterial = new THREE.MeshStandardMaterial({
      color: palette.trouserColor,
      roughness: 0.86,
      metalness: 0.03,
    });
    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: palette.shoeColor,
      roughness: 0.52,
      metalness: 0.14,
    });
    const shirtMaterial = new THREE.MeshStandardMaterial({
      color: palette.shirtColor,
      roughness: 0.78,
    });
    const cravatMaterial = new THREE.MeshStandardMaterial({
      color: palette.cravatColor,
      roughness: 0.72,
    });
    const eyeDarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x161219,
      roughness: 0.4,
    });
    const badgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af63,
      emissive: 0x6e531f,
      emissiveIntensity: 0.45,
      roughness: 0.32,
      metalness: 0.75,
    });

    this.materials.push(
      coatMaterial,
      coatTrimMaterial,
      skinMaterial,
      hairMaterial,
      trouserMaterial,
      shoeMaterial,
      shirtMaterial,
      cravatMaterial,
      eyeDarkMaterial,
      badgeMaterial,
    );

    // ─── ۱. تنه، کت تئاتر، یقه و دستمال گردن (avatar-body) ───
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.name = 'avatar-body';
    this.torsoGroup.position.set(0, 1.08, 0);

    const chestMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.165, 0.34, 6, 12),
      coatMaterial,
    );
    chestMesh.scale.set(1.22, 1, 0.78);
    chestMesh.position.set(0, 0.05, 0);
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    this.torsoGroup.add(chestMesh);

    const coatSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.215, 0.28, 12),
      coatMaterial,
    );
    coatSkirt.scale.set(1.12, 1, 0.8);
    coatSkirt.position.set(0, -0.2, 0);
    coatSkirt.castShadow = true;
    coatSkirt.receiveShadow = true;
    this.torsoGroup.add(coatSkirt);

    // پیراهن و کراوات/دستمال گردن در جلوی سینه (-Z جهت نگاه است)
    const shirtFront = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 0.025),
      shirtMaterial,
    );
    shirtFront.position.set(0, 0.14, -0.125);
    this.torsoGroup.add(shirtFront);

    const cravat = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.14, 0.03),
      cravatMaterial,
    );
    cravat.position.set(0, 0.13, -0.132);
    this.torsoGroup.add(cravat);

    // یقه برگردان کت (چپ و راست)
    for (const side of [-1, 1] as const) {
      const lapel = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.24, 0.028),
        coatTrimMaterial,
      );
      lapel.position.set(side * 0.068, 0.13, -0.128);
      lapel.rotation.z = side * 0.22;
      this.torsoGroup.add(lapel);

      const shoulder = new THREE.Mesh(
        new THREE.SphereGeometry(0.078, 10, 8),
        coatMaterial,
      );
      shoulder.position.set(side * 0.215, 0.22, 0);
      shoulder.castShadow = true;
      this.torsoGroup.add(shoulder);
    }

    // سنجاق طلایی بلیط تئاتر روی سینه چپ
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.024, 0.015),
      badgeMaterial,
    );
    badge.position.set(-0.095, 0.16, -0.138);
    this.torsoGroup.add(badge);

    this.add(this.torsoGroup);

    // ─── ۲. سر، گردن، اجزای صورت و مو (avatar-head) ───
    this.headGroup = new THREE.Group();
    this.headGroup.name = 'avatar-head';
    this.headGroup.position.set(0, 1.53, 0);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.12, 10),
      skinMaterial,
    );
    neck.position.set(0, -0.11, 0);
    neck.castShadow = true;
    this.headGroup.add(neck);

    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.122, 16, 14),
      skinMaterial,
    );
    skull.scale.set(0.92, 1.08, 0.98);
    skull.castShadow = true;
    skull.receiveShadow = true;
    this.headGroup.add(skull);

    const jaw = new THREE.Mesh(
      new THREE.SphereGeometry(0.088, 12, 10),
      skinMaterial,
    );
    jaw.scale.set(0.9, 0.85, 0.88);
    jaw.position.set(0, -0.042, -0.014);
    this.headGroup.add(jaw);

    // گوش‌ها
    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 8, 8),
        skinMaterial,
      );
      ear.scale.set(0.45, 1.1, 0.7);
      ear.position.set(side * 0.112, -0.008, 0);
      this.headGroup.add(ear);
    }

    // بینی
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.052, 6),
      skinMaterial,
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, -0.004, -0.124);
    this.headGroup.add(nose);

    // چشم‌ها و ابروها
    for (const side of [-1, 1] as const) {
      const eyeWhite = new THREE.Mesh(
        new THREE.SphereGeometry(0.017, 8, 8),
        shirtMaterial,
      );
      eyeWhite.scale.set(1.15, 0.85, 0.55);
      eyeWhite.position.set(side * 0.042, 0.018, -0.108);
      this.headGroup.add(eyeWhite);

      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 8, 8),
        eyeDarkMaterial,
      );
      pupil.position.set(side * 0.042, 0.018, -0.116);
      this.headGroup.add(pupil);

      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.008, 0.012),
        hairMaterial,
      );
      brow.position.set(side * 0.042, 0.042, -0.112);
      brow.rotation.z = side * -0.08;
      this.headGroup.add(brow);
    }

    // لب‌ها
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.009, 0.01),
      cravatMaterial,
    );
    mouth.position.set(0, -0.052, -0.108);
    this.headGroup.add(mouth);

    // موهای سر (کلاهک بالا + حجم پشت سر و شقیقه‌ها)
    const hairGroup = new THREE.Group();
    hairGroup.name = 'avatar-hair';

    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.129, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMaterial,
    );
    hairCap.scale.set(0.95, 1.08, 1.02);
    hairCap.position.set(0, 0.012, 0.005);
    hairCap.castShadow = true;
    hairGroup.add(hairCap);

    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 12, 10),
      hairMaterial,
    );
    hairBack.scale.set(0.94, 1.05, 0.88);
    hairBack.position.set(0, -0.01, 0.032);
    hairGroup.add(hairBack);

    const hairFringe = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.038, 0.055),
      hairMaterial,
    );
    hairFringe.position.set(0, 0.078, -0.088);
    hairFringe.rotation.x = 0.25;
    hairGroup.add(hairFringe);

    this.headGroup.add(hairGroup);
    this.add(this.headGroup);

    // ─── ۳. دست‌های مفصل‌دار چپ و راست (avatar-arm-left / avatar-arm-right) ───
    const createArm = (side: -1 | 1, name: string): THREE.Group => {
      const armRoot = new THREE.Group();
      armRoot.name = name;
      armRoot.position.set(side * 0.235, 1.31, 0);

      const upperArm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.052, 0.21, 5, 10),
        coatMaterial,
      );
      upperArm.position.set(0, -0.13, 0);
      upperArm.castShadow = true;
      armRoot.add(upperArm);

      const forearm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.045, 0.19, 5, 10),
        coatMaterial,
      );
      forearm.position.set(0, -0.34, -0.02);
      forearm.rotation.x = 0.14;
      forearm.castShadow = true;
      armRoot.add(forearm);

      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.046, 0.046, 0.035, 10),
        shirtMaterial,
      );
      cuff.position.set(0, -0.45, -0.035);
      armRoot.add(cuff);

      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.044, 10, 8),
        skinMaterial,
      );
      hand.scale.set(0.78, 1.25, 0.58);
      hand.position.set(0, -0.505, -0.042);
      hand.castShadow = true;
      armRoot.add(hand);

      return armRoot;
    };

    this.leftArmGroup = createArm(-1, 'avatar-arm-left');
    this.rightArmGroup = createArm(1, 'avatar-arm-right');
    this.add(this.leftArmGroup, this.rightArmGroup);

    // ─── ۴. پاهای مفصل‌دار چپ و راست + کفش (avatar-leg-left / avatar-leg-right) ───
    const createLeg = (side: -1 | 1, name: string): THREE.Group => {
      const legRoot = new THREE.Group();
      legRoot.name = name;
      legRoot.position.set(side * 0.1, 0.78, 0);

      const thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.072, 0.27, 5, 10),
        trouserMaterial,
      );
      thigh.position.set(0, -0.18, 0);
      thigh.castShadow = true;
      legRoot.add(thigh);

      const calf = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.058, 0.27, 5, 10),
        trouserMaterial,
      );
      calf.position.set(0, -0.49, 0);
      calf.castShadow = true;
      legRoot.add(calf);

      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.095, 0.068, 0.21),
        shoeMaterial,
      );
      shoe.position.set(0, -0.746, -0.035);
      shoe.castShadow = true;
      shoe.receiveShadow = true;
      legRoot.add(shoe);

      return legRoot;
    };

    this.leftLegGroup = createLeg(-1, 'avatar-leg-left');
    this.rightLegGroup = createLeg(1, 'avatar-leg-right');
    this.add(this.leftLegGroup, this.rightLegGroup);

    // ─── ۵. برچسب نام بالای سر (avatar-name) ───
    const displayName = snapshot.playerName?.trim() || snapshot.playerId;
    this.userData.displayName = displayName;
    const nameTag = createNameTag(displayName);
    if (nameTag) {
      nameTag.sprite.position.y = 2.08;
      nameTag.sprite.name = 'avatar-name';
      this.add(nameTag.sprite);
      this.materials.push(nameTag.material);
      this.textures.push(nameTag.texture);
    }

    this.applyTransform(this.target);
  }

  setSnapshot(snapshot: PresenceSnapshot): void {
    if (snapshot.playerId !== this.playerId || snapshot.updatedAt < this.targetTimestamp) return;
    this.target = { ...snapshot.transform };
    this.targetTimestamp = snapshot.updatedAt;
    this.userData.displayName = snapshot.playerName?.trim() || snapshot.playerId;
  }

  /** Smooth toward the latest network state and animate human walk/idle cycle. */
  update(deltaSeconds: number): void {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.25));
    const alpha = 1 - Math.exp(-12 * dt);
    const targetY = this.target.y - this.eyeHeight;

    const prevX = this.position.x;
    const prevZ = this.position.z;

    this.position.x += (this.target.x - this.position.x) * alpha;
    this.position.y += (targetY - this.position.y) * alpha;
    this.position.z += (this.target.z - this.position.z) * alpha;

    const targetYaw = THREE.MathUtils.degToRad(this.target.yawDeg);
    const yawDelta =
      THREE.MathUtils.euclideanModulo(targetYaw - this.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    this.rotation.y = THREE.MathUtils.euclideanModulo(
      this.rotation.y + yawDelta * alpha,
      Math.PI * 2,
    );

    // انیمیشن گام‌برداری و تنفس طبیعی انسان
    const stepDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
    const speed = dt > 1e-4 ? stepDist / dt : 0;
    const targetStride = Math.min(1, speed / 2.2);
    this.strideBlend += (targetStride - this.strideBlend) * Math.min(1, dt * 10);

    this.walkPhase += stepDist * 4.2 + dt * this.strideBlend * 6.5;
    this.idlePhase += dt * 2.1;

    const legSwing = Math.sin(this.walkPhase) * 0.58 * this.strideBlend;
    const armSwing = Math.sin(this.walkPhase) * 0.46 * this.strideBlend;
    const idleSway = Math.sin(this.idlePhase) * 0.025 * (1 - this.strideBlend);
    const breathOffset = Math.sin(this.idlePhase * 1.3) * 0.008;
    const walkBounce = Math.abs(Math.cos(this.walkPhase)) * 0.028 * this.strideBlend;

    this.leftLegGroup.rotation.x = legSwing;
    this.rightLegGroup.rotation.x = -legSwing;

    this.leftArmGroup.rotation.x = -armSwing;
    this.rightArmGroup.rotation.x = armSwing;
    this.leftArmGroup.rotation.z = -0.04 - Math.abs( Math.sin(this.idlePhase) ) * 0.015;
    this.rightArmGroup.rotation.z = 0.04 + Math.abs( Math.sin(this.idlePhase) ) * 0.015;

    this.torsoGroup.position.y = 1.08 + breathOffset + walkBounce;
    this.torsoGroup.rotation.z = idleSway;

    const pitchRad = THREE.MathUtils.degToRad(
      Math.max(-25, Math.min(25, this.target.pitchDeg ?? 0)),
    );
    this.headGroup.position.y = 1.53 + breathOffset + walkBounce;
    this.headGroup.rotation.x = pitchRad * 0.6;
  }

  private applyTransform(transform: PresenceSnapshot['transform']): void {
    this.position.set(transform.x, transform.y - this.eyeHeight, transform.z);
    this.rotation.y = THREE.MathUtils.degToRad(transform.yawDeg);
  }

  dispose(): void {
    this.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.clear();
  }
}
