'use client';

import * as THREE from 'three';

export interface WetSurfaceMaterialOptions extends Omit<THREE.MeshPhysicalMaterialParameters, 'envMap'> {
  /** Equirectangular environment map; generated wet-room reflections are used by default. */
  environmentMap?: THREE.Texture;
  environmentIntensity?: number;
  environmentSize?: { width?: number; height?: number };
}

/**
 * Physically-based wet surface with clearcoat and an equirectangular reflection map.
 * The built-in low-resolution environment map avoids requiring a WebGL PMREM generator.
 */
export class WetSurfaceMaterial extends THREE.MeshPhysicalMaterial {
  private readonly ownsEnvironmentMap: boolean;

  constructor(options: WetSurfaceMaterialOptions = {}) {
    const {
      environmentMap,
      environmentIntensity = 1.35,
      environmentSize,
      ...materialOptions
    } = options;
    const generatedMap = environmentMap ? null : createWetEnvironmentMap(environmentSize);
    super({
      roughness: 0.14,
      metalness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMap: environmentMap ?? generatedMap,
      envMapIntensity: environmentIntensity,
      ...materialOptions,
    });
    this.ownsEnvironmentMap = generatedMap !== null;
    this.name = options.name ?? 'WetSurfaceMaterial';
  }

  override dispose(): void {
    const map = this.envMap;
    super.dispose();
    if (this.ownsEnvironmentMap) map?.dispose();
  }
}

export function createWetEnvironmentMap(
  size: { width?: number; height?: number } = {},
): THREE.DataTexture {
  const width = clampInteger(size.width ?? 128, 32, 512);
  const height = clampInteger(size.height ?? width / 2, 16, 256);
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const horizon = Math.exp(-Math.pow((v - 0.48) * 8, 2));
      const ceiling = Math.max(0, 1 - v * 1.2);
      const warmLamp = Math.exp(-Math.pow((u - 0.22) * 38, 2) - Math.pow((v - 0.38) * 22, 2));
      const coldLamp = Math.exp(-Math.pow((u - 0.76) * 48, 2) - Math.pow((v - 0.3) * 25, 2));
      const offset = (y * width + x) * 4;
      data[offset] = byte(9 + ceiling * 14 + horizon * 17 + warmLamp * 235 + coldLamp * 145);
      data[offset + 1] = byte(11 + ceiling * 17 + horizon * 21 + warmLamp * 111 + coldLamp * 177);
      data[offset + 2] = byte(18 + ceiling * 27 + horizon * 30 + warmLamp * 58 + coldLamp * 255);
      data[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'ProceduralWetSurfaceEnvironment';
  return texture;
}

function clampInteger(value: number, min: number, max: number): number {
  const safe = Number.isFinite(value) ? Math.round(value) : min;
  return Math.max(min, Math.min(max, safe));
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
