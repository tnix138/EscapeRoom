'use client';

/**
 * alley-sky.ts — گنبد آسمان شبانه و نقشهٔ بازتاب محیطی کوچهٔ بارانی (علیرضا)
 * - گنبد شیدری تمام‌رزولوشن با fog: false (تا مه صحنه آسمان و ماه را خاکستری نکند)
 * - ماه رنگ‌پریده با دهانه‌ها و هالهٔ مه‌آلود هماهنگ با جهت نور ماه
 * - ابرهای توفانی چندلایه در حال حرکت آرام + ستاره‌های چشمک‌زن
 * - نقشهٔ بازتاب محیطی Equirectangular برای چاله‌های آب و سطوح خیس/برنجی کوچه
 */

import * as THREE from 'three';

export const ALLEY_MOON_DIRECTION = new THREE.Vector3(0.32, 0.72, -0.62).normalize();

export const ALLEY_SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ALLEY_SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uMoonDir;
  uniform vec3 uZenithColor;
  uniform vec3 uMidSkyColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uWarmGlowColor;
  varying vec3 vWorldDir;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.52;
    for (int i = 0; i < 5; i++) {
      sum += amp * noise2(p);
      p = p * 2.03 + vec2(17.1, 9.7);
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = clamp(dir.y, -0.2, 1.0);

    // گرادیان اتمسفری نیمه‌شب: افق مه‌آلود تا اوج سرمه‌ای تیره
    float horizonMix = pow(clamp(1.0 - max(h, 0.0), 0.0, 1.0), 3.2);
    float midMix = smoothstep(0.02, 0.58, max(h, 0.0));
    vec3 sky = mix(uMidSkyColor, uZenithColor, midMix);
    sky = mix(sky, uHorizonColor, horizonMix);

    // بازتاب کهربایی خفیف چراغ‌های شهر و سردر تئاتر در مه افق
    float northGlow = pow(clamp(-dir.z * 0.5 + 0.5, 0.0, 1.0), 2.4) * exp(-max(h, 0.0) * 6.5);
    sky += uWarmGlowColor * northGlow * 0.28;

    // ستاره‌های ریز چشمک‌زن در نیم‌کرهٔ بالایی
    if (h > 0.08) {
      vec2 starUv = dir.xz / (h + 0.28) * 46.0;
      vec2 cell = floor(starUv);
      vec2 local = fract(starUv) - 0.5;
      float seed = hash21(cell);
      if (seed > 0.968) {
        float dist = length(local);
        float twinkle = 0.68 + 0.32 * sin(uTime * (1.6 + seed * 3.4) + seed * 40.0);
        float star = smoothstep(0.16, 0.0, dist) * twinkle * smoothstep(0.08, 0.42, h);
        vec3 starTint = mix(vec3(0.76, 0.85, 1.0), vec3(1.0, 0.93, 0.82), fract(seed * 13.7));
        sky += starTint * star * 0.9;
      }
    }

    // ماه کامل رنگ‌پریده با لکه‌های سطحی + هالهٔ مه‌آلود
    vec3 moonDir = normalize(uMoonDir);
    float moonCos = max(dot(dir, moonDir), 0.0);
    float moonAngle = acos(clamp(moonCos, -1.0, 1.0));
    float moonRadius = 0.048;

    // هالهٔ چندلایه اطراف ماه در رطوبت شب
    float innerHalo = exp(-moonAngle * 14.0) * 0.42;
    float outerHalo = exp(-moonAngle * 4.2) * 0.16;
    sky += vec3(0.55, 0.66, 0.90) * (innerHalo + outerHalo);

    // قرص ماه با دهانه‌های ظریف
    float moonDisc = 1.0 - smoothstep(moonRadius * 0.86, moonRadius, moonAngle);
    if (moonDisc > 0.001) {
      vec2 moonPlane = (dir.xy - moonDir.xy) / moonRadius;
      float mare = fbm(moonPlane * 3.1 + vec2(4.2, 8.7));
      float limb = sqrt(clamp(1.0 - dot(moonPlane, moonPlane) * 0.62, 0.15, 1.0));
      vec3 moonSurface = vec3(0.90, 0.93, 1.0) * (0.76 + 0.28 * mare) * limb;
      sky = mix(sky, moonSurface * 1.25, moonDisc);
    }

    // ابرهای تیرهٔ شبانه در حال حرکت آرام از برابر ماه
    if (h > 0.02) {
      vec2 cloudUv = dir.xz / (h + 0.30);
      float drift = uTime * 0.014;
      float c1 = fbm(cloudUv * 1.35 + vec2(drift, drift * 0.55));
      float c2 = fbm(cloudUv * 2.75 - vec2(drift * 0.8, -drift * 0.35));
      float cloud = smoothstep(0.40, 0.86, c1 * 0.72 + c2 * 0.36);
      cloud *= smoothstep(0.01, 0.24, h);

      // لبهٔ نقره‌ای ابرها در نزدیکی ماه
      float silverLining = pow(moonCos, 7.0) * cloud * (1.0 - cloud * 0.45);
      vec3 cloudDark = mix(vec3(0.030, 0.040, 0.068), vec3(0.075, 0.095, 0.145), c2);
      cloudDark += vec3(0.44, 0.54, 0.76) * silverLining * 0.85;
      sky = mix(sky, cloudDark, cloud * 0.80);
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export interface AlleySkyHandle {
  readonly dome: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  update(elapsedSeconds: number): void;
  dispose(): void;
}

export function createAlleySkyDome(radius = 74): AlleySkyHandle {
  const geometry = new THREE.SphereGeometry(radius, 32, 24);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMoonDir: { value: ALLEY_MOON_DIRECTION.clone() },
      uZenithColor: { value: new THREE.Color(0x040814) },
      uMidSkyColor: { value: new THREE.Color(0x0b152b) },
      uHorizonColor: { value: new THREE.Color(0x111827) },
      uWarmGlowColor: { value: new THREE.Color(0xb86b2b) },
    },
    vertexShader: ALLEY_SKY_VERTEX_SHADER,
    fragmentShader: ALLEY_SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  material.name = 'AlleyNightSkyMaterial';

  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'AlleySkyDome';
  dome.renderOrder = -1000;
  dome.frustumCulled = false;

  let disposed = false;

  return {
    dome,
    update(elapsedSeconds: number) {
      if (disposed || !Number.isFinite(elapsedSeconds)) return;
      material.uniforms.uTime.value = elapsedSeconds;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * نقشهٔ بازتاب Equirectangular اختصاصی کوچهٔ خیس بارانی:
 * نوار آبی-نقره‌ای آسمان بین ساختمان‌ها + لکه‌های گرم چراغ‌های برق و سردر تئاتر
 * تا چاله‌های آب، سنگ‌فرش خیس، یراق برنجی گیشه و فلز تیر چراغ برق برق طبیعی داشته باشند.
 */
export function createAlleyEnvironmentMap(width = 128, height = 64): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / height; // 0 پایین، 1 بالای گنبد
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const skySlit = Math.pow(Math.max(0, (v - 0.52) / 0.48), 1.5);
      const streetLampA = Math.exp(-Math.pow((u - 0.18) * 18, 2) - Math.pow((v - 0.56) * 14, 2));
      const streetLampB = Math.exp(-Math.pow((u - 0.68) * 18, 2) - Math.pow((v - 0.55) * 14, 2));
      const marqueeGlow = Math.exp(-Math.pow((u - 0.50) * 11, 2) - Math.pow((v - 0.52) * 12, 2));
      const moonSpot = Math.exp(-Math.pow((u - 0.36) * 26, 2) - Math.pow((v - 0.84) * 22, 2));
      const groundBounce = Math.exp(-Math.pow((v - 0.36) * 9, 2)) * 0.25;

      const r =
        8 +
        skySlit * 24 +
        groundBounce * 26 +
        (streetLampA + streetLampB) * 238 +
        marqueeGlow * 215 +
        moonSpot * 175;
      const g =
        11 +
        skySlit * 38 +
        groundBounce * 22 +
        (streetLampA + streetLampB) * 152 +
        marqueeGlow * 126 +
        moonSpot * 196;
      const b =
        20 +
        skySlit * 74 +
        groundBounce * 26 +
        (streetLampA + streetLampB) * 68 +
        marqueeGlow * 56 +
        moonSpot * 245;

      const idx = (y * width + x) * 4;
      data[idx] = Math.min(255, Math.round(r));
      data[idx + 1] = Math.min(255, Math.round(g));
      data[idx + 2] = Math.min(255, Math.round(b));
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'AlleyRainEnvironment';
  return texture;
}
