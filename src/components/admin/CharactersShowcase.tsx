'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AdminPlayerView } from '@/contracts/admin';
import {
  RemotePlayer,
  resolvePlayerHumanPalette,
} from '@/engine3d/presence/RemotePlayer';
import {
  createSeatedPlayerCharacter,
  createTheaterGeometry,
} from '@/engine3d/theater-geometry';
import { badgeStyle, buttonStyle, hintStyle, panelStyle, titleStyle } from './styles';
import { faDigits, phaseLabel } from './format';

export type CharacterPoseMode = 'standing' | 'walking' | 'running' | 'seated';
export type CameraFramingMode = 'full' | 'closeup' | 'back';
export type LightingPreset = 'studio' | 'theater';
export type ShowcaseTarget =
  | { kind: 'seat'; seatIndex: number }
  | { kind: 'lineup' }
  | { kind: 'player'; player: AdminPlayerView }
  | { kind: 'npc'; npcType: 'dancer' | 'darkMan' };

export interface PlayerCharacterPreset {
  seatIndex: number;
  seatLabel: string;
  row: number;
  col: number;
  archetypeName: string;
  coatLabel: string;
  coatHex: string;
  skinHex: string;
  hairHex: string;
  cravatHex: string;
  hairStyleLabel: string;
}

const COAT_NAMES = [
  'بنفش سلطنتی',
  'آبی نفتی تالار',
  'زرشکی مخملی',
  'سبز زمردی',
  'طلایی عتیقه',
  'سربی تیره',
  'قهوه‌ای ماهون',
  'ارغوانی شبانه',
] as const;

const ARCHETYPE_NAMES = [
  'سارا (صندلی ۱)',
  'مریم (صندلی ۲)',
  'نیما (صندلی ۳)',
  'کیان (صندلی ۴)',
  'لیلا (صندلی ۵)',
  'توحید (صندلی ۶)',
  'امیرعلی (صندلی ۷)',
  'علیرضا (صندلی ۸)',
] as const;

const HAIR_STYLE_LABELS = [
  'کلاسیک فرق‌دار',
  'موج‌دار بلند',
  'جمع‌شده بالای سر',
] as const;

function toHexString(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export const PLAYER_CHARACTER_PRESETS: readonly PlayerCharacterPreset[] = Array.from(
  { length: 8 },
  (_, seatIndex) => {
    const palette = resolvePlayerHumanPalette(`seat-${seatIndex + 1}`, seatIndex);
    const row = Math.floor(seatIndex / 5) + 1;
    const col = (seatIndex % 5) + 1;
    return {
      seatIndex,
      seatLabel: `ردیف ${faDigits(row)} · صندلی ${faDigits(col)}`,
      row,
      col,
      archetypeName: ARCHETYPE_NAMES[seatIndex] ?? `هم‌تیمی ${seatIndex + 1}`,
      coatLabel: COAT_NAMES[seatIndex % COAT_NAMES.length] ?? 'کت کلاسیک',
      coatHex: toHexString(palette.coatColor),
      skinHex: toHexString(palette.skinColor),
      hairHex: toHexString(palette.hairColor),
      cravatHex: toHexString(palette.cravatColor),
      hairStyleLabel: HAIR_STYLE_LABELS[seatIndex % HAIR_STYLE_LABELS.length] ?? 'کلاسیک',
    };
  },
);

export const HUMAN_ANATOMY_PARTS: ReadonlyArray<{
  partId: string;
  title: string;
  details: string;
}> = [
  {
    partId: 'avatar-head',
    title: 'سر، گردن و اجزای چهره',
    details: 'جمجمه بیضی با خط فک، گردن، دو گوش، بینی، دو چشم (صلبیه و مردمک)، ابروها و لب‌ها',
  },
  {
    partId: 'avatar-hair',
    title: 'موی سه‌بخشی سر',
    details: 'کلاهک بالای سر، حجم پشت گردن و چتری پیشانی با ۵ طیف رنگ طبیعی مو',
  },
  {
    partId: 'avatar-body',
    title: 'تنه، کت تئاتر و یقه',
    details: 'قفسه سینه با تناسب طبیعی شانه، دامن کت، یقه برگردان، پیراهن، دستمال گردن و سنجاق طلایی بلیط',
  },
  {
    partId: 'avatar-arm-left / right',
    title: 'دو دست مفصل‌دار',
    details: 'شانه، بازو، ساعد، سرآستین سفید پیراهن و کف دست با انیمیشن تاب خوردن هنگام راه رفتن',
  },
  {
    partId: 'avatar-leg-left / right',
    title: 'دو پای مفصل‌دار و کفش',
    details: 'ران، ساق شلوار و کفش چرمی روی سطح زمین (y = 0) با سیکل گام‌برداری و حالت نشسته',
  },
  {
    partId: 'avatar-name',
    title: 'پلاک نام شناور (Sprite)',
    details: 'بوم فارسی راست‌به‌چپ با قاب طلایی بالای سر کاراکتر در ارتفاع ۲٫۰۸ متر',
  },
];

/** پیش‌نمایش دوبعدی نیم‌تنهٔ انسانی (مشابه نمای کات‌سین سالن) */
function HumanBustPreviewSvg({ preset }: { preset: PlayerCharacterPreset }) {
  const hairVariant = preset.seatIndex % 3;
  return (
    <svg
      viewBox="0 0 120 120"
      width={88}
      height={88}
      role="img"
      aria-label={`نیم‌تنهٔ دوبعدی ${preset.archetypeName}`}
      style={{
        background: 'radial-gradient(circle at 50% 35%, rgba(212,175,99,0.16), rgba(12,9,14,0.95))',
        borderRadius: 12,
        border: '1px solid var(--line)',
        flexShrink: 0,
      }}
    >
      <path d="M12 120 C16 90 34 80 60 80 C86 80 104 90 108 120 Z" fill={preset.coatHex} />
      <path d="M47 81 L60 108 L73 81 Z" fill="#f1e6d2" />
      <path d="M56 84 L60 106 L64 84 Z" fill={preset.cravatHex} />
      <path d="M44 80 L55 110 L47 112 L37 85 Z" fill="rgba(12,8,16,0.38)" />
      <path d="M76 80 L65 110 L73 112 L83 85 Z" fill="rgba(12,8,16,0.38)" />
      <rect x="74" y="96" width="8" height="4.5" rx="1.2" fill="#d4af63" />
      <rect x="52" y="68" width="16" height="16" rx="6" fill={preset.skinHex} />
      <path d="M52 72 Q60 77 68 72 L68 76 Q60 80 52 76 Z" fill="rgba(40,22,12,0.18)" />
      {hairVariant === 1 && (
        <path d="M34 52 Q30 72 38 82 L82 82 Q90 72 86 52 Z" fill={preset.hairHex} />
      )}
      <ellipse cx="37" cy="54" rx="4.2" ry="6.5" fill={preset.skinHex} />
      <ellipse cx="83" cy="54" rx="4.2" ry="6.5" fill={preset.skinHex} />
      <path
        d="M38 48 C38 30 47 24 60 24 C73 24 82 30 82 48 C82 61 73 73 60 74 C47 73 38 61 38 48 Z"
        fill={preset.skinHex}
      />
      <path d="M44 46 Q50 43.5 55 45.5" stroke={preset.hairHex} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M65 45.5 Q70 43.5 76 46" stroke={preset.hairHex} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="51.5" rx="4.2" ry="2.7" fill="#faf4ea" />
      <ellipse cx="70" cy="51.5" rx="4.2" ry="2.7" fill="#faf4ea" />
      <circle cx="50" cy="51.5" r="2.2" fill="#2b1d14" />
      <circle cx="70" cy="51.5" r="2.2" fill="#2b1d14" />
      <circle cx="50.8" cy="50.8" r="0.7" fill="#ffffff" />
      <circle cx="70.8" cy="50.8" r="0.7" fill="#ffffff" />
      <path d="M60 49 L58.5 58.5 Q60 60 62 58.5" stroke="rgba(90,52,32,0.48)" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M53.5 64.5 Q60 67.2 66.5 64.5" stroke="#8e4e3b" strokeWidth="2.1" fill="none" strokeLinecap="round" />
      {hairVariant === 0 && (
        <path
          d="M36 50 C35 30 46 20 60 20 C75 20 85 30 84 50 C80 39 73 34 62 35 C50 36 42 40 36 50 Z"
          fill={preset.hairHex}
        />
      )}
      {hairVariant === 1 && (
        <path
          d="M35 51 C35 29 46 19 60 19 C74 19 85 29 85 51 C81 38 71 33 60 33 C49 33 39 38 35 51 Z"
          fill={preset.hairHex}
        />
      )}
      {hairVariant === 2 && (
        <>
          <circle cx="60" cy="18" r="7.5" fill={preset.hairHex} />
          <path
            d="M36 49 C36 29 46 21 60 21 C74 21 84 29 84 49 C78 37 69 34 60 34 C51 34 42 37 36 49 Z"
            fill={preset.hairHex}
          />
        </>
      )}
    </svg>
  );
}

export interface CharactersShowcaseProps {
  players: readonly AdminPlayerView[];
}

export default function CharactersShowcase({ players }: CharactersShowcaseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [target, setTarget] = useState<ShowcaseTarget>({ kind: 'seat', seatIndex: 0 });
  const [poseMode, setPoseMode] = useState<CharacterPoseMode>('walking');
  const [framing, setFraming] = useState<CameraFramingMode>('full');
  const [lighting, setLighting] = useState<LightingPreset>('studio');
  const [autoRotate, setAutoRotate] = useState(true);
  const [yawDeg, setYawDeg] = useState(22);
  const [headPitchDeg, setHeadPitchDeg] = useState(0);
  const [webglReady, setWebglReady] = useState(true);

  const dragRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });
  const stateRef = useRef({
    poseMode,
    framing,
    lighting,
    autoRotate,
    yawDeg,
    headPitchDeg,
  });
  stateRef.current = { poseMode, framing, lighting, autoRotate, yawDeg, headPitchDeg };

  const activePreset = useMemo(() => {
    if (target.kind === 'seat') {
      return PLAYER_CHARACTER_PRESETS[target.seatIndex] ?? PLAYER_CHARACTER_PRESETS[0]!;
    }
    if (target.kind === 'player') {
      return (
        PLAYER_CHARACTER_PRESETS[target.player.seatIndex % PLAYER_CHARACTER_PRESETS.length] ??
        PLAYER_CHARACTER_PRESETS[0]!
      );
    }
    return PLAYER_CHARACTER_PRESETS[0]!;
  }, [target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglReady(false);
      return;
    }

    setWebglReady(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0911);
    scene.fog = new THREE.FogExp2(0x0d0911, 0.045);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);

    // سکوی نمایش تئاتر با حلقه طلایی
    const stageGroup = new THREE.Group();
    const floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.1, 0.16, 48),
      new THREE.MeshStandardMaterial({ color: 0x1b141d, roughness: 0.78, metalness: 0.12 }),
    );
    floorMesh.position.y = -0.08;
    floorMesh.receiveShadow = true;
    stageGroup.add(floorMesh);

    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.82, 0.035, 12, 64),
      new THREE.MeshStandardMaterial({ color: 0xd4af63, roughness: 0.35, metalness: 0.75 }),
    );
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = 0.01;
    stageGroup.add(goldRing);
    scene.add(stageGroup);

    // نورپردازی
    const ambientLight = new THREE.AmbientLight(0xf3ead8, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff0d6, 1.65);
    keyLight.position.set(3.2, 5.5, 4.2);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xd4af63, 1.2, 12);
    rimLight.position.set(-2.8, 3.0, -2.6);
    scene.add(rimLight);

    const crimsonSpot = new THREE.PointLight(0x9e1f32, 0.4, 10);
    crimsonSpot.position.set(2.4, 2.2, -2.2);
    scene.add(crimsonSpot);

    // ساخت کاراکتر(ها) بر اساس انتخاب ادمین
    const actorsRoot = new THREE.Group();
    scene.add(actorsRoot);

    const remoteActors: RemotePlayer[] = [];
    const seatedActors: THREE.Group[] = [];
    let theaterHelper: ReturnType<typeof createTheaterGeometry> | null = null;

    if (target.kind === 'lineup') {
      // نمایش هر ۸ کاراکتر پلیر کنار هم روی صحنه
      PLAYER_CHARACTER_PRESETS.forEach((preset, idx) => {
        const x = (idx - 3.5) * 0.72;
        const z = Math.abs(idx - 3.5) * -0.18;
        const avatar = new RemotePlayer({
          playerId: `seat-${idx + 1}`,
          playerName: preset.archetypeName,
          seatIndex: idx,
          updatedAt: 100,
          transform: {
            x,
            y: 1.65,
            z,
            yawDeg: 180 + (3.5 - idx) * 7,
            pitchDeg: 0,
          },
        });
        actorsRoot.add(avatar);
        remoteActors.push(avatar);
      });
    } else if (target.kind === 'npc') {
      theaterHelper = createTheaterGeometry();
      const npc =
        target.npcType === 'dancer' ? theaterHelper.dancer : theaterHelper.darkMan;
      npc.visible = true;
      npc.position.set(0, 0, 0);
      npc.rotation.y = 0;
      actorsRoot.add(npc);
    } else {
      const seatIndex =
        target.kind === 'seat' ? target.seatIndex : target.player.seatIndex;
      const playerId =
        target.kind === 'seat' ? `seat-${seatIndex + 1}` : target.player.playerId;
      const playerName =
        target.kind === 'seat'
          ? (PLAYER_CHARACTER_PRESETS[seatIndex]?.archetypeName ?? `صندلی ${seatIndex + 1}`)
          : `${target.player.playerName} (${target.player.roomCode})`;

      if (poseMode === 'seated') {
        // ساخت یک صندلی مخملی تئاتر + کاراکتر انسان نشسته روی آن
        theaterHelper = createTheaterGeometry();
        const sampleSeat = theaterHelper.seats[0];
        if (sampleSeat) {
          sampleSeat.position.set(0, 0, 0);
          sampleSeat.rotation.y = Math.PI;
          const seated = createSeatedPlayerCharacter({
            playerId,
            playerName,
            seatIndex,
            isLocalPlayer: false,
          });
          sampleSeat.add(seated);
          actorsRoot.add(sampleSeat);
          seatedActors.push(seated);
        }
      } else {
        const avatar = new RemotePlayer({
          playerId,
          playerName,
          seatIndex,
          updatedAt: 100,
          transform: {
            x: 0,
            y: 1.65,
            z: 0,
            yawDeg: 180,
            pitchDeg: stateRef.current.headPitchDeg,
          },
        });
        actorsRoot.add(avatar);
        remoteActors.push(avatar);
      }
    }

    const resize = () => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    let rafId = 0;
    let clockTime = 0;
    let simTimestamp = 200;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = 1 / 60;
      clockTime += dt;

      const current = stateRef.current;

      // تنظیم نور بر اساس حالت انتخابی
      if (current.lighting === 'studio') {
        ambientLight.intensity = 0.95;
        keyLight.intensity = 1.75;
        crimsonSpot.intensity = 0.25;
      } else {
        ambientLight.intensity = 0.38;
        keyLight.intensity = 0.95;
        crimsonSpot.intensity = 1.35;
      }

      if (current.autoRotate && !dragRef.current.active) {
        current.yawDeg = (current.yawDeg + dt * 24) % 360;
      }

      const orbitRad = THREE.MathUtils.degToRad(current.yawDeg);
      const isLineup = target.kind === 'lineup';

      const distance = isLineup
        ? 5.8
        : current.framing === 'closeup'
          ? 1.25
          : 2.85;
      const camY = isLineup
        ? 1.55
        : current.framing === 'closeup'
          ? poseMode === 'seated'
            ? 1.22
            : 1.52
          : poseMode === 'seated'
            ? 1.15
            : 1.32;
      const lookY = isLineup
        ? 1.05
        : current.framing === 'closeup'
          ? poseMode === 'seated'
            ? 1.15
            : 1.48
          : poseMode === 'seated'
            ? 0.82
            : 1.02;

      const effectiveAngle =
        current.framing === 'back' ? orbitRad + Math.PI : orbitRad;

      camera.position.set(
        Math.sin(effectiveAngle) * distance,
        camY,
        Math.cos(effectiveAngle) * distance,
      );
      camera.lookAt(0, lookY, 0);

      // به‌روزرسانی انیمیشن کاراکترها در هر فریم
      remoteActors.forEach((actor, idx) => {
        const baseX = isLineup ? (idx - 3.5) * 0.72 : 0;
        const baseZ = isLineup ? Math.abs(idx - 3.5) * -0.18 : 0;
        const baseYaw = isLineup ? 180 + (3.5 - idx) * 7 : 180;

        if (current.poseMode === 'walking' || current.poseMode === 'running') {
          const speedMultiplier = current.poseMode === 'running' ? 3.2 : 1.7;
          simTimestamp += 16;
          // ایجاد تغییر موقعیت کوچک و بازگرداندن به مرکز برای فعال نگه داشتن سیکل گام‌برداری درجا
          actor.position.z -= dt * speedMultiplier;
          actor.setSnapshot({
            playerId: actor.playerId,
            updatedAt: simTimestamp,
            transform: {
              x: baseX,
              y: 1.65,
              z: baseZ,
              yawDeg: baseYaw,
              pitchDeg: current.headPitchDeg,
            },
          });
          actor.update(dt);
          actor.position.x = baseX;
          actor.position.z = baseZ;
        } else {
          simTimestamp += 16;
          actor.setSnapshot({
            playerId: actor.playerId,
            updatedAt: simTimestamp,
            transform: {
              x: baseX,
              y: 1.65,
              z: baseZ,
              yawDeg: baseYaw,
              pitchDeg: current.headPitchDeg,
            },
          });
          actor.update(dt);
        }
      });

      seatedActors.forEach((seated, idx) => {
        const phase = clockTime * 2.2 + idx;
        const body = seated.getObjectByName('avatar-body');
        const head = seated.getObjectByName('avatar-head');
        if (body) body.position.y = 0.78 + Math.sin(phase) * 0.009;
        if (head) {
          head.position.y = 1.2 + Math.sin(phase) * 0.01;
          head.rotation.y = Math.sin(phase * 0.5) * 0.1;
          head.rotation.x = THREE.MathUtils.degToRad(current.headPitchDeg * 0.6);
        }
      });

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      remoteActors.forEach((a) => a.dispose());
      theaterHelper?.dispose();
      renderer.dispose();
    };
  }, [target, poseMode]);

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {/* بخش ۱: صحنهٔ سه‌بعدی تعاملی و کنترل‌های بررسی کاراکتر */}
      <section aria-label="نمایشگر سه‌بعدی کاراکترها" style={panelStyle}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div>
            <h2 style={titleStyle}>استودیوی سه‌بعدی کاراکترهای بازی</h2>
            <p style={{ ...hintStyle, margin: '4px 0 0' }}>
              مدل سه‌بعدی کامل پلیرها (سر، مو، اجزای صورت، کت تئاتر، دست‌ها و پاهای مفصل‌دار) و شخصیت‌های صحنه را از همهٔ زوایا بررسی کنید.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              style={{
                ...buttonStyle,
                background: target.kind === 'lineup' ? 'var(--gold)' : 'var(--panel-light)',
                color: target.kind === 'lineup' ? 'var(--ink)' : 'var(--text-primary)',
                fontWeight: target.kind === 'lineup' ? 700 : 400,
              }}
              onClick={() => setTarget({ kind: 'lineup' })}
            >
              👥 نمایش دسته‌جمعی هر ۸ پلیر
            </button>
            <button
              type="button"
              style={{
                ...buttonStyle,
                background:
                  target.kind === 'npc' && target.npcType === 'dancer'
                    ? 'var(--gold)'
                    : 'var(--panel-light)',
                color:
                  target.kind === 'npc' && target.npcType === 'dancer'
                    ? 'var(--ink)'
                    : 'var(--text-primary)',
              }}
              onClick={() => setTarget({ kind: 'npc', npcType: 'dancer' })}
            >
              💃 بانوی ایتالیایی (NPC)
            </button>
            <button
              type="button"
              style={{
                ...buttonStyle,
                background:
                  target.kind === 'npc' && target.npcType === 'darkMan'
                    ? 'var(--gold)'
                    : 'var(--panel-light)',
                color:
                  target.kind === 'npc' && target.npcType === 'darkMan'
                    ? 'var(--ink)'
                    : 'var(--text-primary)',
              }}
              onClick={() => setTarget({ kind: 'npc', npcType: 'darkMan' })}
            >
              🎩 مرد سیاه‌پوش (NPC)
            </button>
          </div>
        </div>

        {/* نوار کنترل حالت بدن، زاویه دوربین و نور */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-3)',
            borderRadius: 10,
            background: 'var(--ink-soft)',
            border: '1px solid var(--line)',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gold-light)', marginInlineEnd: 4 }}>
            حالت حرکت پلیر:
          </span>
          {(
            [
              ['standing', '🧍 ایستاده (تنفس)'],
              ['walking', '🚶 راه رفتن'],
              ['running', '🏃 دویدن'],
              ['seated', '🪑 نشسته روی صندلی'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              style={{
                ...buttonStyle,
                minHeight: 32,
                padding: '0 10px',
                background: poseMode === mode ? 'var(--gold)' : 'transparent',
                color: poseMode === mode ? 'var(--ink)' : 'var(--text-primary)',
              }}
              onClick={() => setPoseMode(mode)}
            >
              {label}
            </button>
          ))}

          <span style={{ width: 1, height: 22, background: 'var(--line)', marginInline: 6 }} />

          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gold-light)', marginInlineEnd: 4 }}>
            کادر دوربین:
          </span>
          {(
            [
              ['full', 'نمای کامل قدی'],
              ['closeup', 'نزدیک چهره و نیم‌تنه'],
              ['back', 'نمای پشت سر'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              style={{
                ...buttonStyle,
                minHeight: 32,
                padding: '0 10px',
                background: framing === mode ? 'var(--gold)' : 'transparent',
                color: framing === mode ? 'var(--ink)' : 'var(--text-primary)',
              }}
              onClick={() => setFraming(mode)}
            >
              {label}
            </button>
          ))}

          <span style={{ width: 1, height: 22, background: 'var(--line)', marginInline: 6 }} />

          <button
            type="button"
            style={{
              ...buttonStyle,
              minHeight: 32,
              padding: '0 10px',
              background: autoRotate ? 'rgba(50,120,70,0.28)' : 'transparent',
            }}
            onClick={() => setAutoRotate((v) => !v)}
          >
            {autoRotate ? '🔄 چرخش خودکار: روشن' : '⏸️ چرخش خودکار: خاموش'}
          </button>

          <button
            type="button"
            style={{
              ...buttonStyle,
              minHeight: 32,
              padding: '0 10px',
            }}
            onClick={() => setLighting((l) => (l === 'studio' ? 'theater' : 'studio'))}
          >
            {lighting === 'studio' ? '💡 نور: استودیویی روشن' : '🕯️ نور: دراماتیک تالار'}
          </button>
        </div>

        {/* بوم سه‌بعدی */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 440,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--line)',
            background: '#0d0911',
          }}
        >
          {webglReady ? (
            <canvas
              ref={canvasRef}
              aria-label="بوم سه‌بعدی نمایش کاراکترهای بازی"
              style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
              onPointerDown={(e) => {
                dragRef.current = { active: true, lastX: e.clientX };
                setAutoRotate(false);
              }}
              onPointerMove={(e) => {
                if (!dragRef.current.active) return;
                const dx = e.clientX - dragRef.current.lastX;
                dragRef.current.lastX = e.clientX;
                setYawDeg((prev) => (prev - dx * 0.65 + 360) % 360);
              }}
              onPointerUp={() => {
                dragRef.current.active = false;
              }}
              onPointerCancel={() => {
                dragRef.current.active = false;
              }}
            />
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                color: 'var(--text-secondary)',
              }}
            >
              پیش‌نمایش کارت‌های دوبعدی و مشخصات کامل کاراکترها در پایین قابل مشاهده است.
            </div>
          )}

          {/* برچسب اطلاعات کاراکتر فعلی روی بوم */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(12, 9, 14, 0.84)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-primary)',
              pointerEvents: 'none',
            }}
          >
            {target.kind === 'lineup' && (
              <strong>👥 نمایش دسته‌جمعی هر ۸ کاراکتر پلیر (ردیف اول و دوم)</strong>
            )}
            {target.kind === 'npc' && (
              <strong>
                {target.npcType === 'dancer'
                  ? '💃 بانوی خواننده و رقصنده ایتالیایی (قد ۱٫۷۲ متر)'
                  : '🎩 مرد بلندقد سیاه‌پوش (قد ۱٫۹۵ متر)'}
              </strong>
            )}
            {target.kind === 'seat' && (
              <div>
                <strong>🎭 {activePreset.archetypeName}</strong>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  {activePreset.seatLabel} · کت {activePreset.coatLabel} · موی {activePreset.hairStyleLabel}
                </div>
              </div>
            )}
            {target.kind === 'player' && (
              <div>
                <strong>
                  🎭 بازیکن فعال: {target.player.playerName} ({target.player.roomCode})
                </strong>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  {target.player.seatLabel} · فاز: {phaseLabel(target.player.phase)}
                </div>
              </div>
            )}
          </div>

          {/* اسلایدر زاویه چرخش و خم شدن سر */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              right: 12,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(12, 9, 14, 0.82)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 'var(--text-xs)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>زاویه چرخش دوربین ({faDigits(Math.round(yawDeg))}°):</span>
              <input
                type="range"
                min={0}
                max={360}
                value={Math.round(yawDeg)}
                onChange={(e) => {
                  setAutoRotate(false);
                  setYawDeg(Number(e.target.value));
                }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>زاویه نگاه عمودی سر پلیر ({faDigits(headPitchDeg)}°):</span>
              <input
                type="range"
                min={-22}
                max={22}
                value={headPitchDeg}
                onChange={(e) => setHeadPitchDeg(Number(e.target.value))}
              />
            </label>
          </div>
        </div>
      </section>

      {/* بخش ۲: گالری کامل ۸ کاراکتر پلیر (۳ تا ۸ نفر) */}
      <section aria-label="فهرست ۸ کاراکتر پلیر" style={panelStyle}>
        <h2 style={titleStyle}>کارت‌های کامل ۸ کاراکتر پلیر (صندلی‌های ۱ تا ۸)</h2>
        <p style={{ ...hintStyle, margin: '4px 0 12px' }}>
          روی هر کاراکتر کلیک کنید تا مدل سه‌بعدی آن در استودیوی بالا باز شود. هر صندلی رنگ کت، رنگ پوست، مدل مو و دستمال گردن اختصاصی دارد.
        </p>

        <div
          style={{
            display: 'grid',
            gap: 'var(--space-3)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))',
          }}
        >
          {PLAYER_CHARACTER_PRESETS.map((preset) => {
            const isSelected =
              target.kind === 'seat' && target.seatIndex === preset.seatIndex;
            return (
              <article
                key={preset.seatIndex}
                data-testid={`character-card-seat-${preset.seatIndex}`}
                onClick={() => setTarget({ kind: 'seat', seatIndex: preset.seatIndex })}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(212, 175, 99, 0.14)' : 'var(--ink-soft)',
                  border: isSelected
                    ? '1px solid var(--gold)'
                    : '1px solid var(--line)',
                  alignItems: 'center',
                }}
              >
                <HumanBustPreviewSvg preset={preset} />

                <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <strong style={{ color: 'var(--gold-light)', fontSize: 'var(--text-sm)' }}>
                      {preset.archetypeName}
                    </strong>
                    <span style={badgeStyle(isSelected ? 'ok' : 'warn')}>
                      {preset.seatLabel}
                    </span>
                  </div>

                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    لباس: کت {preset.coatLabel}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    مدل مو: {preset.hairStyleLabel}
                  </span>

                  {/* نمونه‌رنگ‌های کت، پوست، مو و دستمال گردن */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span
                      title={`رنگ کت: ${preset.coatHex}`}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: preset.coatHex,
                        border: '1px solid rgba(255,255,255,0.25)',
                      }}
                    />
                    <span
                      title={`رنگ پوست: ${preset.skinHex}`}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: preset.skinHex,
                        border: '1px solid rgba(255,255,255,0.25)',
                      }}
                    />
                    <span
                      title={`رنگ مو: ${preset.hairHex}`}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: preset.hairHex,
                        border: '1px solid rgba(255,255,255,0.25)',
                      }}
                    />
                    <span
                      title={`دستمال گردن: ${preset.cravatHex}`}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: preset.cravatHex,
                        border: '1px solid rgba(255,255,255,0.25)',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--gold-light)', marginInlineStart: 'auto' }}>
                      {isSelected ? '● در حال نمایش' : 'مشاهده سه‌بعدی ←'}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* بخش ۳: بازیکنان فعال در اتاق‌های فعلی */}
      <section aria-label="کاراکتر بازیکنان حاضر در اتاق‌ها" style={panelStyle}>
        <h2 style={titleStyle}>کاراکتر بازیکنان حاضر در اتاق‌ها ({faDigits(players.length)} نفر)</h2>
        {players.length === 0 ? (
          <p style={{ ...hintStyle, marginTop: 8 }}>
            در حال حاضر بازیکنی در اتاق‌ها ثبت نشده است؛ از کارت‌های صندلی ۱ تا ۸ بالا می‌توانید تمام کاراکترهای پلیر را بررسی کنید.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-3)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              marginTop: 10,
            }}
          >
            {players.map((player) => {
              const preset =
                PLAYER_CHARACTER_PRESETS[
                  player.seatIndex % PLAYER_CHARACTER_PRESETS.length
                ] ?? PLAYER_CHARACTER_PRESETS[0]!;
              const isSelected =
                target.kind === 'player' &&
                target.player.playerId === player.playerId &&
                target.player.roomCode === player.roomCode;

              return (
                <div
                  key={`${player.roomCode}-${player.playerId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 10,
                    borderRadius: 10,
                    background: isSelected ? 'rgba(212,175,99,0.14)' : 'var(--ink-soft)',
                    border: isSelected ? '1px solid var(--gold)' : '1px solid var(--line)',
                  }}
                >
                  <HumanBustPreviewSvg preset={preset} />
                  <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                      {player.playerName}
                    </strong>
                    <span style={hintStyle}>
                      اتاق {player.roomCode} · {player.seatLabel}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <span style={badgeStyle(player.isOnline ? 'ok' : 'off')}>
                        {player.isOnline ? 'آنلاین' : 'آفلاین'}
                      </span>
                      <button
                        type="button"
                        style={{ ...buttonStyle, minHeight: 30, padding: '0 10px', fontSize: 'var(--text-xs)' }}
                        onClick={() => setTarget({ kind: 'player', player })}
                      >
                        نمایش سه‌بعدی
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* بخش ۴: کالبدشکافی اجزای مدل سه‌بعدی انسان */}
      <section aria-label="ساختار آناتومی کاراکتر سه‌بعدی" style={panelStyle}>
        <h2 style={titleStyle}>کالبدشکافی و اجزای مدل سه‌بعدی کاراکتر پلیر</h2>
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-3)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            marginTop: 10,
          }}
        >
          {HUMAN_ANATOMY_PARTS.map((item) => (
            <div
              key={item.partId}
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'var(--ink-soft)',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong style={{ color: 'var(--gold-light)', fontSize: 'var(--text-sm)' }}>
                  {item.title}
                </strong>
                <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.partId}</code>
              </div>
              <p style={{ ...hintStyle, margin: '6px 0 0' }}>{item.details}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
