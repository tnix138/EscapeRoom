'use client';

import * as THREE from 'three';

export interface FlickerOptions {
  enabled?: boolean;
  /** Relative intensity variation in the range [0, 1]. */
  amount?: number;
  /** Flicker cycles per second. */
  frequencyHz?: number;
}

export interface LightingRigOptions {
  ambientIntensity?: number;
  directionalIntensity?: number;
  pointIntensity?: number;
  spotIntensity?: number;
  shadowMapSize?: number;
  fog?: {
    color?: THREE.ColorRepresentation;
    near?: number;
    far?: number;
  };
  flicker?: FlickerOptions;
}

export interface LightingRig {
  readonly group: THREE.Group;
  readonly ambient: THREE.AmbientLight;
  readonly directional: THREE.DirectionalLight;
  readonly point: THREE.PointLight;
  readonly spot: THREE.SpotLight;
  /** Update once per frame with engine delta/elapsed seconds. */
  update(deltaSeconds: number, elapsedSeconds: number): void;
  dispose(): void;
}

const DEFAULT_FOG_COLOR = 0x080b12;

/** Configure the renderer's shadow filter before rendering the scene. */
export function configureSoftShadows(renderer: THREE.WebGLRenderer): void {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/** Attach a compact, PBR-compatible theatrical lighting rig to a Three.js scene. */
export function createLightingRig(
  scene: THREE.Scene,
  options: LightingRigOptions = {},
): LightingRig {
  const group = new THREE.Group();
  group.name = 'TheaterLightingRig';

  const ambient = new THREE.AmbientLight(0x8590a8, options.ambientIntensity ?? 0.45);
  ambient.name = 'TheaterAmbientLight';

  const directional = new THREE.DirectionalLight(0xc6d5ff, options.directionalIntensity ?? 1.35);
  directional.name = 'TheaterKeyLight';
  directional.position.set(-7, 11, 5);
  directional.castShadow = true;
  directional.shadow.mapSize.set(
    normalizeShadowMapSize(options.shadowMapSize ?? 1024),
    normalizeShadowMapSize(options.shadowMapSize ?? 1024),
  );
  directional.shadow.camera.left = -16;
  directional.shadow.camera.right = 16;
  directional.shadow.camera.top = 16;
  directional.shadow.camera.bottom = -16;
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 42;
  directional.shadow.bias = -0.0002;
  directional.shadow.normalBias = 0.025;
  directional.shadow.radius = 4;

  const point = new THREE.PointLight(0xff754f, options.pointIntensity ?? 5.5, 16, 2);
  point.name = 'TheaterPracticalPointLight';
  point.position.set(-3.5, 3, -4);
  // Local practical light does not cast a second shadow map; this keeps mobile GPU cost bounded.
  point.castShadow = false;

  const spot = new THREE.SpotLight(
    0xb9caff,
    options.spotIntensity ?? 24,
    30,
    Math.PI / 5,
    0.78,
    1.4,
  );
  spot.name = 'TheaterStageSpotLight';
  spot.position.set(0, 7, 1);
  spot.target.position.set(0, 0, -8);
  spot.castShadow = false;

  group.add(ambient, directional, point, spot, spot.target);
  scene.add(group);

  const previousFog = scene.fog;
  const fogNear = options.fog?.near ?? 8;
  const fogFar = options.fog?.far ?? 35;
  if (!Number.isFinite(fogNear) || !Number.isFinite(fogFar) || fogNear < 0 || fogFar <= fogNear) {
    scene.remove(group);
    throw new RangeError('Fog distances must be finite, non-negative, and far must exceed near.');
  }
  const appliedFog = new THREE.Fog(options.fog?.color ?? DEFAULT_FOG_COLOR, fogNear, fogFar);
  scene.fog = appliedFog;

  const flickerEnabled = options.flicker?.enabled ?? true;
  const flickerAmount = clamp(options.flicker?.amount ?? 0.16, 0, 1);
  const frequency = Math.max(0, options.flicker?.frequencyHz ?? 7.5);
  const pointBaseIntensity = point.intensity;
  const spotBaseIntensity = spot.intensity;
  let disposed = false;

  return {
    group,
    ambient,
    directional,
    point,
    spot,
    update(_deltaSeconds, elapsedSeconds) {
      if (disposed || !flickerEnabled || frequency === 0) return;
      // A deterministic multi-wave pattern avoids random-number allocation and harsh frame-to-frame jumps.
      const phase = elapsedSeconds * frequency * Math.PI * 2;
      const wave = 0.62 * Math.sin(phase) + 0.28 * Math.sin(phase * 2.37 + 1.3) +
        0.1 * Math.sin(phase * 4.11 + 0.4);
      const scale = 1 - flickerAmount * (0.5 - 0.5 * wave);
      point.intensity = pointBaseIntensity * scale;
      spot.intensity = spotBaseIntensity * (1 - flickerAmount * 0.55 * (0.5 - 0.5 * wave));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      if (scene.fog === appliedFog) scene.fog = previousFog;
    },
  };
}

function normalizeShadowMapSize(size: number): number {
  const bounded = Math.max(256, Math.min(2048, Math.round(size)));
  return 2 ** Math.round(Math.log2(bounded));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
