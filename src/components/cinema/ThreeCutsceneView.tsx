'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { HorrorPostProcessor } from '../../engine3d/horror/vignette';
import { getCameraKeyframe } from '../../engine3d/cinema/camera-path';
import { getStoryDialogueAt } from './story-script';
import styles from './ThreeCutsceneView.module.css';

export interface ThreeCutsceneViewProps {
  elapsedMs: number;
  yaw: number;
  onReady: (ready: boolean) => void;
}

interface SceneActors {
  usher: THREE.Group;
  dancer: THREE.Group;
  darkMan: THREE.Group;
  chandelier: THREE.Group;
  curtainLeft: THREE.Group;
  curtainRight: THREE.Group;
  doorLeft: THREE.Group;
  doorRight: THREE.Group;
  redWash: THREE.PointLight;
  stageLight: THREE.SpotLight;
  ballroomAmbient: THREE.AmbientLight;
  wallPaintings: THREE.Object3D[];
}

/** Browser-only Three.js rendering of the synchronized 74-second theatrical sequence. */
export default function ThreeCutsceneView({ elapsedMs, yaw, onReady }: ThreeCutsceneViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsedMs);
  const yawRef = useRef(yaw);
  const onReadyRef = useRef(onReady);
  elapsedRef.current = elapsedMs;
  yawRef.current = yaw;
  onReadyRef.current = onReady;
  const storyDialogue = getStoryDialogueAt(elapsedMs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      onReadyRef.current(false);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07060b);
    scene.fog = new THREE.FogExp2(0x07060b, 0.021);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 90);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const actors = createTheaterSet(scene);
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const post = new HorrorPostProcessor(renderer, width, height, {
      vignette: 0.48,
      grain: 0.025,
      chromaticAberration: 0.5,
    });

    const resize = () => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const ratio = renderer.getPixelRatio();
      post.resize(Math.round(w * ratio), Math.round(h * ratio));
    };
    resize();
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null;
    resizeObserver?.observe(canvas);
    if (!resizeObserver) window.addEventListener('resize', resize);

    let raf = 0;
    let disposed = false;
    const renderFrame = () => {
      if (disposed) return;
      raf = requestAnimationFrame(renderFrame);
      const timeMs = clamp(elapsedRef.current, 0, 74_000);
      const timeSeconds = timeMs / 1000;
      const pose = getCameraKeyframe(timeMs);
      updateTheaterSet(actors, timeMs);

      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      camera.rotateY(THREE.MathUtils.degToRad(yawRef.current));

      const push = pulse(timeMs, 53_000, 56_000);
      const slam = pulse(timeMs, 56_000, 57_600) * 0.75;
      const shakeX = Math.sin(timeMs * 0.073) * (push * 0.055 + slam * 0.085);
      const shakeY = Math.sin(timeMs * 0.091 + 1.4) * (push * 0.038 + slam * 0.06);
      camera.position.x += shakeX;
      camera.position.y += shakeY;

      const inversion = smoothstep(50_000, 51_500, timeMs);
      post.vignette.setEffects({
        vignette: 0.48 + inversion * 0.32 + pulse(timeMs, 56_000, 58_000) * 0.1,
        grain: 0.025 + inversion * 0.035 + slam * 0.02,
        chromaticAberration: 0.5 + inversion * 1.2,
      });
      post.render(scene, camera, timeSeconds);
    };

    raf = requestAnimationFrame(renderFrame);
    onReadyRef.current(true);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      post.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  return (
    <div className={styles.root}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="کات‌سین سه‌بعدی سینمایی تماشاخانه اُرفه‌ئو"
      />
      <div className={styles.caption} aria-live="polite">
        {storyDialogue ? (
          <>
            <span className={styles.speaker}>{storyDialogue.speaker}</span>
            <span>{storyDialogue.textFa}</span>
          </>
        ) : cutsceneCaption(elapsedMs)}
      </div>
    </div>
  );
}

function cutsceneCaption(elapsedMs: number): string {
  if (elapsedMs < 2_800) return 'قفل سنگین تماشاخانه آزاد می‌شود…';
  if (elapsedMs < 5_800) return 'دربان پیر در آستانه ظاهر می‌شود؛ فانوسش در تاریکی می‌لرزد.';
  if (elapsedMs < 11_000) return 'بلیط‌ها را تحویل می‌دهی و درهای تماشاخانه گشوده می‌شوند.';
  if (elapsedMs < 21_000) return 'از میان صندلی‌های مخملی می‌گذری و در سالن می‌نشینی…';
  if (elapsedMs < 31_000) return 'پرده کنار می‌رود؛ بانویی ایتالیایی رقص و آواز را آغاز می‌کند.';
  if (elapsedMs < 40_000) return 'در سایهٔ سمت چپ صحنه، مردی بلندقد بی‌حرکت ایستاده است…';
  if (elapsedMs < 50_000) return 'مرد نزدیک می‌شود و دستش را به سوی بانو دراز می‌کند.';
  if (elapsedMs < 56_000) return 'دست او پس زده می‌شود؛ نور سرخ می‌گردد و مرد به شما خیره می‌شود!';
  if (elapsedMs < 67_000) return 'سالن می‌لرزد؛ لوستر کریستالی از سقف کنده می‌شود…';
  return 'هر دو ناپدید شده‌اند. آهنگ ترسناک در سالن تاریک باقی می‌ماند.';
}

function createTheaterSet(scene: THREE.Scene): SceneActors {
  const stone = new THREE.MeshStandardMaterial({ color: 0x27232b, roughness: 0.94 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x17151d, roughness: 0.8, metalness: 0.08 });
  const redVelvet = new THREE.MeshStandardMaterial({ color: 0x671627, roughness: 0.88 });
  const gold = new THREE.MeshStandardMaterial({ color: 0x9b7838, roughness: 0.38, metalness: 0.72 });
  const seatVelvet = new THREE.MeshStandardMaterial({ color: 0x491522, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x372222, roughness: 0.83 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(25, 52), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -10);
  floor.receiveShadow = true;
  scene.add(floor);

  addBox(scene, stone, [0, 5.7, -12], [22, 0.6, 42]); // ceiling
  addBox(scene, stone, [-10.6, 3.2, -12], [0.8, 6.4, 42]);
  addBox(scene, stone, [10.6, 3.2, -12], [0.8, 6.4, 42]);
  addBox(scene, stone, [0, 3, -32], [22, 6, 0.8]);

  // Entry portal and articulated doors.
  addBox(scene, gold, [-1.72, 2.15, -3], [0.22, 4.3, 0.42]);
  addBox(scene, gold, [1.72, 2.15, -3], [0.22, 4.3, 0.42]);
  addBox(scene, gold, [0, 4.22, -3], [3.65, 0.2, 0.42]);
  const doorLeft = new THREE.Group();
  doorLeft.position.set(-1.5, 0, -3.15);
  addBox(doorLeft, wood, [0.72, 1.65, 0], [1.42, 3.3, 0.18]);
  addBox(doorLeft, gold, [1.32, 1.65, -0.11], [0.08, 0.08, 0.08]);
  scene.add(doorLeft);
  const doorRight = new THREE.Group();
  doorRight.position.set(1.5, 0, -3.15);
  addBox(doorRight, wood, [-0.72, 1.65, 0], [1.42, 3.3, 0.18]);
  addBox(doorRight, gold, [-1.32, 1.65, -0.11], [0.08, 0.08, 0.08]);
  scene.add(doorRight);

  // 20 upholstered seats via two instanced meshes to keep draw calls low.
  const seatGeometry = new THREE.BoxGeometry(1.05, 0.34, 0.92);
  const backGeometry = new THREE.BoxGeometry(1.0, 1.12, 0.25);
  const seatBases = new THREE.InstancedMesh(seatGeometry, seatVelvet, 20);
  const seatBacks = new THREE.InstancedMesh(backGeometry, seatVelvet, 20);
  const matrix = new THREE.Object3D();
  let index = 0;
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 5; column++) {
      const x = (column - 2) * 1.45;
      const z = -8.5 - row * 1.55;
      matrix.position.set(x, 0.45, z);
      matrix.updateMatrix();
      seatBases.setMatrixAt(index, matrix.matrix);
      matrix.position.set(x, 1.15, z + 0.47);
      matrix.updateMatrix();
      seatBacks.setMatrixAt(index, matrix.matrix);
      index++;
    }
  }
  seatBases.castShadow = true;
  seatBacks.castShadow = true;
  scene.add(seatBases, seatBacks);

  // Raised stage, backdrop, and two curtain wings.
  addBox(scene, wood, [0, 0.42, -21], [14, 0.84, 5.4]);
  addBox(scene, stone, [0, 3.25, -24], [14, 6.5, 0.35]);
  const curtainLeft = new THREE.Group();
  curtainLeft.position.set(-3.35, 2.9, -20.25);
  addBox(curtainLeft, redVelvet, [-3, 0, 0], [6.1, 5.8, 0.5]);
  scene.add(curtainLeft);
  const curtainRight = new THREE.Group();
  curtainRight.position.set(3.35, 2.9, -20.25);
  addBox(curtainRight, redVelvet, [3, 0, 0], [6.1, 5.8, 0.5]);
  scene.add(curtainRight);
  addBox(scene, gold, [0, 6, -20], [14.5, 0.18, 0.65]);

  const ambient = new THREE.AmbientLight(0x7c7890, 0.52);
  ambient.name = 'CinemaHouseAmbient';
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xd4d9e8, 1.15);
  key.position.set(-6, 11, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(768, 768);
  key.shadow.camera.left = -16;
  key.shadow.camera.right = 16;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  key.shadow.camera.far = 50;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const stageLight = new THREE.SpotLight(0xffd5a0, 17, 27, Math.PI / 5, 0.76, 1.4);
  stageLight.position.set(0, 7.5, -14);
  stageLight.target.position.set(0, 1.3, -21);
  scene.add(stageLight, stageLight.target);
  const redWash = new THREE.PointLight(0xb80020, 0, 18, 2);
  redWash.position.set(0, 3.2, -19);
  scene.add(redWash);

  const usher = makeActor(0x25232b, 0xc8b59d, 0xb9b3a8);
  usher.position.set(0, 0, -1.65);
  usher.scale.setScalar(0.9);
  scene.add(usher);
  const dancer = makeActor(0x74152a, 0xe3c3a1, 0x3b2413);
  dancer.position.set(0, 0.85, -20.3);
  dancer.scale.set(0.82, 1.05, 0.82);
  scene.add(dancer);
  const darkMan = makeActor(0x100e14, 0x8c7768, 0x060509);
  darkMan.position.set(-4.4, 0.8, -20.2);
  darkMan.scale.set(1.1, 1.65, 1.1);
  scene.add(darkMan);

  // Small framed paintings add parallax and become crooked during the attack.
  const wallPaintings: THREE.Object3D[] = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 2; i++) {
      const frame = new THREE.Group();
      frame.position.set(side * 10.05, 2.8, -15 + i * 6);
      const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.45, 1.15), gold);
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.18, 0.88), new THREE.MeshStandardMaterial({ color: i ? 0x463345 : 0x3c2830, roughness: 1 }));
      canvas.position.x = -side * 0.08;
      frame.add(frameMesh, canvas);
      scene.add(frame);
      wallPaintings.push(frame);
    }
  }

  // Crystal chandelier silhouette with lightweight primitives.
  const chandelier = new THREE.Group();
  chandelier.position.set(0, 5.25, -12.4);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.075, 6, 16), gold);
  ring.rotation.x = Math.PI / 2;
  chandelier.add(ring);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), gold);
  chandelier.add(hub);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0xd8c79e, roughness: 0.18, metalness: 0.3, emissive: 0x423116 }),
    );
    crystal.position.set(Math.cos(angle) * 1.12, -0.28, Math.sin(angle) * 1.12);
    chandelier.add(crystal);
  }
  scene.add(chandelier);

  // Velvet aisle runners and side sconces give the cutscene depth with few materials.
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 17), new THREE.MeshStandardMaterial({ color: 0x4b1727, roughness: 0.96 }));
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.set(0, 0.025, -15.2);
  scene.add(aisle);
  for (const x of [-9.6, 9.6]) {
    const sconce = new THREE.PointLight(0xffbd83, 2.4, 8, 2);
    sconce.position.set(x, 3.2, -15);
    scene.add(sconce);
  }

  return {
    usher,
    dancer,
    darkMan,
    chandelier,
    curtainLeft,
    curtainRight,
    doorLeft,
    doorRight,
    redWash,
    stageLight,
    ballroomAmbient: ambient,
    wallPaintings,
  };
}

function makeActor(bodyColor: number, skinColor: number, hairColor: number): THREE.Group {
  const actor = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.86 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9 });
  const hairMaterial = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.78, 3, 7), bodyMaterial);
  body.position.y = 1.08;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMaterial);
  head.position.y = 1.92;
  head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMaterial);
  hair.position.y = 2.02;
  const dress = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.15, 12), bodyMaterial);
  dress.position.y = 0.45;
  const armGeometry = new THREE.CylinderGeometry(0.075, 0.09, 0.9, 7);
  const leftArm = new THREE.Mesh(armGeometry, skinMaterial);
  leftArm.position.set(-0.48, 1.27, 0);
  leftArm.rotation.z = -0.45;
  const rightArm = new THREE.Mesh(armGeometry, skinMaterial);
  rightArm.position.set(0.48, 1.27, 0);
  rightArm.rotation.z = 0.45;
  actor.add(body, head, hair, dress, leftArm, rightArm);
  actor.userData.leftArm = leftArm;
  actor.userData.rightArm = rightArm;
  return actor;
}

function updateTheaterSet(actors: SceneActors, elapsedMs: number): void {
  const usherReveal = smoothstep(2_800, 4_800, elapsedMs);
  actors.usher.visible = usherReveal > 0.015;
  actors.usher.scale.set(0.9, 0.9 * usherReveal, 0.9);

  const doorProgress = smoothstep(2_000, 10_900, elapsedMs);
  actors.doorLeft.rotation.y = -doorProgress * 1.05;
  actors.doorRight.rotation.y = doorProgress * 1.05;

  const curtainProgress = smoothstep(24_000, 31_000, elapsedMs);
  actors.curtainLeft.position.x = -3.35 - curtainProgress * 3.3;
  actors.curtainRight.position.x = 3.35 + curtainProgress * 3.3;

  const reveal = smoothstep(26_000, 29_500, elapsedMs);
  const dance = elapsedMs >= 50_000 ? 1 - smoothstep(50_000, 51_500, elapsedMs) : 1;
  const performerVisibility = 1 - smoothstep(67_000, 67_750, elapsedMs);
  actors.dancer.visible = performerVisibility > 0.01;
  actors.dancer.scale.set(0.82 * (0.95 + reveal * 0.05), 1.05 * reveal * performerVisibility, 0.82);
  actors.dancer.position.x = Math.sin((elapsedMs - 26_000) * 0.00045) * 1.5 * reveal * dance;
  actors.dancer.rotation.y = Math.sin(elapsedMs * 0.0012) * 0.28 * dance;
  actors.dancer.rotation.z = Math.sin(elapsedMs * 0.003) * 0.12 * dance;
  const leftArm = actors.dancer.userData.leftArm as THREE.Mesh;
  const rightArm = actors.dancer.userData.rightArm as THREE.Mesh;
  leftArm.rotation.z = -0.45 - Math.sin(elapsedMs * 0.0018) * 0.48;
  rightArm.rotation.z = 0.45 + Math.sin(elapsedMs * 0.0018 + 1.2) * 0.48;

  const manReveal = smoothstep(31_000, 36_000, elapsedMs);
  const approach = smoothstep(40_000, 46_000, elapsedMs);
  actors.darkMan.visible = elapsedMs < 68_000;
  actors.darkMan.position.x = -4.4 + approach * 3.7;
  actors.darkMan.position.z = -20.2 + approach * 0.35;
  actors.darkMan.scale.setScalar(manReveal * (1.1 + approach * 0.25));
  actors.darkMan.rotation.y = elapsedMs >= 52_800 ? Math.PI + smoothstep(52_800, 53_500, elapsedMs) * Math.PI : 0;
  const attack = smoothstep(56_000, 57_200, elapsedMs) * (1 - smoothstep(66_200, 67_000, elapsedMs));
  actors.dancer.position.y = 0.85 + attack * (1.7 + Math.sin(elapsedMs * 0.11) * 0.12);
  actors.dancer.rotation.x = attack * Math.sin(elapsedMs * 0.08) * 0.25;

  const fall = smoothstep(65_500, 66_200, elapsedMs);
  const settled = smoothstep(66_200, 66_800, elapsedMs);
  actors.chandelier.position.y = 5.25 - fall * 4.6;
  actors.chandelier.rotation.z = fall * 0.5 + Math.sin(elapsedMs * 0.02) * (elapsedMs > 55_000 ? 0.08 : 0.02);
  actors.chandelier.scale.setScalar(1 - settled * 0.18);

  const inversion = smoothstep(50_000, 51_500, elapsedMs);
  actors.redWash.intensity = inversion * 8 + attack * 1.2;
  actors.stageLight.color.setRGB(1, 0.83 - inversion * 0.66, 0.62 - inversion * 0.48);
  actors.stageLight.intensity = 17 * (1 - smoothstep(67_000, 69_000, elapsedMs));
  actors.ballroomAmbient.intensity = 0.52 - inversion * 0.21 - smoothstep(67_000, 69_000, elapsedMs) * 0.27;
  for (const [index, painting] of actors.wallPaintings.entries()) {
    const tilt = smoothstep(57_800, 61_000, elapsedMs) * (index % 2 ? 0.18 : -0.2);
    painting.rotation.z = tilt + Math.sin(elapsedMs * 0.035 + index) * smoothstep(56_000, 57_000, elapsedMs) * 0.035;
  }
}

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: [number, number, number],
  size: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function pulse(time: number, start: number, end: number): number {
  const p = smoothstep(start, end, time);
  return Math.sin(p * Math.PI);
}

function smoothstep(start: number, end: number, time: number): number {
  const t = clamp((time - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}
