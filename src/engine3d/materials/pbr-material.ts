'use client';

import * as THREE from 'three';

export interface PBRMaterialOptions extends THREE.MeshStandardMaterialParameters {
  /** Disable shadowing via AO when the mesh does not have UV2. */
  aoMapIntensity?: number;
}

/** MeshStandardMaterial preset with physically-based defaults for worn environments. */
export class PBRMaterial extends THREE.MeshStandardMaterial {
  constructor(options: PBRMaterialOptions = {}) {
    super({
      roughness: 0.78,
      metalness: 0.08,
      aoMapIntensity: 0.8,
      ...options,
    });
    this.name = options.name ?? 'PBRMaterial';
  }
}
