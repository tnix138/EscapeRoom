'use client';

import * as THREE from 'three';

export interface ProceduralTextureOptions {
  size?: number;
  seed?: number;
  baseColor?: THREE.ColorRepresentation;
  repeat?: { x?: number; y?: number };
  normalStrength?: number;
  anisotropy?: number;
}

export interface ProceduralSurfaceMaps {
  readonly colorMap: THREE.DataTexture;
  readonly normalMap: THREE.DataTexture;
  readonly roughnessMap: THREE.DataTexture;
  readonly aoMap: THREE.DataTexture;
  dispose(): void;
}

/** Deterministic, browser-independent procedural PBR maps backed by compact DataTextures. */
export class ProceduralTextures {
  static createSurfaceMaps(options: ProceduralTextureOptions = {}): ProceduralSurfaceMaps {
    const size = normalizeSize(options.size ?? 128);
    const random = createRandom(options.seed ?? 13_371);
    const pixelCount = size * size;
    const heights = new Float32Array(pixelCount);
    const colorData = new Uint8Array(pixelCount * 4);
    const normalData = new Uint8Array(pixelCount * 4);
    const roughnessData = new Uint8Array(pixelCount * 4);
    const aoData = new Uint8Array(pixelCount * 4);

    const baseColor = new THREE.Color(options.baseColor ?? 0x77736b).getHex(THREE.SRGBColorSpace);
    const baseR = (baseColor >> 16) & 0xff;
    const baseG = (baseColor >> 8) & 0xff;
    const baseB = baseColor & 0xff;
    const normalStrength = clamp(finiteOr(options.normalStrength, 3.5), 0, 16);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const index = y * size + x;
        const grain = random() - 0.5;
        const broad = Math.sin(u * Math.PI * 8 + Math.sin(v * Math.PI * 4)) * 0.11 +
          Math.cos(v * Math.PI * 6 + u * Math.PI * 2) * 0.08;
        const height = clamp(0.5 + broad + grain * 0.12, 0, 1);
        heights[index] = height;

        const colorNoise = Math.round((height - 0.5) * 42 + grain * 15);
        writeGrayRgba(colorData, index, [
          clampByte(baseR + colorNoise),
          clampByte(baseG + colorNoise),
          clampByte(baseB + colorNoise),
        ]);

        const roughness = clampByte(176 + Math.round((random() - 0.5) * 54 + height * 18));
        writeGrayRgba(roughnessData, index, [roughness, roughness, roughness]);

        const occlusion = clampByte(222 - Math.round(Math.abs(height - 0.5) * 95 + random() * 22));
        writeGrayRgba(aoData, index, [occlusion, occlusion, occlusion]);
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const left = heights[y * size + (x + size - 1) % size];
        const right = heights[y * size + (x + 1) % size];
        const up = heights[((y + size - 1) % size) * size + x];
        const down = heights[((y + 1) % size) * size + x];
        const nx = (left - right) * normalStrength;
        const ny = (up - down) * normalStrength;
        const inverseLength = 1 / Math.hypot(nx, ny, 1);
        const index = y * size + x;
        writeGrayRgba(normalData, index, [
          clampByte((nx * inverseLength * 0.5 + 0.5) * 255),
          clampByte((ny * inverseLength * 0.5 + 0.5) * 255),
          clampByte((inverseLength * 0.5 + 0.5) * 255),
        ]);
      }
    }

    const repeatX = Math.max(0.01, finiteOr(options.repeat?.x, 3));
    const repeatY = Math.max(0.01, finiteOr(options.repeat?.y, 3));
    const anisotropy = Math.max(1, Math.min(8, Math.round(finiteOr(options.anisotropy, 4))));
    const colorMap = createDataTexture(colorData, size, true, repeatX, repeatY, anisotropy);
    const normalMap = createDataTexture(normalData, size, false, repeatX, repeatY, anisotropy);
    const roughnessMap = createDataTexture(roughnessData, size, false, repeatX, repeatY, anisotropy);
    const aoMap = createDataTexture(aoData, size, false, repeatX, repeatY, anisotropy);
    let disposed = false;

    return {
      colorMap,
      normalMap,
      roughnessMap,
      aoMap,
      dispose() {
        if (disposed) return;
        disposed = true;
        colorMap.dispose();
        normalMap.dispose();
        roughnessMap.dispose();
        aoMap.dispose();
      },
    };
  }
}

function createDataTexture(
  data: Uint8Array,
  size: number,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function writeGrayRgba(target: Uint8Array, pixelIndex: number, rgb: readonly [number, number, number]): void {
  const offset = pixelIndex * 4;
  target[offset] = rgb[0];
  target[offset + 1] = rgb[1];
  target[offset + 2] = rgb[2];
  target[offset + 3] = 255;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function normalizeSize(size: number): number {
  if (!Number.isFinite(size)) return 128;
  const bounded = Math.max(16, Math.min(512, Math.round(size)));
  return 2 ** Math.round(Math.log2(bounded));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}
