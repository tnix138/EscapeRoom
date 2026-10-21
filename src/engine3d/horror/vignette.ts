'use client';

import * as THREE from 'three';

export interface HorrorPostProcessingOptions {
  vignette?: number;
  grain?: number;
  chromaticAberration?: number;
}

export const HORROR_POST_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const HORROR_POST_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float time;
  uniform float vignetteStrength;
  uniform float grainStrength;
  uniform float chromaticStrength;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float aberration = chromaticStrength / max(resolution.x, resolution.y);
    vec2 offset = centered * aberration;
    vec4 color;
    color.r = texture2D(tDiffuse, vUv + offset).r;
    color.g = texture2D(tDiffuse, vUv).g;
    color.b = texture2D(tDiffuse, vUv - offset).b;
    color.a = texture2D(tDiffuse, vUv).a;

    float vignette = 1.0 - smoothstep(0.22, 0.82, length(centered * vec2(1.0, 1.15)));
    color.rgb *= mix(1.0, vignette, vignetteStrength);
    float grain = (hash(gl_FragCoord.xy + vec2(time * 137.0, time * 71.0)) - 0.5) * grainStrength;
    color.rgb += grain;
    gl_FragColor = color;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Shader/material façade for reusable vignette, film grain and chromatic aberration. */
export class Vignette {
  readonly material: THREE.ShaderMaterial;

  constructor(options: HorrorPostProcessingOptions = {}) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
        time: { value: 0 },
        vignetteStrength: { value: clamp(options.vignette ?? 0.58, 0, 1) },
        grainStrength: { value: clamp(options.grain ?? 0.045, 0, 0.2) },
        chromaticStrength: { value: clamp(options.chromaticAberration ?? 1.15, 0, 4) },
      },
      vertexShader: HORROR_POST_VERTEX_SHADER,
      fragmentShader: HORROR_POST_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    });
    this.material.name = 'HorrorVignetteFilmGrain';
  }

  setTime(elapsedSeconds: number): void {
    this.material.uniforms.time.value = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  }

  setEffects(options: HorrorPostProcessingOptions): void {
    if (options.vignette !== undefined) {
      this.material.uniforms.vignetteStrength.value = clamp(options.vignette, 0, 1);
    }
    if (options.grain !== undefined) {
      this.material.uniforms.grainStrength.value = clamp(options.grain, 0, 0.2);
    }
    if (options.chromaticAberration !== undefined) {
      this.material.uniforms.chromaticStrength.value = clamp(options.chromaticAberration, 0, 4);
    }
  }

  dispose(): void {
    this.material.dispose();
  }
}

/** Minimal full-screen render pass; intentionally avoids a large postprocessing dependency. */
export class HorrorPostProcessor {
  readonly vignette: Vignette;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly screenScene = new THREE.Scene();
  private readonly screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    options: HorrorPostProcessingOptions = {},
  ) {
    this.vignette = new Vignette(options);
    this.target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
    });
    this.target.texture.name = 'HorrorPostProcessingSceneColor';
    this.vignette.material.uniforms.tDiffuse.value = this.target.texture;
    this.vignette.material.uniforms.resolution.value.set(Math.max(1, width), Math.max(1, height));
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.vignette.material);
    this.quad.frustumCulled = false;
    this.screenScene.add(this.quad);
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.target.setSize(w, h);
    this.vignette.material.uniforms.resolution.value.set(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, elapsedSeconds: number): void {
    if (this.disposed) return;
    const oldTarget = this.renderer.getRenderTarget();
    const oldAutoClear = this.renderer.autoClear;
    this.vignette.setTime(elapsedSeconds);
    try {
      this.renderer.autoClear = true;
      this.renderer.setRenderTarget(this.target);
      this.renderer.clear();
      this.renderer.render(scene, camera);
      this.renderer.setRenderTarget(oldTarget);
      this.renderer.clear();
      this.renderer.render(this.screenScene, this.screenCamera);
    } finally {
      this.renderer.setRenderTarget(oldTarget);
      this.renderer.autoClear = oldAutoClear;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.target.dispose();
    this.quad.geometry.dispose();
    this.vignette.dispose();
    this.screenScene.clear();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}
