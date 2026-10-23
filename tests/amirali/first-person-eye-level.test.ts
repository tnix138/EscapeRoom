import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_HUMAN_LOOKS,
  resolveHumanLook,
} from '@/engine3d/characters/human-presets';
import {
  DEFAULT_PLAYER_EYE_HEIGHT,
  HumanAvatar,
  getHumanEyeHeight,
} from '@/engine3d/characters/human-avatar';
import { RemotePlayer } from '@/engine3d/presence/RemotePlayer';
import {
  ALLEY_SIDEWALK_HEIGHT,
  alleyWalkableGroundAt,
} from '@/engine3d/alley-ground-profile';
import {
  auditoriumWalkableGroundAt,
  createSeatedPlayerCharacter,
  createTheaterGeometry,
} from '@/engine3d/theater-geometry';
import {
  clearTransform,
  resolveInitialTransform,
  resolvePlayerEyeHeight,
  saveTransform,
} from '@/engine3d/spawn';
import { PlayerController } from '@/engine3d/player-controller';
import { lookTarget } from '@/engine3d/look-input';
import {
  PRESENCE_BOUNDS,
  sanitizePresenceInput,
} from '@/server/realtime/presence-tracker';

describe('تراز دقیق دوربین اول‌شخص با مردمک چشم و قد یکسان کاراکترها', () => {
  it('هر ۸ کاراکتر پلیر هم‌قد (~۱٫۷۸ متر) هستند، کفش‌هایشان روی زمین است و مردمک چشمشان دقیقاً در ۱٫۶۵ متر قرار دارد', () => {
    const heights: number[] = [];

    for (let seat = 0; seat < DEFAULT_HUMAN_LOOKS.length; seat++) {
      const look = DEFAULT_HUMAN_LOOKS[seat]!;
      const avatar = new HumanAvatar({ look });
      avatar.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(avatar);
      const eyeWorld = avatar.getEyeWorldPosition(new THREE.Vector3());
      const resolvedEye = resolvePlayerEyeHeight(`seat-${seat + 1}`, seat, look.displayName);

      heights.push(box.max.y);

      // کف کفش دقیقاً روی سطح زمین (y = 0) بدون معلق بودن یا فرورفتن
      expect(Math.abs(box.min.y)).toBeLessThan(0.005);

      // قد ایستاده طبیعی بزرگسال و تاج سر کاملاً بالاتر از دوربین (~۱۳ سانتی‌متر بالای چشم)
      expect(box.max.y).toBeGreaterThan(1.76);
      expect(box.max.y).toBeLessThan(1.81);
      expect(box.max.y - eyeWorld.y).toBeGreaterThan(0.115);

      // انطباق کامل ارتفاع چشم محاسباتی و موقعیت واقعی کرهٔ چشم سه‌بعدی
      expect(eyeWorld.y).toBeCloseTo(DEFAULT_PLAYER_EYE_HEIGHT, 4);
      expect(avatar.eyeHeight).toBeCloseTo(eyeWorld.y, 5);
      expect(getHumanEyeHeight(look)).toBeCloseTo(eyeWorld.y, 5);
      expect(resolvedEye).toBeCloseTo(eyeWorld.y, 5);

      avatar.dispose();
    }

    // وقتی دو کاراکتر بغل هم می‌ایستند قدشان با هم هماهنگ و برابر است (اختلاف کمتر از ۱٫۲ سانتی‌متر)
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    expect(maxHeight - minHeight).toBeLessThan(0.012);
  });

  it('وقتی دو بازیکن کنار هم می‌ایستند، خط دید افقی دوربین اول‌شخص دقیقاً از وسط چشم هم‌تیمی می‌گذرد و هرگز بالای سر او نیست', () => {
    for (let mySeat = 0; mySeat < 4; mySeat++) {
      const peerSeat = (mySeat + 1) % 8;
      const myTransform = resolveInitialTransform('EYE01', `me-${mySeat}`, mySeat);

      const peer = new RemotePlayer({
        playerId: `peer-${peerSeat}`,
        playerName: DEFAULT_HUMAN_LOOKS[peerSeat]!.displayName,
        seatIndex: peerSeat,
        updatedAt: 1_000,
        transform: {
          x: myTransform.x,
          y: resolvePlayerEyeHeight(`peer-${peerSeat}`, peerSeat),
          z: myTransform.z - 1.25,
          yawDeg: 180,
          pitchDeg: 0,
        },
      });
      peer.updateMatrixWorld(true);

      const peerBox = new THREE.Box3().setFromObject(peer.avatar);
      const peerEyes = peer.getEyeWorldPosition(new THREE.Vector3());

      // کفش هم‌تیمی روی زمین و چشم‌هایش هم‌تراز دوربین بازیکن محلی
      expect(Math.abs(peerBox.min.y)).toBeLessThan(0.005);
      expect(myTransform.y).toBeCloseTo(peerEyes.y, 4);
      expect(peerBox.max.y).toBeGreaterThan(myTransform.y + 0.115);

      // بررسی پروجکشن واقعی دوربین پرسپکتیو اول‌شخص با pitch = 0
      const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 140);
      const horizontalPose = { ...myTransform, yawDeg: 0, pitchDeg: 0 };
      camera.position.set(horizontalPose.x, horizontalPose.y, horizontalPose.z);
      const target = lookTarget(horizontalPose);
      camera.lookAt(target.x, target.y, target.z);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();

      const eyeNdc = peerEyes.clone().project(camera);
      const crownNdc = new THREE.Vector3(peerEyes.x, peerBox.max.y, peerEyes.z).project(camera);

      // مرکز کراس‌هیر (ndc.y === 0) دقیقاً روی مردمک چشم هم‌تیمی می‌نشیند و بالای سرش بالای مرکز تصویر است
      expect(Math.abs(eyeNdc.y)).toBeLessThan(1e-4);
      expect(crownNdc.y).toBeGreaterThan(0.12);

      peer.dispose();
    }
  });

  it('برای کاراکترهای با قد سفارشی هم RemotePlayer ارتفاع چشم واقعی همان کاراکتر را مبنا قرار می‌دهد', () => {
    const customLook = resolveHumanLook('custom-tall', undefined, {
      overrides: { heightMeters: 1.9 },
    });
    const customEyeHeight = getHumanEyeHeight(customLook);
    const avatar = new HumanAvatar({ look: customLook });
    avatar.updateMatrixWorld(true);

    expect(avatar.eyeHeight).toBeCloseTo(customEyeHeight, 5);
    expect(avatar.getEyeWorldPosition().y).toBeCloseTo(customEyeHeight, 4);
    avatar.dispose();
  });

  it('در پیاده‌روی کوچه، سن نمایش و سکوهای پلکانی سالن تاریک، ارتفاع دوربین و کف پا با سطح زمین هماهنگ می‌ماند', () => {
    // ۱) پیاده‌روی کوچه
    expect(alleyWalkableGroundAt(0)).toBe(0);
    expect(alleyWalkableGroundAt(6.5)).toBeCloseTo(ALLEY_SIDEWALK_HEIGHT, 5);

    const alleyCtrl = new PlayerController(
      { x: 6.5, y: DEFAULT_PLAYER_EYE_HEIGHT, z: 2, yawDeg: 0, pitchDeg: 0 },
      undefined,
      {
        eyeHeight: DEFAULT_PLAYER_EYE_HEIGHT,
        groundHeightAt: (x) => alleyWalkableGroundAt(x),
      },
      [],
    );
    const onSidewalk = alleyCtrl.getTransform();
    expect(onSidewalk.y).toBeCloseTo(ALLEY_SIDEWALK_HEIGHT + DEFAULT_PLAYER_EYE_HEIGHT, 4);

    const peerOnSidewalk = new RemotePlayer({
      playerId: 'sidewalk-peer',
      seatIndex: 1,
      updatedAt: 2_000,
      transform: onSidewalk,
    });
    peerOnSidewalk.updateMatrixWorld(true);
    expect(peerOnSidewalk.position.y).toBeCloseTo(ALLEY_SIDEWALK_HEIGHT, 4);
    expect(peerOnSidewalk.getEyeWorldPosition().y).toBeCloseTo(onSidewalk.y, 4);
    peerOnSidewalk.dispose();

    // ۲) سن و سکوهای سالن تئاتر (همگی در محدودهٔ مجاز PRESENCE_BOUNDS سرور و پذیرفته‌شده در sanitizePresenceInput)
    const stageGround = auditoriumWalkableGroundAt(0, -6);
    const riser4Ground = auditoriumWalkableGroundAt(0, 7.2);
    expect(stageGround).toBeCloseTo(0.6, 5);
    expect(riser4Ground).toBeCloseTo(0.96, 5);
    expect(riser4Ground + DEFAULT_PLAYER_EYE_HEIGHT).toBeLessThanOrEqual(PRESENCE_BOUNDS.maxY);

    const sanitizedOnRiser = sanitizePresenceInput(
      {
        position: { x: 0, y: riser4Ground + DEFAULT_PLAYER_EYE_HEIGHT, z: 7.2 },
        yaw: 0,
        phase: 'in_theater',
      },
      { playerId: 'p-riser', seatIndex: 0, playerName: 'سارا' },
      3_000,
    );
    expect(sanitizedOnRiser).not.toBeNull();
    expect(sanitizedOnRiser!.position.y).toBeCloseTo(riser4Ground + DEFAULT_PLAYER_EYE_HEIGHT, 4);
  });

  it('resolveInitialTransform مقدار y قدیمیِ ذخیره‌شده در localStorage را با تراز دقیق چشم کاراکتر بازکالیبره می‌کند', () => {
    const storage = new Map<string, string>();
    const prevStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });

    try {
      saveTransform('RECAL', 'player-0', {
        x: 0,
        y: 2.05, // مقدار قدیمی/اشتباه بالاتر از قد کاراکتر
        z: 5,
        yawDeg: 15,
        pitchDeg: -4,
      });

      const restored = resolveInitialTransform('RECAL', 'player-0', 0, {
        groundHeightAt: (x) => alleyWalkableGroundAt(x),
      });
      expect(restored.x).toBeCloseTo(0, 3);
      expect(restored.z).toBeCloseTo(5, 3);
      expect(restored.y).toBeCloseTo(DEFAULT_PLAYER_EYE_HEIGHT, 4);

      clearTransform('RECAL', 'player-0');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: prevStorage,
      });
    }
  });

  it('در حالت نشسته روی صندلی تئاتر نیز getEyeWorldPosition مختصات واقعی چشم کاراکتر نشسته را برمی‌گرداند', () => {
    const theater = createTheaterGeometry();
    const seat = theater.seats[0]!;
    const seated = createSeatedPlayerCharacter({
      playerId: 'seated-me',
      playerName: 'امیرعلی',
      seatIndex: 6,
      isLocalPlayer: true,
    });
    seat.add(seated);
    theater.group.updateMatrixWorld(true);

    const rig = seated.userData.humanAvatar as HumanAvatar;
    const eyeWorld = rig.getEyeWorldPosition(new THREE.Vector3());
    const box = new THREE.Box3().setFromObject(seated);

    expect(eyeWorld.y).toBeGreaterThan(seat.position.y + 1.05);
    expect(eyeWorld.y).toBeLessThan(box.max.y - 0.08);

    theater.dispose();
    rig.dispose();
  });
});
