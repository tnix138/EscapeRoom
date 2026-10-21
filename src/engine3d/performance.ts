'use client';

/**
 * performance.ts — پایش کارایی رندر سه‌بعدی (علیرضا — موج ۱۰)
 * - اندازه‌گیری FPS, frame time, draw calls, geometries, textures
 * - تشخیص افت فریم و پیشنهاد fallback
 * - لاگ برای QA
 */

import * as THREE from 'three';

export interface PerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  timestamp: number;
}

export class PerformanceMonitor {
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private lastFps = 60;
  private frameTimes: number[] = [];
  private readonly maxSamples = 60;

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  /**
   * فراخوانی در هر فریم
   */
  tick(deltaSeconds: number): PerformanceMetrics {
    this.frameCount++;
    const now = performance.now();
    this.frameTimes.push(deltaSeconds * 1000);
    if (this.frameTimes.length > this.maxSamples) this.frameTimes.shift();

    if (now - this.lastFpsTime >= 1000) {
      this.lastFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    const info = this.renderer.info;
    const avgFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;

    return {
      fps: this.lastFps,
      frameTimeMs: avgFrameTime,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      timestamp: now,
    };
  }

  /**
   * آیا کارایی قابل قبول است؟
   */
  static isPerformanceAcceptable(metrics: PerformanceMetrics, targetFps = 30): boolean {
    return metrics.fps >= targetFps && metrics.frameTimeMs <= 1000 / targetFps + 5;
  }

  /**
   * پیشنهاد fallback اگر افت شدید
   */
  static shouldFallbackToCSS(metrics: PerformanceMetrics): boolean {
    return metrics.fps < 20 && metrics.frameTimeMs > 80;
  }
}

/**
 * اندازه‌گیری حجم باندل و زمان لود
 */
export function measureBundleSize(): { jsSizeKb: number; threeSizeKb: number } {
  // در مرورگر واقعی با performance.getEntriesByType
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return { jsSizeKb: 0, threeSizeKb: 0 };
  }
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  let totalJs = 0;
  let threeJs = 0;
  for (const res of resources) {
    if (res.name.endsWith('.js')) {
      const size = (res as unknown as { transferSize?: number }).transferSize ?? 0;
      totalJs += size;
      if (res.name.includes('three') || res.name.includes('chunk')) {
        threeJs += size;
      }
    }
  }
  return { jsSizeKb: Math.round(totalJs / 1024), threeSizeKb: Math.round(threeJs / 1024) };
}

/**
 * لاگ کارایی برای QA
 */
export function logPerformance(metrics: PerformanceMetrics): void {
  if (typeof console === 'undefined') return;
  console.info(
    `[Performance] FPS: ${metrics.fps} | Frame: ${metrics.frameTimeMs.toFixed(1)}ms | DrawCalls: ${metrics.drawCalls} | Triangles: ${metrics.triangles} | Geometries: ${metrics.geometries}`,
  );
}
