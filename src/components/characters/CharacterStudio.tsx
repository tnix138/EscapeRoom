'use client';

/**
 * CharacterStudio.tsx — استودیوی زندهٔ کاراکترهای انسانی
 * -----------------------------------------------------------------
 * این صفحه برای همین یک سؤال ساخته شده: «چرا کاراکترها شبیه انسان نیستند؟»
 * - کنار هم گذاشتن مدل قدیمی (کپسول/کره) و مدل جدید (جمجمهٔ مجسمه‌شده + پوست بافت‌دار)
 * - نمای نزدیک چهره برای دیدن پلک، عنبیه، ابروی تاربه‌تار و منافذ پوست
 * - سه نور متفاوت (استودیو/تالار/کوچهٔ شب) تا معلوم شود چقدر از «ربات بودن»
 *   تقصیر نورپردازی و بازتاب محیطی است، نه فقط هندسه
 * - شمارندهٔ زندهٔ FPS و مثلث‌ها برای اینکه زیبایی به قیمت کارایی تمام نشود
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HumanAvatar } from '@/engine3d/characters/human-avatar';
import { DEFAULT_HUMAN_LOOKS } from '@/engine3d/characters/human-presets';

type ViewMode = 'lineup' | 'focus' | 'compare';
type LightingPreset = 'studio' | 'theater' | 'night';
type CameraFrame = 'full' | 'face' | 'hands';

const LOOKS = DEFAULT_HUMAN_LOOKS;
const COMPARE_RADIUS = 0.62;

interface StudioState {
  view: ViewMode;
  lighting: LightingPreset;
  frame: CameraFrame;
  lookIndex: number;
  walking: boolean;
  autoRotate: boolean;
  yaw: number;
  zoom: number;
}

function buildLegacyAvatar(): THREE.Group {
  // مدل «قبل»: دقیقاً همان الگویی که باعث می‌شد کاراکتر شبیه مانکن شود
  const group = new THREE.Group();
  group.name = 'LegacyAvatar';
  const coat = new THREE.MeshStandardMaterial({ color: 0x5b2a86, roughness: 0.76 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe4be9c, roughness: 0.68 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x221710, roughness: 0.88 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x161219, roughness: 0.4 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xf1e6d2, roughness: 0.78 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x110e14, roughness: 0.52 });

  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.165, 0.34, 6, 12), coat);
  chest.scale.set(1.22, 1, 0.78);
  chest.position.y = 1.13;
  group.add(chest);

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.215, 0.28, 12), coat);
  skirt.position.y = 0.9;
  group.add(skirt);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 14), skin);
  skull.scale.set(0.92, 1.08, 0.98);
  skull.position.y = 1.53;
  group.add(skull);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), skin);
  jaw.scale.set(0.9, 0.85, 0.88);
  jaw.position.set(0, 1.49, -0.014);
  group.add(jaw);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.129, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hair,
  );
  hairCap.scale.set(0.95, 1.08, 1.02);
  hairCap.position.y = 1.542;
  group.add(hairCap);

  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), dark);
    eye.position.set(side * 0.042, 1.548, -0.116);
    group.add(eye);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 5, 10), coat);
    arm.position.set(side * 0.235, 1.12, 0);
    group.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.55, 5, 10), coat);
    leg.position.set(side * 0.1, 0.42, 0);
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.068, 0.21), shoe);
    foot.position.set(side * 0.1, 0.04, -0.035);
    group.add(foot);
  }
  const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.025), shirt);
  shirtFront.position.set(0, 1.22, -0.125);
  group.add(shirtFront);

  return group;
}

export default function CharacterStudio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<ViewMode>('compare');
  const [lighting, setLighting] = useState<LightingPreset>('studio');
  const [frame, setFrame] = useState<CameraFrame>('full');
  const [lookIndex, setLookIndex] = useState(0);
  const [walking, setWalking] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [stats, setStats] = useState({ fps: 0, triangles: 0, calls: 0 });
  const [webglOk, setWebglOk] = useState(true);

  const stateRef = useRef<StudioState>({
    view,
    lighting,
    frame,
    lookIndex,
    walking,
    autoRotate,
    yaw: 0.35,
    zoom: 1,
  });
  stateRef.current = { ...stateRef.current, view, lighting, frame, lookIndex, walking, autoRotate };

  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, manualYaw: 0.35, pitch: 0.05 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      setWebglOk(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x09070b);
    scene.fog = new THREE.FogExp2(0x09070b, 0.045);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envMap = pmrem.fromScene(room, 0.05);
    scene.environment = envMap.texture;
    if ('environmentIntensity' in scene) {
      (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.5;
    }
    room.dispose();
    pmrem.dispose();

    // کتابخانهٔ سه‌نوری: کلید گرم، پرکنندهٔ سرد، نور لبهٔ طلایی
    const keyLight = new THREE.SpotLight(0xffe6c4, 22, 9, Math.PI / 5, 0.55, 1.6);
    keyLight.position.set(1.6, 3.4, 2.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0012;
    keyLight.shadow.normalBias = 0.01;
    scene.add(keyLight, keyLight.target);

    const fillLight = new THREE.PointLight(0x8fb6ff, 2.6, 7, 2);
    fillLight.position.set(-2.4, 1.9, 1.6);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xd8a45a, 3.4, 6, 2);
    rimLight.position.set(0.4, 2.2, -2.4);
    scene.add(rimLight);

    const practical = new THREE.PointLight(0x9e1f32, 2.2, 6, 2);
    practical.position.set(2.4, 1.2, -1.6);
    scene.add(practical);

    const ambient = new THREE.AmbientLight(0xb9a7c8, 0.16);
    scene.add(ambient);

    const stage = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.35, 0.12, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a141c, roughness: 0.62, metalness: 0.15 }),
    );
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    stage.add(floor);
    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.012, 8, 96),
      new THREE.MeshStandardMaterial({ color: 0xc9a86a, metalness: 0.8, roughness: 0.3 }),
    );
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = 0.005;
    stage.add(goldRing);
    scene.add(stage);

    const avatars = LOOKS.map((look) => new HumanAvatar({ look }));
    const avatarRoot = new THREE.Group();
    scene.add(avatarRoot);
    for (const avatar of avatars) {
      avatar.visible = false;
      avatarRoot.add(avatar);
    }

    const legacyGroup = new THREE.Group();
    legacyGroup.visible = false;
    scene.add(legacyGroup);
    const legacy = buildLegacyAvatar();
    legacy.position.x = -COMPARE_RADIUS;
    legacyGroup.add(legacy);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
    const target = new THREE.Vector3(0, 1.05, 0);
    const smoothTarget = target.clone();
    const smoothPosition = new THREE.Vector3(0, 1.4, 3);

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    let rafId = 0;
    let elapsed = 0;
    let frames = 0;
    let lastStats = 0;
    let lastTime = performance.now() / 1000;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - lastTime);
      lastTime = now;
      elapsed += dt;
      frames++;

      const state = stateRef.current;

      // نور: استودیو = نرم و کامل، تالار = گرم و کنتراست‌دار، کوچه = سرد و کم
      if (state.lighting === 'studio') {
        keyLight.intensity = 20;
        fillLight.intensity = 2.4;
        rimLight.intensity = 3.2;
        practical.intensity = 1.2;
        ambient.intensity = 0.2;
        renderer.toneMappingExposure = 1.05;
      } else if (state.lighting === 'theater') {
        keyLight.intensity = 15;
        fillLight.intensity = 0.7;
        rimLight.intensity = 5.4;
        practical.intensity = 3.4;
        ambient.intensity = 0.08;
        renderer.toneMappingExposure = 1.15;
      } else {
        keyLight.intensity = 4.2;
        fillLight.intensity = 0.5;
        rimLight.intensity = 1.2;
        practical.intensity = 0.3;
        ambient.intensity = 0.04;
        renderer.toneMappingExposure = 1.35;
      }

      if (state.autoRotate && !dragRef.current.active) {
        dragRef.current.manualYaw += dt * 0.28;
      }

      // چیدمان بر اساس حالت
      const lineup = state.view === 'lineup';
      const compare = state.view === 'compare';
      const focusIndex = Math.min(state.lookIndex, avatars.length - 1);
      const spacing = 0.82;

      avatars.forEach((avatar, index) => {
        avatar.visible = lineup || (state.view === 'focus' && index === focusIndex);
        const x = (index - (avatars.length - 1) / 2) * spacing;
        avatar.position.set(x, 0, lineup ? -Math.abs(index - 3.5) * 0.1 : 0);
        if (avatar.visible) {
          // آواتار رو به دوربینِ اولیه (+Z) است؛ با درگ، دوربین دور او می‌گردد
          avatar.rotation.y = Math.PI + (lineup ? Math.sin(elapsed * 0.35 + index) * 0.18 : 0);
          avatar.update(dt, {
            speed: state.walking ? 1.4 : 0,
            pitchDeg: Math.sin(elapsed * 0.6) * 2,
            yawRate: 0,
          });
        }
      });

      legacyGroup.visible = compare;
      if (compare) {
        avatars.forEach((avatar, index) => {
          if (index === focusIndex) {
            avatar.visible = true;
            avatar.position.set(COMPARE_RADIUS, 0, 0);
            avatar.rotation.y = Math.PI;
            avatar.update(dt, { speed: 0, pitchDeg: 0 });
          }
        });
        legacy.rotation.y = Math.PI;
      }

      // دوربین: مدار نرم با درگ و زوم
      const orbit = dragRef.current.manualYaw;
      const pitch = dragRef.current.pitch;
      const focusX = lineup ? 0 : compare ? 0 : (focusIndex - 3.5) * spacing;
      const frameDistance = state.frame === 'face' ? 0.98 : state.frame === 'hands' ? 0.78 : 2.9;
      const baseDistance =
        (lineup ? 5.8 : compare ? 3.5 : frameDistance) * state.zoom;
      const frameTargetY =
        state.frame === 'face' && !lineup && !compare
          ? 1.62
          : state.frame === 'hands' && !lineup && !compare
            ? 0.86
            : lineup
              ? 1.0
              : 1.0;

      target.set(focusX, frameTargetY, 0);
      smoothTarget.lerp(target, Math.min(1, dt * 5));
      const radius = baseDistance * Math.cos(pitch);
      const eyeLift =
        state.frame === 'face' && !lineup && !compare ? 0.02 : state.frame === 'hands' ? 0.12 : 0.18;
      smoothPosition.lerp(
        new THREE.Vector3(
          focusX + Math.sin(orbit) * radius,
          frameTargetY + Math.sin(pitch) * baseDistance + eyeLift,
          Math.cos(orbit) * radius,
        ),
        Math.min(1, dt * 5),
      );
      camera.position.copy(smoothPosition);
      camera.lookAt(smoothTarget);

      keyLight.target.position.set(focusX, 1.1, 0);

      renderer.render(scene, camera);

      if (now - lastStats > 0.5) {
        const info = renderer.info.render;
        setStats({
          fps: Math.round(frames / (now - lastStats)),
          triangles: info.triangles,
          calls: info.calls,
        });
        frames = 0;
        lastStats = now;
      }
      void elapsed;
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      for (const avatar of avatars) avatar.dispose();
      envMap.dispose();
      renderer.dispose();
    };
  }, []);

  const controlButton = (
    active: boolean,
    label: string,
    onClick: () => void,
  ) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 12px',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--gold, #c9a86a)' : 'rgba(201,168,106,0.25)'}`,
        background: active ? 'rgba(201,168,106,0.18)' : 'transparent',
        color: active ? '#f3e3c4' : '#cbbfae',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );

  return (
    <div dir="rtl" style={{ display: 'grid', gap: 12, fontFamily: 'inherit' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          padding: 10,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(201,168,106,0.18)',
        }}
      >
        <span style={{ fontSize: 12, color: '#c9a86a' }}>نمایش:</span>
        {controlButton(view === 'compare', 'قبل / بعد', () => setView('compare'))}
        {controlButton(view === 'focus', 'نزدیک یک کاراکتر', () => setView('focus'))}
        {controlButton(view === 'lineup', 'صف هشت کاراکتر', () => setView('lineup'))}

        <span style={{ width: 1, height: 20, background: 'rgba(201,168,106,0.2)', marginInline: 4 }} />
        <span style={{ fontSize: 12, color: '#c9a86a' }}>کادر:</span>
        {controlButton(frame === 'full', 'تمام‌قد', () => setFrame('full'))}
        {controlButton(frame === 'face', 'چهره', () => setFrame('face'))}
        {controlButton(frame === 'hands', 'دست‌ها', () => setFrame('hands'))}

        <span style={{ width: 1, height: 20, background: 'rgba(201,168,106,0.2)', marginInline: 4 }} />
        <span style={{ fontSize: 12, color: '#c9a86a' }}>نور:</span>
        {controlButton(lighting === 'studio', 'استودیو', () => setLighting('studio'))}
        {controlButton(lighting === 'theater', 'تالار', () => setLighting('theater'))}
        {controlButton(lighting === 'night', 'کوچهٔ شب', () => setLighting('night'))}

        <span style={{ width: 1, height: 20, background: 'rgba(201,168,106,0.2)', marginInline: 4 }} />
        {controlButton(walking, 'قدم‌زدن', () => setWalking((value) => !value))}
        {controlButton(autoRotate, 'چرخش خودکار', () => setAutoRotate((value) => !value))}
      </div>

      <div
        style={{
          position: 'relative',
          height: 'min(70vh, 620px)',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(201,168,106,0.22)',
          background: '#09070b',
        }}
      >
        {webglOk ? (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
            onPointerDown={(event) => {
              dragRef.current.active = true;
              dragRef.current.lastX = event.clientX;
              dragRef.current.lastY = event.clientY;
              setAutoRotate(false);
            }}
            onPointerMove={(event) => {
              if (!dragRef.current.active) return;
              dragRef.current.manualYaw += (event.clientX - dragRef.current.lastX) * 0.006;
              dragRef.current.pitch = Math.max(
                -0.35,
                Math.min(0.6, dragRef.current.pitch + (event.clientY - dragRef.current.lastY) * 0.004),
              );
              dragRef.current.lastX = event.clientX;
              dragRef.current.lastY = event.clientY;
            }}
            onPointerUp={() => {
              dragRef.current.active = false;
            }}
            onPointerLeave={() => {
              dragRef.current.active = false;
            }}
            onWheel={(event) => {
              event.preventDefault();
              stateRef.current.zoom = Math.max(0.5, Math.min(2.4, stateRef.current.zoom + event.deltaY * 0.0012));
            }}
          />
        ) : (
          <div style={{ padding: 24, color: '#e8dcc8' }}>
            WebGL در این مرورگر در دسترس نیست؛ مدل‌های کاراکتر قابل نمایش نیستند.
          </div>
        )}

        {view === 'compare' && (
          <div
            style={{
              position: 'absolute',
              inset: 'auto 16px 12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: '#e8dcc8',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                background: 'rgba(120,30,40,0.5)',
                padding: '4px 10px',
                borderRadius: 6,
              }}
            >
              قبل: کپسول + کرهٔ صاف
            </span>
            <span
              style={{
                background: 'rgba(40,110,80,0.45)',
                padding: '4px 10px',
                borderRadius: 6,
              }}
            >
              بعد: جمجمهٔ مجسمه‌شده + پوست/مو/پارچهٔ بافت‌دار
            </span>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: 10,
            insetInlineStart: 12,
            fontSize: 11,
            color: '#9c9284',
            background: 'rgba(0,0,0,0.45)',
            padding: '4px 8px',
            borderRadius: 6,
            direction: 'ltr',
          }}
        >
          {stats.fps} fps · {stats.triangles.toLocaleString('en-US')} tris · {stats.calls} calls
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: 10,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(201,168,106,0.18)',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: '#c9a86a' }}>کاراکتر:</span>
        {LOOKS.map((look, index) => (
          <button
            key={look.id}
            type="button"
            onClick={() => {
              setLookIndex(index);
              setView('focus');
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${index === lookIndex ? '#c9a86a' : 'rgba(201,168,106,0.2)'}`,
              background: index === lookIndex ? 'rgba(201,168,106,0.2)' : 'transparent',
              color: '#e6d9c4',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {look.displayName}
          </button>
        ))}
        <span style={{ fontSize: 11, color: '#8d8377', marginInlineStart: 'auto' }}>
          نکته: با ماوس بچرخانید و با اسکرول نزدیک شوید. حالت «چهره» برای دیدن پلک و عنبیه است.
        </span>
      </div>
    </div>
  );
}
