import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MODEL_FORWARD_YAW } from '../../src/engine3d/characters/human-avatar';

interface GlbDocument {
  asset?: { version?: string };
  nodes?: Array<{
    name?: string;
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    children?: number[];
  }>;
  scenes?: Array<{ nodes?: number[] }>;
  scene?: number;
  skins?: Array<{ joints: number[] }>;
  meshes?: Array<{
    primitives?: Array<{ targets?: Array<Record<string, number>> }>;
    extras?: { targetNames?: string[] };
  }>;
  animations?: Array<{ name?: string }>;
}

function readGlbJson(fileName: string): GlbDocument {
  const buffer = readFileSync(path.resolve(process.cwd(), 'public/models/characters', fileName));
  expect(buffer.toString('ascii', 0, 4), `${fileName} GLB magic`).toBe('glTF');
  expect(buffer.readUInt32LE(4), `${fileName} GLB version`).toBe(2);
  expect(buffer.readUInt32LE(8), `${fileName} declared length`).toBe(buffer.length);

  let offset = 12;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(buffer.toString('utf8', offset + 8, offset + 8 + chunkLength)) as GlbDocument;
    }
    offset += 8 + chunkLength;
  }
  throw new Error(`${fileName} has no JSON chunk`);
}

function glbNodeWorldPosition(model: GlbDocument, nodeName: string): THREE.Vector3 {
  const nodes = model.nodes ?? [];
  const objects = nodes.map((node) => {
    const object = new THREE.Object3D();
    object.name = node.name ?? '';
    object.position.set(...(node.translation ?? [0, 0, 0]));
    object.quaternion.set(...(node.rotation ?? [0, 0, 0, 1]));
    object.scale.set(...(node.scale ?? [1, 1, 1]));
    return object;
  });
  const parentIndices = new Set<number>();
  nodes.forEach((node, parentIndex) => {
    for (const childIndex of node.children ?? []) {
      parentIndices.add(childIndex);
      objects[parentIndex]!.add(objects[childIndex]!);
    }
  });
  const root = new THREE.Group();
  objects.forEach((object, index) => {
    if (!parentIndices.has(index)) root.add(object);
  });
  root.updateMatrixWorld(true);
  const target = objects.find((object) => object.name === nodeName);
  if (!target) throw new Error(`GLB node ${nodeName} was not found`);
  return target.getWorldPosition(new THREE.Vector3());
}

const MODEL_FILES = [
  'body.glb',
  'coat.glb',
  'boots.glb',
  'hair-short.glb',
  'hair-bob.glb',
  'hair-long.glb',
  'hair-ponytail.glb',
  'hair-curly.glb',
] as const;

describe('مدل‌های rigged استاندارد کاراکتر', () => {
  it('تمام بخش‌های GLB با اسکلت ۵۳ استخوانیِ یکسان صادر شده‌اند', () => {
    const models = MODEL_FILES.map((file) => [file, readGlbJson(file)] as const);
    const bodyJoints = models[0]![1].skins?.[0]?.joints.map((index) => models[0]![1].nodes?.[index]?.name);
    expect(bodyJoints).toHaveLength(53);
    expect(bodyJoints).toContain('head');
    expect(bodyJoints).toContain('upperarm_l');
    expect(bodyJoints).toContain('upperarm_r');
    expect(bodyJoints).toContain('thigh_l');
    expect(bodyJoints).toContain('thigh_r');

    for (const [file, model] of models) {
      const jointNames = model.skins?.[0]?.joints.map((index) => model.nodes?.[index]?.name);
      expect(jointNames, file).toEqual(bodyJoints);
      expect(model.meshes?.some((mesh) => (mesh.primitives?.[0]?.targets?.length ?? 0) >= 90), file).toBe(true);
    }
  });

  it('مدل بدن کلیپ‌های idle/walk/run و مورف‌های چشم/چهره را دارد', () => {
    const body = readGlbJson('body.glb');
    const animationNames = new Set(body.animations?.map((clip) => clip.name));
    expect(animationNames).toContain('idle_breathe');
    expect(animationNames).toContain('walk');
    expect(animationNames).toContain('run');

    const targetNames = new Set(body.meshes?.flatMap((mesh) => mesh.extras?.targetNames ?? []));
    expect(targetNames).toContain('blink_left');
    expect(targetNames).toContain('blink_right');
    expect(targetNames).toContain('face_nose_length_incr');
    expect(targetNames).toContain('face_jaw_width_decr');
  });

  it('تبدیل محور مدل، رو به جلو را به -Z می‌برد و چپ/راست را درست نگه می‌دارد', () => {
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), MODEL_FORWARD_YAW);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(yaw);
    const sourceLeftDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(yaw);
    const sourceRightDirection = new THREE.Vector3(-1, 0, 0).applyQuaternion(yaw);
    const body = readGlbJson('body.glb');
    const sourceLeftShoulder = glbNodeWorldPosition(body, 'upperarm_l');
    const sourceRightShoulder = glbNodeWorldPosition(body, 'upperarm_r');
    const gameLeftShoulder = sourceLeftShoulder.clone().applyQuaternion(yaw);
    const gameRightShoulder = sourceRightShoulder.clone().applyQuaternion(yaw);

    expect(forward.z).toBeCloseTo(-1, 6);
    expect(sourceLeftDirection.x).toBeLessThan(0);
    expect(sourceRightDirection.x).toBeGreaterThan(0);
    expect(sourceLeftDirection.x).toBeCloseTo(-sourceRightDirection.x, 6);
    expect(sourceLeftShoulder.x).toBeGreaterThan(sourceRightShoulder.x);
    expect(gameLeftShoulder.x).toBeLessThan(gameRightShoulder.x);
  });
});
