'use client';

// src/engine3d/presence/RemotePlayer.ts — آواتار بازیکن راه دور روی اسکلت انسانِ واقعی
//
// قرارداد عمومی این کلاس تغییر نکرده است (position/yaw، setSnapshot، update، dispose)
// تا سالن، کوچه و HUD بدون تغییر کار کنند؛ اما بدنهٔ آواتار حالا از HumanAvatar
// می‌آید: جمجمهٔ مجسمه‌شده، چشمِ پلک‌زن، موی تاربه‌تار و گام‌برداری با زانو.
//
// نگاشت ارتفاع: شبکهٔ حضور یک نقطهٔ «چشم» (y ≈ ۱٫۶۵) می‌فرستد؛ آواتار از کف پا
// ساخته می‌شود، پس همیشه eyeHeight از y کم می‌شود. اگر قد کاراکتر کوتاه‌تر/بلندتر
// باشد، HumanAvatar خودش را حول کف پا مقیاس می‌کند و این قرارداد نمی‌شکند.

import * as THREE from 'three';
import { HumanAvatar } from '@/engine3d/characters/human-avatar';
import { resolveHumanLook } from '@/engine3d/characters/human-presets';
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
  return new THREE.Color().setHSL((hash % 360) / 360, 0.62, 0.52).getHex();
}

/** پالت پایه؛ هنوز برای HUD/پیش‌نمایش‌های دوبعدی و سازگاری استفاده می‌شود */
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

  return {
    coatColor,
    coatTrimColor: new THREE.Color(coatColor).multiplyScalar(0.68).getHex(),
    skinColor: SKIN_TONES[index % SKIN_TONES.length]!,
    hairColor: HAIR_TONES[(index + (hash % 3)) % HAIR_TONES.length]!,
    trouserColor: 0x1b1922,
    shoeColor: 0x110e14,
    shirtColor: 0xf1e6d2,
    cravatColor: CRAVAT_COLORS[index % CRAVAT_COLORS.length]!,
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
  const backdrop = context.createLinearGradient(0, 0, 0, canvas.height);
  backdrop.addColorStop(0, 'rgba(14, 9, 16, 0.78)');
  backdrop.addColorStop(1, 'rgba(8, 5, 10, 0.88)');
  context.fillStyle = backdrop;
  context.fillRect(6, 6, canvas.width - 12, canvas.height - 12);
  context.strokeStyle = 'rgba(214, 184, 103, 0.85)';
  context.lineWidth = 3;
  context.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
  context.direction = 'rtl';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 40px sans-serif';
  context.fillStyle = '#f4e4c8';
  context.shadowColor = 'rgba(212, 175, 99, 0.65)';
  context.shadowBlur = 10;
  context.fillText(label.slice(0, 28), canvas.width / 2, canvas.height / 2 + 2, canvas.width - 40);

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
  sprite.scale.set(0.72, 0.135, 1);
  sprite.center.set(0.5, 0);
  sprite.position.y = 1.92;
  sprite.renderOrder = 3;
  return { sprite, material, texture };
}

/** آواتار انسانِ راه دور؛ موقعیت شبکه را نرم می‌کند و آواتار را زنده نگه می‌دارد. */
export class RemotePlayer extends THREE.Group {
  readonly playerId: string;
  readonly avatar: HumanAvatar;
  private readonly eyeHeight: number;
  private readonly nameTag: RemoteNameTag | null = null;
  private target: PresenceSnapshot['transform'];
  private targetTimestamp = -Infinity;
  private smoothedSpeed = 0;
  private lastYaw = 0;

  constructor(snapshot: PresenceSnapshot, options: RemotePlayerOptions = {}) {
    super();
    this.playerId = snapshot.playerId;
    this.target = { ...snapshot.transform };
    this.targetTimestamp = snapshot.updatedAt;
    this.name = `RemotePlayer:${snapshot.playerId}`;

    const displayName = snapshot.playerName?.trim() || snapshot.playerId;
    const look = resolveHumanLook(snapshot.playerId, snapshot.seatIndex, { name: displayName });
    if (typeof options.color === 'number') {
      look.coatHex = options.color;
    }

    this.avatar = new HumanAvatar({ look, displayName });
    this.eyeHeight = options.eyeHeight ?? this.avatar.eyeHeight;
    this.userData.displayName = displayName;
    this.userData.seatIndex = snapshot.seatIndex;
    this.add(this.avatar);

    this.nameTag = createNameTag(displayName);
    if (this.nameTag) {
      this.nameTag.sprite.position.y = Math.max(1.86, this.avatar.standingHeight + 0.08);
      this.add(this.nameTag.sprite);
    }

    this.applyTransform(this.target);
    this.lastYaw = this.rotation.y;
  }

  /** ارتفاع چشم این آواتار از کف پا (متر) */
  getEyeHeight(): number {
    return this.eyeHeight;
  }

  /** مختصات دقیق نقطهٔ میانی دو چشم این بازیکن در فضای جهان */
  getEyeWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.avatar.getEyeWorldPosition(target);
  }

  setSnapshot(snapshot: PresenceSnapshot): void {
    if (snapshot.playerId !== this.playerId || snapshot.updatedAt < this.targetTimestamp) return;
    this.target = { ...snapshot.transform };
    this.targetTimestamp = snapshot.updatedAt;
    if (snapshot.playerName?.trim()) this.userData.displayName = snapshot.playerName.trim();
  }

  /** نرم‌سازی موقعیت/چرخش و انتقال سرعت واقعی به لایهٔ انیمیشن انسان */
  update(deltaSeconds: number): void {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.25));
    if (dt <= 0) return;
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

    const stepDist = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
    const instantSpeed = dt > 1e-4 ? stepDist / dt : 0;
    this.smoothedSpeed += (instantSpeed - this.smoothedSpeed) * Math.min(1, dt * 8);
    const yawRate = dt > 1e-4 ? (this.rotation.y - this.lastYaw) / dt : 0;
    this.lastYaw = this.rotation.y;

    this.avatar.update(dt, {
      speed: this.smoothedSpeed,
      pitchDeg: this.target.pitchDeg ?? 0,
      yawRate,
    });
  }

  /** پلک‌زدن دستی برای برش‌های سینمایی/جامپ‌اسکر */
  blink(): void {
    this.avatar.blink();
  }

  private applyTransform(transform: PresenceSnapshot['transform']): void {
    this.position.set(transform.x, transform.y - this.eyeHeight, transform.z);
    this.rotation.y = THREE.MathUtils.degToRad(transform.yawDeg);
  }

  dispose(): void {
    this.avatar.dispose();
    if (this.nameTag) {
      this.nameTag.material.dispose();
      this.nameTag.texture.dispose();
    }
    this.clear();
  }
}
