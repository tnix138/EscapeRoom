import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PBRMaterial } from '../../src/engine3d/materials/pbr-material';
import { ProceduralTextures } from '../../src/engine3d/materials/procedural-textures';
import {
  createWetEnvironmentMap,
  WetSurfaceMaterial,
} from '../../src/engine3d/materials/wet-surface-material';

function dataOf(texture: THREE.DataTexture): Uint8Array {
  return texture.image.data as Uint8Array;
}

describe('فاز ۰۶ — مواد PBR و بافت رویه‌ای', () => {
  it('چهار نقشهٔ بافت رویه‌ای معتبر برای متریال می‌سازد', () => {
    const maps = ProceduralTextures.createSurfaceMaps({ size: 32, seed: 99 });
    for (const texture of [maps.colorMap, maps.normalMap, maps.roughnessMap, maps.aoMap]) {
      expect(texture).toBeInstanceOf(THREE.DataTexture);
      expect(texture.image.width).toBe(32);
      expect(texture.image.height).toBe(32);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.RepeatWrapping);
      expect(dataOf(texture)).toHaveLength(32 * 32 * 4);
    }
    expect(maps.colorMap.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(maps.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(maps.colorMap.repeat.x).toBe(3);
    expect(maps.normalMap.version).toBeGreaterThan(0);
    maps.dispose();
    maps.dispose();
  });

  it('بافت‌ها با seed یکسان تکرارپذیر و نقشهٔ نرمال غیریکسان از سطح تخت است', () => {
    const first = ProceduralTextures.createSurfaceMaps({ size: 32, seed: 123 });
    const second = ProceduralTextures.createSurfaceMaps({ size: 32, seed: 123 });
    expect(dataOf(first.colorMap)).toEqual(dataOf(second.colorMap));
    expect(dataOf(first.normalMap)).toEqual(dataOf(second.normalMap));
    expect(new Set(dataOf(first.normalMap)).size).toBeGreaterThan(2);
    first.dispose();
    second.dispose();
  });

  it('PBRMaterial نقشه‌های PBR و normalScale را می‌پذیرد', () => {
    const maps = ProceduralTextures.createSurfaceMaps({ size: 16 });
    const material = new PBRMaterial({
      map: maps.colorMap,
      normalMap: maps.normalMap,
      roughnessMap: maps.roughnessMap,
      aoMap: maps.aoMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
    });
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.map).toBe(maps.colorMap);
    expect(material.normalMap).toBe(maps.normalMap);
    expect(material.roughness).toBe(0.78);
    expect(material.normalScale.x).toBe(0.7);
    material.dispose();
    maps.dispose();
  });

  it('WetSurfaceMaterial بازتاب، roughness کم و clearcoat دارد', () => {
    const material = new WetSurfaceMaterial({ environmentSize: { width: 64, height: 32 } });
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.envMap).toBeInstanceOf(THREE.DataTexture);
    expect(material.envMap?.mapping).toBe(THREE.EquirectangularReflectionMapping);
    expect(material.roughness).toBe(0.14);
    expect(material.clearcoat).toBe(1);
    expect(material.envMapIntensity).toBe(1.35);
    material.dispose();
  });

  it('می‌تواند environment map سفارشی را برای سطوح خیس بگیرد', () => {
    const environment = createWetEnvironmentMap({ width: 32, height: 16 });
    const material = new WetSurfaceMaterial({ environmentMap: environment, environmentIntensity: 2 });
    expect(material.envMap).toBe(environment);
    expect(material.envMapIntensity).toBe(2);
    material.dispose();
    // متریال نقشهٔ ارائه‌شده توسط مصرف‌کننده را مالک نیست.
    expect(environment.image.width).toBe(32);
    environment.dispose();
  });
});
