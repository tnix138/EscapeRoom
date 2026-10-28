// src/engine3d/characters/human-avatar.ts — آواتار واقع‌گرای rigged/glTF برای صحنه‌های Three.js
//
// مدل اصلی دیگر با کپسول و مش‌های رویه‌ای ساخته نمی‌شود: یک مدل استاندارد ۵۳ استخوانی
// با morph targetهای صورت/بدن، بافت‌های PBR و کلیپ‌های idle/walk/run از GLBهای CC0 بارگیری
// می‌شود. ProceduralHumanAvatar فقط برای تست‌های بدون مرورگر و fallback خطای بارگذاری حفظ شده.

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { HumanLook } from './human-presets';
import { resolveHeadAnchors, getHumanEyeHeight, DEFAULT_PLAYER_EYE_HEIGHT } from './human-head-shape';
import type { HeadAnchors } from './human-head-shape';
import { ProceduralHumanAvatar, type HumanMotion, type HumanPose } from './procedural-human-avatar';

export type { HumanMotion, HumanPose };

export interface HumanAvatarOptions {
  look: HumanLook;
  pose?: HumanPose;
  displayName?: string;
}

interface CharacterAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

interface LoadedCharacterParts {
  body: CharacterAsset;
  coat: CharacterAsset;
  boots: CharacterAsset;
  hair: CharacterAsset;
}

interface RigBones {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  bones: Map<string, THREE.Bone>;
  pelvisRestPosition: THREE.Vector3;
  restRotations: Map<string, THREE.Euler>;
}

const MODEL_BASE_URL = '/models/characters';
const MODEL_FORWARD_YAW = Math.PI;
const SOURCE_BODY_HEIGHT_METERS = 1.674;
const SEATED_HIP_DROP_METERS = 0.39;
const LOCOMOTION_CLIPS = ['idle_breathe', 'walk', 'run'] as const;
type LocomotionClip = (typeof LOCOMOTION_CLIPS)[number];

type HairStyle = HumanLook['hair']['style'];
const HAIR_ASSET: Readonly<Record<HairStyle, string>> = {
  slick: 'hair-short.glb',
  wavy: 'hair-bob.glb',
  bun: 'hair-ponytail.glb',
  short: 'hair-short.glb',
  curly: 'hair-curly.glb',
  long: 'hair-long.glb',
};

const loader = new GLTFLoader();
const assetPromises = new Map<string, Promise<CharacterAsset>>();
let corePromise: Promise<Omit<LoadedCharacterParts, 'hair'>> | null = null;

function loadAsset(fileName: string): Promise<CharacterAsset> {
  const cached = assetPromises.get(fileName);
  if (cached) return cached;

  const promise = loader
    .loadAsync(`${MODEL_BASE_URL}/${fileName}`)
    .then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }))
    .catch((error: unknown) => {
      assetPromises.delete(fileName);
      throw error;
    });
  assetPromises.set(fileName, promise);
  return promise;
}

function loadCoreParts(): Promise<Omit<LoadedCharacterParts, 'hair'>> {
  corePromise ??= Promise.all([
    loadAsset('body.glb'),
    loadAsset('coat.glb'),
    loadAsset('boots.glb'),
  ])
    .then(([body, coat, boots]) => ({ body, coat, boots }))
    .catch((error: unknown) => {
      corePromise = null;
      throw error;
    });
  return corePromise;
}

async function loadCharacterParts(look: HumanLook): Promise<LoadedCharacterParts> {
  const [core, hair] = await Promise.all([
    loadCoreParts(),
    loadAsset(HAIR_ASSET[look.hair.style]),
  ]);
  return { ...core, hair };
}

function deterministicUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0) / 0xffffffff;
}

function clamp01(value: number): number {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function setBipolarMorph(
  dictionary: Record<string, number> | undefined,
  influences: number[] | undefined,
  stem: string,
  value: number,
): void {
  if (!dictionary || !influences) return;
  const bounded = THREE.MathUtils.clamp(value, -1, 1);
  const negative = dictionary[`${stem}_decr`];
  const positive = dictionary[`${stem}_incr`];
  if (negative !== undefined) influences[negative] = Math.max(0, -bounded);
  if (positive !== undefined) influences[positive] = Math.max(0, bounded);
}

function applyLookMorphs(mesh: THREE.Mesh, look: HumanLook): void {
  const dictionary = mesh.morphTargetDictionary;
  const influences = mesh.morphTargetInfluences;
  if (!dictionary || !influences) return;

  const set = (name: string, value: number) => {
    const index = dictionary[name];
    if (index !== undefined) influences[index] = clamp01(value);
  };

  // استخوان‌بندی و شکل کلی از morphهای MakeHuman می‌آید؛ عمداً دامنه‌ها محدودند تا
  // چهره‌ها از حالت انسانِ بالغ خارج نشوند و اغراق کارتونی ایجاد نشود.
  set('gender_female', look.feminine ? 1 : 0);
  set('gender_male', look.feminine ? 0 : 1);
  set('age_child', 0);
  set('age_old', Math.max(0, (look.age - 0.2) / 0.8) * 0.7);

  const buildSignal = THREE.MathUtils.clamp((look.build - 1) * 5, -0.4, 0.4);
  set('weight_min', Math.max(0, -buildSignal));
  set('weight_max', Math.max(0, buildSignal));
  const muscleSignal = (deterministicUnit(`${look.id}:build`) - 0.5) * 0.28;
  set('muscle_min', Math.max(0, -muscleSignal));
  set('muscle_max', Math.max(0, muscleSignal));
  set('proportions_ideal', 0.08);
  set('proportions_uncommon', 0);

  const head = look.head;
  setBipolarMorph(dictionary, influences, 'face_nose_width', (head.noseWidth - 0.4) / 0.35);
  setBipolarMorph(dictionary, influences, 'face_nose_length', (head.noseLength - 0.46) / 0.35);
  setBipolarMorph(dictionary, influences, 'face_nose_height', (head.noseTip - 0.35) / 0.45);
  setBipolarMorph(dictionary, influences, 'face_jaw_width', (head.jawWidth - 0.42) / 0.65);
  setBipolarMorph(dictionary, influences, 'face_chin', (head.chinLength - 0.4) / 0.55);
  setBipolarMorph(dictionary, influences, 'face_cheekbones', (head.cheekbone - 0.42) / 0.65);
  setBipolarMorph(dictionary, influences, 'face_eye_size', (head.eyeSize - 0.88) / 0.22);
  setBipolarMorph(dictionary, influences, 'face_eye_spacing', (head.eyeSpacing - 0.35) / 0.2);
  setBipolarMorph(dictionary, influences, 'face_lips', (head.lipFullness - 0.5) / 0.6);
  setBipolarMorph(dictionary, influences, 'face_ear_size', (head.earSize - 1) / 0.35);
  setBipolarMorph(dictionary, influences, 'face_forehead', (head.browRidge - 0.35) / 0.7);
}

function skinMaterialColor(material: THREE.Material, look: HumanLook): number | null {
  const name = material.name.toLowerCase();
  if (name.includes('skin')) return look.skinHex;
  if (name.includes('iris')) return look.eyeHex;
  if (name.includes('hair') || name.includes('eyebrow') || name.includes('eyelash')) return look.hairHex;
  if (name.includes('trenchcoat') || name.includes('coat')) return look.coatHex;
  if (name.includes('boot') || name.includes('shoe')) return look.shoeHex;
  return null;
}

function cloneLookMaterials(root: THREE.Object3D, look: HumanLook, owned: Set<THREE.Material>): void {
  const copies = new Map<THREE.Material, THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const cloneMaterial = (source: THREE.Material): THREE.Material => {
      let copy = copies.get(source);
      if (!copy) {
        copy = source.clone();
        copies.set(source, copy);
        owned.add(copy);
        const tint = skinMaterialColor(copy, look);
        if (tint !== null && 'color' in copy) {
          (copy as THREE.Material & { color: THREE.Color }).color.setHex(tint);
          copy.needsUpdate = true;
        }
      }
      return copy;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
  });
}

function collectBones(root: THREE.Object3D): Map<string, THREE.Bone> {
  const bones = new Map<string, THREE.Bone>();
  root.traverse((object) => {
    if (object instanceof THREE.Bone && !bones.has(object.name)) bones.set(object.name, object);
  });
  return bones;
}

function addAlias(parent: THREE.Object3D | undefined, name: string): THREE.Group | null {
  if (!parent) return null;
  const alias = new THREE.Group();
  alias.name = name;
  alias.userData.isCharacterCompatibilityAnchor = true;
  parent.add(alias);
  return alias;
}

/** آواتار انسانی استاندارد با مدل‌های CC0، ریگ ۵۳ استخوانی و morphهای چهره */
export class HumanAvatar extends THREE.Group {
  readonly look: HumanLook;
  readonly pose: HumanPose;
  readonly standingHeight: number;
  readonly anchors: HeadAnchors;
  readonly materials: THREE.Material[] = [];
  readonly ready: Promise<this>;

  private readonly displayName: string;
  private readonly eyeAnchor = new THREE.Object3D();
  private readonly modelRoot = new THREE.Group();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly morphMeshes: THREE.Mesh[] = [];
  private readonly rigs: RigBones[] = [];
  private readonly actions = new Map<LocomotionClip, THREE.AnimationAction[]>();
  private readonly actionWeights = new Map<LocomotionClip, number>();
  private fallback: ProceduralHumanAvatar | null = null;
  private isDisposed = false;
  private hasModel = false;
  private blinkTimer: number;
  private blinkProgress = 0;
  private blinking = false;
  private doubleBlink = false;
  private elapsed = 0;
  private headYaw = 0;
  private readonly idlePhase: number;
  private armPoseZ: { left: number | null; right: number | null } = { left: null, right: null };
  private _eyeHeight: number;

  constructor(options: HumanAvatarOptions) {
    super();
    this.look = options.look;
    this.pose = options.pose ?? 'standing';
    this.displayName = options.displayName ?? options.look.displayName;
    this.standingHeight = options.look.heightMeters;
    this._eyeHeight = this.pose === 'seated'
      ? Math.max(1.15, options.look.heightMeters * 0.73)
      : getHumanEyeHeight(options.look);
    this.anchors = resolveHeadAnchors(options.look.head);
    this.name = `HumanAvatar:${this.displayName}`;
    this.userData.lookId = options.look.id;
    this.userData.modelSource = 'MakeHuman CC0 / MPFB game_engine rig';
    this.userData.coordinateAdapter = '+Z source forward -> -Z game forward';
    this.userData.parts = {
      head: 'avatar-head',
      hair: 'avatar-hair',
      body: 'avatar-body',
      eyes: 'avatar-eyes',
    };
    this.eyeAnchor.name = 'avatar-eye-point';
    this.idlePhase = deterministicUnit(`${options.look.id}:idle`) * 5;
    this.blinkTimer = 2 + deterministicUnit(`${options.look.id}:blink`) * 3;

    // The procedural model is only used by Node-based tests/SSR, where WebGL asset
    // decoding is unavailable. Browsers use the rigged CC0 GLBs below.
    if (typeof window === 'undefined') {
      this.installProceduralFallback();
      this.ready = Promise.resolve(this);
    } else {
      this.ready = this.initializeModel(options.look).then(() => this);
    }
  }

  get eyeHeight(): number {
    return this.fallback?.eyeHeight ?? this._eyeHeight;
  }

  private installProceduralFallback(error?: unknown): void {
    if (this.isDisposed || this.fallback) return;
    const fallback = new ProceduralHumanAvatar({
      look: this.look,
      pose: this.pose,
      displayName: this.displayName,
    });
    this.fallback = fallback;
    this.add(fallback);
    if (error) {
      this.userData.modelLoadFailed = true;
      this.userData.modelLoadError = error instanceof Error ? error.message : String(error);
    }
  }

  private async initializeModel(look: HumanLook): Promise<void> {
    try {
      const parts = await loadCharacterParts(look);
      if (this.isDisposed) return;
      this.mountParts(parts, look);
    } catch (error) {
      // If a GLB is corrupt/omitted, discard partial clones before using fallback.
      this.remove(this.modelRoot);
      for (const rig of this.rigs) {
        rig.mixer.stopAllAction();
        rig.mixer.uncacheRoot(rig.root);
      }
      for (const material of this.ownedMaterials) material.dispose();
      this.ownedMaterials.clear();
      this.materials.length = 0;
      this.rigs.length = 0;
      this.morphMeshes.length = 0;
      this.modelRoot.clear();
      // Local GLBs normally load from the same origin. Keep the game usable if a
      // browser blocks decoding or a deployment accidentally omits one of the files.
      this.installProceduralFallback(error);
    }
  }

  private mountParts(parts: LoadedCharacterParts, look: HumanLook): void {
    this.modelRoot.name = 'avatar-body';
    this.modelRoot.rotation.y = MODEL_FORWARD_YAW;
    this.add(this.modelRoot);

    const partEntries: Array<[keyof LoadedCharacterParts, CharacterAsset, string]> = [
      ['body', parts.body, 'character-body-rig'],
      ['coat', parts.coat, 'character-coat-rig'],
      ['boots', parts.boots, 'character-boots-rig'],
      ['hair', parts.hair, 'avatar-hair'],
    ];
    const bodyClips = parts.body.animations;
    const partRoots: THREE.Group[] = [];

    for (const [kind, asset, partName] of partEntries) {
      const root = cloneSkinnedModel(asset.scene) as THREE.Group;
      root.name = partName;
      this.modelRoot.add(root);
      partRoots.push(root);
      cloneLookMaterials(root, look, this.ownedMaterials);

      root.traverse((object) => {
        if (object instanceof THREE.Mesh && object.morphTargetInfluences) {
          applyLookMorphs(object, look);
          this.morphMeshes.push(object);
        }
      });

      const bones = collectBones(root);
      const pelvisRestPosition = bones.get('pelvis')?.position.clone() ?? new THREE.Vector3();
      const restRotations = new Map(
        [...bones].map(([name, bone]) => [name, bone.rotation.clone()]),
      );
      const mixer = new THREE.AnimationMixer(root);
      this.rigs.push({ root, mixer, bones, pelvisRestPosition, restRotations });
      void kind;
    }

    this.materials.push(...this.ownedMaterials);

    // Match source asset height to the deterministic preset; offset any tiny
    // negative boot floor so feet remain on the same ground plane as networking.
    this.modelRoot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.modelRoot, true);
    const rawHeight = Math.max(0.1, bounds.max.y - bounds.min.y);
    const scale = this.standingHeight / rawHeight;
    this.modelRoot.scale.setScalar(scale);
    this.modelRoot.position.y = -bounds.min.y * scale;
    this.modelRoot.updateMatrixWorld(true);

    const bodyRig = this.rigs[0];
    const headBone = bodyRig?.bones.get('head');
    const eyesObject = bodyRig?.root.getObjectByName('Eyes');
    if (headBone && eyesObject) {
      bodyRig.root.updateMatrixWorld(true);
      const eyeBounds = new THREE.Box3().setFromObject(eyesObject, true);
      const eyeCenterWorld = eyeBounds.getCenter(new THREE.Vector3());
      const eyeLocalToHead = headBone.worldToLocal(eyeCenterWorld.clone());
      this.eyeAnchor.position.copy(eyeLocalToHead);
      headBone.add(this.eyeAnchor);
      this.updateWorldMatrix(true, true);
      const eyeInAvatarSpace = this.worldToLocal(this.eyeAnchor.getWorldPosition(new THREE.Vector3()));
      this._eyeHeight = eyeInAvatarSpace.y;
    } else {
      this.eyeAnchor.position.set(0, 0.045, 0.085);
      headBone?.add(this.eyeAnchor);
    }

    this.addCompatibilityAnchors(bodyRig?.bones);
    this.initializeActions(bodyClips);
    this.applySeatedPose();
    this.updateWorldMatrix(true, true);
    if (this.eyeAnchor.parent) {
      const eyeInAvatarSpace = this.worldToLocal(this.eyeAnchor.getWorldPosition(new THREE.Vector3()));
      this._eyeHeight = eyeInAvatarSpace.y;
    }
    this.applyLookAnimationMorphs(0, { speed: 0, pitchDeg: 0 });
    this.verifyLimbOrientation(bodyRig?.bones);

    this.hasModel = true;
    this.userData.rig = 'mpfb-game_engine-53';
    this.userData.morphTargetMeshes = this.morphMeshes.length;
    this.userData.modelReady = true;
  }

  private addCompatibilityAnchors(bones?: Map<string, THREE.Bone>): void {
    if (!bones) return;
    const head = bones.get('head');
    const neck = bones.get('neck_01');
    const upperArmLeft = bones.get('upperarm_l');
    const upperArmRight = bones.get('upperarm_r');
    const handLeft = bones.get('hand_l');
    const handRight = bones.get('hand_r');
    const thighLeft = bones.get('thigh_l');
    const thighRight = bones.get('thigh_r');
    const calfLeft = bones.get('calf_l');
    const calfRight = bones.get('calf_r');

    addAlias(head, 'avatar-head');
    addAlias(neck, 'avatar-neck');
    addAlias(upperArmLeft, 'avatar-arm-left');
    addAlias(upperArmRight, 'avatar-arm-right');
    addAlias(handLeft, 'avatar-hand-left');
    addAlias(handRight, 'avatar-hand-right');
    addAlias(thighLeft, 'avatar-leg-left');
    addAlias(thighRight, 'avatar-leg-right');
    addAlias(calfLeft, 'avatar-knee-left');
    addAlias(calfRight, 'avatar-knee-right');

    const eyes = addAlias(head, 'avatar-eyes');
    if (eyes) {
      const eyeLeft = addAlias(eyes, 'avatar-eye-left');
      const eyeRight = addAlias(eyes, 'avatar-eye-right');
      addAlias(eyeLeft ?? undefined, 'avatar-eyelid-left');
      addAlias(eyeRight ?? undefined, 'avatar-eyelid-right');
    }
    addAlias(head, 'avatar-skull');
    addAlias(handLeft, 'avatar-thumb-left');
    addAlias(handRight, 'avatar-thumb-right');
  }

  private initializeActions(clips: THREE.AnimationClip[]): void {
    const actionNames = new Set(clips.map((clip) => clip.name));
    for (const name of LOCOMOTION_CLIPS) {
      if (!actionNames.has(name)) continue;
      const actions = this.rigs.map((rig) => {
        const clip = clips.find((candidate) => candidate.name === name)!;
        const action = rig.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        action.enabled = true;
        action.setEffectiveWeight(name === 'idle_breathe' ? 1 : 0);
        action.time = this.idlePhase % Math.max(0.01, clip.duration);
        action.play();
        return action;
      });
      this.actions.set(name, actions);
      this.actionWeights.set(name, name === 'idle_breathe' ? 1 : 0);
    }
    for (const rig of this.rigs) rig.mixer.update(0);
  }

  private verifyLimbOrientation(bones?: Map<string, THREE.Bone>): void {
    const left = bones?.get('upperarm_l');
    const right = bones?.get('upperarm_r');
    if (!left || !right) {
      this.userData.leftRightVerified = false;
      return;
    }
    this.updateMatrixWorld(true);
    const leftX = this.worldToLocal(left.getWorldPosition(new THREE.Vector3())).x;
    const rightX = this.worldToLocal(right.getWorldPosition(new THREE.Vector3())).x;
    const verified = leftX < rightX;
    this.userData.leftRightVerified = verified;
    if (!verified) {
      // A source rig with the opposite convention must never silently mirror the
      // human. The conversion is an explicit model-root yaw, not negative scaling.
      throw new Error(`Character rig left/right bones are reversed (${leftX} >= ${rightX})`);
    }
  }

  private setActionWeight(name: LocomotionClip, target: number, deltaSeconds: number, timeScale: number): void {
    const actions = this.actions.get(name);
    if (!actions) return;
    const previous = this.actionWeights.get(name) ?? 0;
    const weight = previous + (target - previous) * Math.min(1, deltaSeconds * 8);
    this.actionWeights.set(name, weight);
    for (const action of actions) {
      action.enabled = true;
      action.setEffectiveTimeScale(timeScale);
      action.setEffectiveWeight(weight);
    }
  }

  private applySeatedPose(): void {
    if (this.pose !== 'seated') return;
    for (const rig of this.rigs) this.applySeatedPoseToRig(rig);
  }

  private applyLookAnimationMorphs(deltaSeconds: number, motion: HumanMotion): void {
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1);
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && !this.blinking) {
      this.blinking = true;
      this.blinkProgress = 0;
      this.doubleBlink = deterministicUnit(`${this.look.id}:${this.elapsed.toFixed(2)}`) < 0.16;
    }
    if (this.blinking) {
      this.blinkProgress += dt / 0.13;
      if (this.blinkProgress >= 1) {
        if (this.doubleBlink && this.blinkProgress < 1.45) {
          this.blinkProgress = 0.2;
          this.doubleBlink = false;
        } else {
          this.blinking = false;
          this.blinkProgress = 0;
          this.blinkTimer = 2.4 + deterministicUnit(`${this.look.id}:${this.elapsed.toFixed(2)}:next`) * 3.8;
        }
      }
    }
    const blink = this.blinking ? Math.sin(Math.min(1, this.blinkProgress) * Math.PI) : 0;
    const pitch = THREE.MathUtils.clamp(motion.pitchDeg ?? 0, -30, 30) / 30;
    const saccadeX = Math.sin(this.elapsed * 0.43 + this.idlePhase) * 0.12;
    const saccadeY = Math.sin(this.elapsed * 0.31 + this.idlePhase * 0.7) * 0.06;
    const lookLeft = Math.max(0, saccadeX + this.headYaw * 0.35);
    const lookRight = Math.max(0, -saccadeX - this.headYaw * 0.35);
    const lookUp = Math.max(0, pitch * 0.4 + saccadeY);
    const lookDown = Math.max(0, -pitch * 0.4 - saccadeY);

    for (const mesh of this.morphMeshes) {
      const dictionary = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dictionary || !influences) continue;
      const write = (name: string, value: number) => {
        const index = dictionary[name];
        if (index !== undefined) influences[index] = clamp01(value);
      };
      write('blink_left', blink);
      write('blink_right', blink);
      write('look_left', lookLeft);
      write('look_right', lookRight);
      write('look_up', lookUp);
      write('look_down', lookDown);
    }
  }

  update(deltaSeconds: number, motion: HumanMotion): void {
    if (this.fallback) {
      this.fallback.update(deltaSeconds, motion);
      return;
    }
    if (!this.hasModel || this.isDisposed) return;
    const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1);
    if (dt <= 0) return;
    this.elapsed += dt;

    const speed = Math.max(0, motion.speed);
    const gait = THREE.MathUtils.smoothstep(speed, 0.04, 0.36);
    const run = THREE.MathUtils.smoothstep(speed, 1.7, 2.9);
    this.setActionWeight('idle_breathe', 1 - gait, dt, 1);
    this.setActionWeight('walk', gait * (1 - run), dt, THREE.MathUtils.clamp(speed / 1.35, 0.72, 1.55));
    this.setActionWeight('run', gait * run, dt, THREE.MathUtils.clamp(speed / 3.1, 0.82, 1.3));
    for (const rig of this.rigs) rig.mixer.update(dt);

    const yawRate = motion.yawRate ?? 0;
    this.headYaw += (yawRate * dt * 0.12 - this.headYaw) * Math.min(1, dt * 2.5);
    const microYaw = Math.sin(this.elapsed * 0.37 + this.idlePhase) * 0.018;
    const microPitch = Math.sin(this.elapsed * 0.29 + this.idlePhase) * 0.008;
    const pitchRad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(motion.pitchDeg ?? 0, -30, 30));

    for (const rig of this.rigs) {
      const head = rig.bones.get('head');
      if (head) {
        // Reset from the rest pose each frame so sustained pitch/yaw never accumulates.
        // Asset forward is +Z; negative X pitches the face upward after the -Z adapter.
        const rest = rig.restRotations.get('head') ?? head.rotation;
        head.rotation.set(
          rest.x - pitchRad * 0.42,
          rest.y + this.headYaw + microYaw,
          rest.z + microPitch,
          rest.order,
        );
      }
      if (this.pose === 'seated') this.applySeatedPoseToRig(rig);
      if (this.armPoseZ.left !== null) {
        const leftArm = rig.bones.get('upperarm_l');
        if (leftArm) leftArm.rotation.z = this.armPoseZ.left;
      }
      if (this.armPoseZ.right !== null) {
        const rightArm = rig.bones.get('upperarm_r');
        if (rightArm) rightArm.rotation.z = this.armPoseZ.right;
      }
    }

    this.applyLookAnimationMorphs(dt, motion);
  }

  private applySeatedPoseToRig(rig: RigBones): void {
    const pelvis = rig.bones.get('pelvis');
    if (pelvis?.parent) {
      // This source rig has a rotated root bone, so subtracting from local Y
      // moves the hips along world Z. Convert the desired world-down offset
      // through the animated parent transform, then restore the pelvis rest pose.
      pelvis.parent.updateWorldMatrix(true, false);
      const parentRotation = pelvis.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      const parentScale = pelvis.parent.getWorldScale(new THREE.Vector3());
      const localDrop = new THREE.Vector3(0, -SEATED_HIP_DROP_METERS, 0)
        .applyQuaternion(parentRotation)
        .divide(parentScale);
      pelvis.position.copy(rig.pelvisRestPosition).add(localDrop);
    }

    const applyRotationOffset = (name: string, offsetX: number) => {
      const bone = rig.bones.get(name);
      if (!bone) return;
      const rest = rig.restRotations.get(name) ?? bone.rotation;
      bone.rotation.set(rest.x + offsetX, rest.y, rest.z, rest.order);
    };

    applyRotationOffset('thigh_l', -1.28);
    applyRotationOffset('thigh_r', -1.28);
    applyRotationOffset('calf_l', 1.22);
    applyRotationOffset('calf_r', 1.22);
    applyRotationOffset('upperarm_l', -0.36);
    applyRotationOffset('upperarm_r', -0.36);
    applyRotationOffset('lowerarm_l', 0.46);
    applyRotationOffset('lowerarm_r', 0.46);
  }

  getArmControl(side: 'left' | 'right'): THREE.Object3D | null {
    if (this.fallback) {
      return this.fallback.getObjectByName(`avatar-arm-${side}`) ?? null;
    }
    return this.rigs[0]?.bones.get(side === 'left' ? 'upperarm_l' : 'upperarm_r') ?? null;
  }

  /** وضعیت دستِ نمایشی NPC؛ روی تمام مش‌های rigged هم‌زمان اعمال می‌شود. */
  setArmPose(side: 'left' | 'right', rotationZ: number | null): void {
    this.armPoseZ[side] = rotationZ;
    if (this.fallback) {
      const arm = this.fallback.getObjectByName(`avatar-arm-${side}`) as THREE.Group | null;
      if (arm && rotationZ !== null) arm.rotation.z = rotationZ;
      return;
    }
    if (rotationZ === null) return;
    for (const rig of this.rigs) {
      const arm = rig.bones.get(side === 'left' ? 'upperarm_l' : 'upperarm_r');
      if (arm) arm.rotation.z = rotationZ;
    }
  }

  /** مختصات واقعی مرکز چشم‌ها در فضای جهان؛ در حالت نشسته نیز از استخوان سر می‌آید. */
  getEyeWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    if (this.fallback) return this.fallback.getEyeWorldPosition(target);
    this.updateWorldMatrix(true, true);
    if (this.hasModel && this.eyeAnchor.parent) return this.eyeAnchor.getWorldPosition(target);
    return this.localToWorld(target.set(0, this._eyeHeight, 0));
  }

  /** پلک‌زدن فوری برای کات‌سین/جامپ‌اسکر */
  blink(): void {
    if (this.fallback) {
      this.fallback.blink();
      return;
    }
    this.blinking = true;
    this.blinkProgress = 0;
    this.blinkTimer = 0;
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.fallback?.dispose();
    this.fallback = null;
    for (const rig of this.rigs) {
      rig.mixer.stopAllAction();
      rig.mixer.uncacheRoot(rig.root);
    }
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedMaterials.clear();
    this.materials.length = 0;
    this.rigs.length = 0;
    this.morphMeshes.length = 0;
    this.clear();
  }

  /** برای تست‌های محلی و ابزارهایی که نیاز دارند هنگام آماده‌شدن مش صبر کنند. */
  waitUntilReady(): Promise<this> {
    return this.ready;
  }

  static get modelHeightMeters(): number {
    return SOURCE_BODY_HEIGHT_METERS;
  }
}

/** سازگاری با API قدیمی؛ آواتارهای جدید از همان GLB adapter استفاده می‌کنند. */
export function createHumanAvatar(
  look: HumanLook,
  options: { pose?: HumanPose; displayName?: string } = {},
): HumanAvatar {
  return new HumanAvatar({
    look,
    pose: options.pose,
    displayName: options.displayName ?? look.displayName,
  });
}

export {
  DEFAULT_PLAYER_EYE_HEIGHT,
  MODEL_FORWARD_YAW,
  getHumanEyeHeight,
};
