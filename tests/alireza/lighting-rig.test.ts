import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  configureSoftShadows,
  createLightingRig,
} from '../../src/engine3d/lighting/lighting-rig';

describe('فاز ۰۵ — نورپردازی و مه', () => {
  it('نورهای ambient، directional، point و spot را به صحنه اضافه می‌کند', () => {
    const scene = new THREE.Scene();
    const rig = createLightingRig(scene);
    expect(rig.ambient).toBeInstanceOf(THREE.AmbientLight);
    expect(rig.directional).toBeInstanceOf(THREE.DirectionalLight);
    expect(rig.point).toBeInstanceOf(THREE.PointLight);
    expect(rig.spot).toBeInstanceOf(THREE.SpotLight);
    expect(scene.children).toContain(rig.group);
    expect(rig.directional.castShadow).toBe(true);
    expect(rig.directional.shadow.mapSize.width).toBe(1024);
    expect(rig.point.castShadow).toBe(false);
    rig.dispose();
    expect(scene.children).not.toContain(rig.group);
  });

  it('مه خطی را با بازه near/far تنظیم و هنگام dispose بازیابی می‌کند', () => {
    const scene = new THREE.Scene();
    const originalFog = new THREE.Fog(0xffffff, 2, 90);
    scene.fog = originalFog;
    const rig = createLightingRig(scene, { fog: { color: 0x222233, near: 6, far: 27 } });
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    const fog = scene.fog as THREE.Fog;
    expect(fog.near).toBe(6);
    expect(fog.far).toBe(27);
    rig.dispose();
    expect(scene.fog).toBe(originalFog);
  });

  it('فاصلهٔ مه نامعتبر را رد می‌کند', () => {
    const scene = new THREE.Scene();
    expect(() => createLightingRig(scene, { fog: { near: 30, far: 10 } })).toThrow(RangeError);
    expect(scene.children).toHaveLength(0);
  });

  it('نورهای صحنه را به شکل نرم و قطعی سوسو می‌دهد', () => {
    const scene = new THREE.Scene();
    const rig = createLightingRig(scene, { pointIntensity: 8, spotIntensity: 20 });
    const initialPoint = rig.point.intensity;
    const initialSpot = rig.spot.intensity;
    rig.update(1 / 60, 0.17);
    expect(rig.point.intensity).not.toBe(initialPoint);
    expect(rig.spot.intensity).not.toBe(initialSpot);
    const first = rig.point.intensity;
    rig.update(1 / 60, 0.17);
    expect(rig.point.intensity).toBe(first);
    rig.dispose();
  });

  it('می‌تواند سوسو زدن را خاموش کند', () => {
    const rig = createLightingRig(new THREE.Scene(), { flicker: { enabled: false } });
    const pointIntensity = rig.point.intensity;
    const spotIntensity = rig.spot.intensity;
    rig.update(1 / 60, 1.5);
    expect(rig.point.intensity).toBe(pointIntensity);
    expect(rig.spot.intensity).toBe(spotIntensity);
    rig.dispose();
  });

  it('فیلتر سایه نرم را روی renderer فعال می‌کند', () => {
    const renderer = { shadowMap: { enabled: false, type: THREE.BasicShadowMap } } as unknown as THREE.WebGLRenderer;
    configureSoftShadows(renderer);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
  });
});
