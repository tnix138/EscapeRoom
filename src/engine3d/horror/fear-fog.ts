'use client';

import * as THREE from 'three';

export interface FearResponsiveFogOptions {
  color?: THREE.ColorRepresentation;
  minDensity?: number;
  maxDensity?: number;
  initialFear?: number;
  smoothingSeconds?: number;
}

/** Map normalized threat intensity to a bounded exponential fog density. */
export function fearFogDensity(
  fearLevel: number,
  minDensity = 0.003,
  maxDensity = 0.038,
): number {
  if (!Number.isFinite(fearLevel) || !Number.isFinite(minDensity) || !Number.isFinite(maxDensity) ||
    minDensity < 0 || maxDensity <= minDensity) {
    throw new RangeError('Fear fog requires a finite fear level and maxDensity > minDensity >= 0.');
  }
  const fear = Math.max(0, Math.min(1, fearLevel));
  return minDensity + (maxDensity - minDensity) * fear;
}

/** Scene fog that thickens smoothly as fear rises and restores the prior fog on dispose. */
export class FearResponsiveFog {
  readonly fog: THREE.FogExp2;
  private readonly previousFog: THREE.Scene['fog'];
  private readonly smoothingSeconds: number;
  private targetDensity: number;
  private disposed = false;

  constructor(private readonly scene: THREE.Scene, options: FearResponsiveFogOptions = {}) {
    const minDensity = options.minDensity ?? 0.003;
    const maxDensity = options.maxDensity ?? 0.038;
    const initialFear = options.initialFear ?? 0;
    this.targetDensity = fearFogDensity(initialFear, minDensity, maxDensity);
    this.smoothingSeconds = Math.max(0.01, options.smoothingSeconds ?? 0.45);
    this.previousFog = scene.fog;
    this.fog = new THREE.FogExp2(options.color ?? 0x080b12, this.targetDensity);
    scene.fog = this.fog;
    this.minDensity = minDensity;
    this.maxDensity = maxDensity;
  }

  private readonly minDensity: number;
  private readonly maxDensity: number;

  setFearLevel(fearLevel: number): number {
    if (this.disposed) return this.targetDensity;
    this.targetDensity = fearFogDensity(fearLevel, this.minDensity, this.maxDensity);
    return this.targetDensity;
  }

  /** Smooth density changes with frame-rate-independent exponential easing. */
  update(deltaSeconds: number): number {
    if (this.disposed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return this.fog.density;
    const alpha = 1 - Math.exp(-deltaSeconds / this.smoothingSeconds);
    this.fog.density += (this.targetDensity - this.fog.density) * alpha;
    return this.fog.density;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.scene.fog === this.fog) this.scene.fog = this.previousFog;
  }
}
