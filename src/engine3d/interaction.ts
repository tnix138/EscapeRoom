'use client';

/**
 * interaction.ts — هدف‌گیری و تعامل سه‌بعدی (علیرضا — موج ۶)
 * - raycast از مرکز دوربین (کراس‌هیر)
 * - range check
 * - highlight و trigger برای clue/door/ticket
 * - فقط درخواست UI/API توافق‌شده را فرامی‌خواند — بدون منطق پازل در کلاینت
 */

import * as THREE from 'three';
import type { AlleyAnchors } from './types';

export interface InteractableObject {
  id: keyof AlleyAnchors | 'ticket' | 'chat';
  mesh: THREE.Object3D;
  range: number;
  labelFa: string;
}

export interface InteractionHit {
  id: InteractableObject['id'];
  distance: number;
  point: THREE.Vector3;
}

export class InteractionSystem {
  private raycaster = new THREE.Raycaster();
  private readonly camera: THREE.Camera;
  private readonly interactables: InteractableObject[] = [];
  private lastHit: InteractionHit | null = null;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
  }

  addInteractable(obj: InteractableObject): void {
    this.interactables.push(obj);
  }

  clear(): void {
    this.interactables.length = 0;
  }

  /**
   * بررسی هدف‌گیری از مرکز صفحه
   */
  update(): InteractionHit | null {
    // ray از مرکز دوربین به جلو
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.position, dir);

    const meshes = this.interactables.map((i) => i.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length === 0) {
      this.lastHit = null;
      return null;
    }

    const first = intersects[0];
    const found = this.interactables.find((it) => {
      let obj: THREE.Object3D | null = first.object;
      while (obj) {
        if (obj === it.mesh) return true;
        obj = obj.parent;
      }
      return false;
    });

    if (!found) {
      this.lastHit = null;
      return null;
    }

    if (first.distance > found.range) {
      this.lastHit = null;
      return null;
    }

    const hit: InteractionHit = {
      id: found.id,
      distance: first.distance,
      point: first.point.clone(),
    };
    this.lastHit = hit;
    return hit;
  }

  getLastHit(): InteractionHit | null {
    return this.lastHit;
  }
}

/**
 * محاسبه فاصله ساده بین دو نقطه سه‌بعدی (بدون Three برای تست)
 */
export function distance3D(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function isInInteractionRange(
  playerPos: { x: number; y: number; z: number },
  anchorPos: { x: number; y: number; z: number },
  maxRange = 3.0,
): boolean {
  return distance3D(playerPos, anchorPos) <= maxRange;
}
