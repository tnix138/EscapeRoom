'use client';

import * as THREE from 'three';
import type { PresenceSnapshot } from './types';

export interface RemotePlayerOptions {
  color?: number;
  eyeHeight?: number;
}

function colorFromId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  // Keep the hue bright enough to distinguish silhouettes in a dark scene.
  return new THREE.Color().setHSL(((hash >>> 0) % 360) / 360, 0.62, 0.62).getHex();
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

/** Lightweight Three.js avatar driven by received snapshots; no React Three Fiber required. */
export class RemotePlayer extends THREE.Group {
  readonly playerId: string;
  private readonly eyeHeight: number;
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private target: PresenceSnapshot['transform'];

  constructor(snapshot: PresenceSnapshot, options: RemotePlayerOptions = {}) {
    super();
    this.playerId = snapshot.playerId;
    this.eyeHeight = options.eyeHeight ?? 1.65;
    this.target = { ...snapshot.transform };
    this.targetTimestamp = snapshot.updatedAt;
    this.name = `RemotePlayer:${snapshot.playerId}`;

    const material = new THREE.MeshStandardMaterial({
      color: options.color ?? colorFromId(snapshot.playerId),
      roughness: 0.82,
      metalness: 0.02,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x17151b, roughness: 0.95 });
    this.materials.push(material, darkMaterial);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 3, 7), material);
    body.position.y = 0.82;
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = 'avatar-body';
    this.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), darkMaterial);
    head.position.y = 1.48;
    head.castShadow = true;
    head.name = 'avatar-head';
    this.add(head);

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

  private targetTimestamp = -Infinity;

  /** Smooth toward the latest network state; call once per rendered frame. */
  update(deltaSeconds: number): void {
    const alpha = 1 - Math.exp(-12 * Math.max(0, Math.min(deltaSeconds, 0.25)));
    const targetY = this.target.y - this.eyeHeight;
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
