'use client';

/**
 * three-engine.ts — هسته رندرر Three.js با چرخه حیات امن برای Next.js (علیرضا — موج ۴)
 * - ساخت renderer/scene/camera فقط در مرورگر
 * - resize با ResizeObserver + devicePixelRatio محدود به 1.5 برای کاهش fill-rate در وب
 * - dispose کامل
 * - تشخیص WebGL
 */

import * as THREE from 'three';

export interface ThreeEngineOptions {
  antialias?: boolean;
  alpha?: boolean;
}

export class ThreeEngine {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  private readonly clock: THREE.Clock;
  private rafId: number | null = null;
  private disposed = false;
  private onTick: ((delta: number, elapsed: number) => void) | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: ThreeEngineOptions = {},
  ) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b101c);
    this.scene.fog = new THREE.FogExp2(0x0b101c, 0.021);

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 140);
    this.camera.position.set(0, 1.65, 6);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.clock = new THREE.Clock();
  }

  static isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  }

  setSize(width: number, height: number): void {
    if (this.disposed) return;
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setTick(fn: (delta: number, elapsed: number) => void): void {
    this.onTick = fn;
  }

  start(): void {
    if (this.disposed) return;
    this.clock.start();
    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();
      if (this.onTick) this.onTick(delta, elapsed);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clock.stop();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (material) {
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });
    this.renderer.dispose();
    try {
      (this.renderer as unknown as { forceContextLoss?: () => void }).forceContextLoss?.();
    } catch {
      /* ignore */
    }
  }

  get info() {
    return this.renderer.info;
  }
}
