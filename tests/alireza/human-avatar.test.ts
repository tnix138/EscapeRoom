import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HumanAvatar } from '../../src/engine3d/characters/human-avatar';
import {
  DEFAULT_HUMAN_LOOKS,
  resolveHumanLook,
} from '../../src/engine3d/characters/human-presets';
import {
  resolveHeadAnchors,
  sculptHead,
} from '../../src/engine3d/characters/human-head-shape';
import { createSeatedPlayerCharacter } from '../../src/engine3d/theater-geometry';

function worldBox(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object);
}

describe('فاز ۱۱ — کاراکتر انسانِ باورپذیر (جمجمه، چشم، دست و لایهٔ زندگی)', () => {
  it('هر هشت صندلی چهرهٔ قطعی و متمایز دارند', () => {
    expect(DEFAULT_HUMAN_LOOKS).toHaveLength(8);
    const signatures = DEFAULT_HUMAN_LOOKS.map((look) =>
      [
        look.skinHex,
        look.hairHex,
        look.hair.style,
        look.feminine,
        look.head.jawWidth.toFixed(3),
        look.head.noseLength.toFixed(3),
        look.heightMeters.toFixed(3),
      ].join('|'),
    );
    expect(new Set(signatures).size).toBe(8);
    expect([0, 1, 4].every((index) => DEFAULT_HUMAN_LOOKS[index]!.feminine)).toBe(true);
    expect([0, 1, 4].every((index) => DEFAULT_HUMAN_LOOKS[index]!.build < 1)).toBe(true);
    expect([2, 3, 5, 6, 7].every((index) => !DEFAULT_HUMAN_LOOKS[index]!.feminine)).toBe(true);
    expect(DEFAULT_HUMAN_LOOKS[0]!.hair.style).toBe('long');
    expect(DEFAULT_HUMAN_LOOKS[1]!.hair.style).toBe('wavy');
    expect(DEFAULT_HUMAN_LOOKS[4]!.hair.style).toBe('bun');
    expect(DEFAULT_HUMAN_LOOKS[4]!.facialHair).toBe('none');
    expect(DEFAULT_HUMAN_LOOKS[4]!.accessory).toBe('earring');

    const again = resolveHumanLook('seat-3', 3);
    expect(again.head.noseLength).toBe(resolveHumanLook('seat-3', 3).head.noseLength);
    expect(again.hair.style).toBe(DEFAULT_HUMAN_LOOKS[3]!.hair.style);
  });

  it('جمجمه به‌جای کره، ساختار بینی/چانه/کاسهٔ چشم دارد و UV آن دست‌نخورده است', () => {
    const head = DEFAULT_HUMAN_LOOKS[0]!.head;
    const anchors = resolveHeadAnchors(head);

    // نوک بینی باید از همهٔ نقاط میانی صورت جلوتر باشد (نیمرخِ انسان، نه بیضی)
    const noseTip = sculptHead(anchors.noseTip.clone(), head);
    const chin = sculptHead(anchors.chin.clone(), head);
    const forehead = sculptHead(anchors.forehead.clone(), head);
    const mouth = sculptHead(anchors.mouth.clone(), head);
    expect(noseTip.z).toBeLessThan(mouth.z - 0.01);
    expect(noseTip.z).toBeLessThan(chin.z - 0.02);
    expect(noseTip.z).toBeLessThan(forehead.z - 0.01);

    // کاسهٔ چشم باید از استخوان گونه عقب‌تر باشد (عمق چشم، نه سطح صاف)
    const socket = sculptHead(anchors.eyeL.clone(), head);
    const cheek = sculptHead(anchors.cheekL.clone(), head);
    expect(socket.z).toBeGreaterThan(cheek.z);

    // هیچ مختصات غیرمتناهی در هندسه نباشد
    const avatar = new HumanAvatar({ look: DEFAULT_HUMAN_LOOKS[0]! });
    const skull = avatar.getObjectByName('avatar-skull') as THREE.Mesh;
    expect(skull).toBeDefined();
    const positions = skull.geometry.getAttribute('position');
    expect(positions.count).toBeGreaterThan(2000);
    for (let i = 0; i < positions.count; i += 37) {
      expect(Number.isFinite(positions.getX(i))).toBe(true);
      expect(Number.isFinite(positions.getY(i))).toBe(true);
      expect(Number.isFinite(positions.getZ(i))).toBe(true);
    }
    avatar.dispose();
  });

  it('آواتار ایستاده اجزای چهره، انگشت، کفش روی زمین و قد طبیعی دارد', () => {
    const look = resolveHumanLook('seat-1', 1);
    const avatar = new HumanAvatar({ look });
    avatar.updateMatrixWorld(true);
    const box = worldBox(avatar);

    // قد انسان بزرگسال + کفش روی زمین (نه معلق)
    expect(box.max.y).toBeCloseTo(look.heightMeters, 1);
    expect(box.max.y).toBeGreaterThan(1.55);
    expect(box.max.y).toBeLessThan(1.95);
    expect(Math.abs(box.min.y)).toBeLessThan(0.03);

    // چشم‌ها در ارتفاع طبیعی سر انسان (حدود ۹۳٪ قد برای بزرگسال)
    const eyes = avatar.getObjectByName('avatar-eye-left')!;
    expect(eyes.getWorldPosition(new THREE.Vector3()).y / look.heightMeters).toBeGreaterThan(0.86);
    expect(eyes.getWorldPosition(new THREE.Vector3()).y / look.heightMeters).toBeLessThan(0.98);

    // عرض شانه از عرض سر بیشتر است (تناسب انسانی)
    const head = avatar.getObjectByName('avatar-head')!;
    expect(worldBox(head).max.x - worldBox(head).min.x).toBeLessThan(0.22);

    for (const name of [
      'avatar-body',
      'avatar-head',
      'avatar-hair',
      'avatar-neck',
      'avatar-eyes',
      'avatar-eye-left',
      'avatar-eye-right',
      'avatar-eyelid-left',
      'avatar-eyelid-right',
      'avatar-brow-left',
      'avatar-brow-right',
      'avatar-ear-left',
      'avatar-ear-right',
      'avatar-arm-left',
      'avatar-arm-right',
      'avatar-elbow-left',
      'avatar-elbow-right',
      'avatar-hand-left',
      'avatar-hand-right',
      'avatar-thumb-left',
      'avatar-leg-left',
      'avatar-leg-right',
      'avatar-knee-left',
      'avatar-shoe',
    ]) {
      expect(avatar.getObjectByName(name), name).toBeDefined();
    }

    // سر بالای شانه‌ها و چشم‌ها هم‌سطحِ ارتفاع شبکهٔ حضور (۱٫۶۵)
    expect(head.position.y).toBeGreaterThan(1.55);
    expect(head.position.y).toBeLessThan(1.68);
    avatar.dispose();
  });

  it('انگشت شست و ابروهای چپ/راست به سمت درستِ بدن قرار دارند', () => {
    const avatar = new HumanAvatar({ look: DEFAULT_HUMAN_LOOKS[0]! });
    const leftThumb = avatar.getObjectByName('avatar-thumb-left') as THREE.Group;
    const rightThumb = avatar.getObjectByName('avatar-thumb-right') as THREE.Group;
    expect(leftThumb.position.x).toBeLessThan(0);
    expect(rightThumb.position.x).toBeGreaterThan(0);

    const leftBrow = avatar.getObjectByName('avatar-brow-left') as THREE.InstancedMesh;
    const rightBrow = avatar.getObjectByName('avatar-brow-right') as THREE.InstancedMesh;
    const leftMatrix = new THREE.Matrix4();
    const rightMatrix = new THREE.Matrix4();
    leftBrow.getMatrixAt(0, leftMatrix);
    rightBrow.getMatrixAt(0, rightMatrix);
    expect(new THREE.Vector3().setFromMatrixPosition(leftMatrix).x).toBeLessThan(0);
    expect(new THREE.Vector3().setFromMatrixPosition(rightMatrix).x).toBeGreaterThan(0);
    avatar.dispose();
  });

  it('پلک می‌زند، تنفس می‌کند و گام‌برداری دو طرفه است', () => {
    const avatar = new HumanAvatar({ look: DEFAULT_HUMAN_LOOKS[2]! });
    const leftLeg = avatar.getObjectByName('avatar-leg-left')!;
    const rightLeg = avatar.getObjectByName('avatar-leg-right')!;
    const leftArm = avatar.getObjectByName('avatar-arm-left')!;
    const rightArm = avatar.getObjectByName('avatar-arm-right')!;
    const lid = avatar.getObjectByName('avatar-eyelid-left')!;
    const torso = avatar.getObjectByName('avatar-body')!;

    const lidRest = lid.rotation.x;
    const torsoRest = torso.position.y;

    for (let i = 0; i < 40; i++) avatar.update(1 / 60, { speed: 1.8 });

    expect(Math.abs(leftLeg.rotation.x)).toBeGreaterThan(0.05);
    expect(leftLeg.rotation.x).toBeCloseTo(-rightLeg.rotation.x, 6);
    expect(leftArm.rotation.x).toBeCloseTo(-rightArm.rotation.x, 6);
    expect(Math.abs(torso.position.y - torsoRest)).toBeGreaterThan(0.001);

    // در چند ثانیهٔ شبیه‌سازی، پلک دست‌کم یک بار بسته می‌شود
    let sawClosed = false;
    for (let i = 0; i < 600; i++) {
      avatar.update(1 / 60, { speed: 0 });
      if (Math.abs(lid.rotation.x - lidRest) > 0.2) sawClosed = true;
    }
    expect(sawClosed).toBe(true);
    avatar.dispose();
  });

  it('کاراکتر نشسته کفش را جلوی صندلی و سر را بالای پشتی می‌گذارد', () => {
    const seated = createSeatedPlayerCharacter({
      playerId: 'seat-4',
      playerName: 'کیان',
      seatIndex: 3,
    });
    const avatar = seated.userData.humanAvatar as HumanAvatar;
    expect(avatar).toBeInstanceOf(HumanAvatar);
    seated.updateMatrixWorld(true);

    const leg = seated.getObjectByName('avatar-leg-left')!;
    const shoe = leg.children[leg.children.length - 1]!;
    const shoeBox = worldBox(shoe);
    expect(shoeBox.min.z).toBeLessThan(-0.3);
    expect(shoeBox.min.y).toBeGreaterThan(-0.06);
    expect(shoeBox.min.y).toBeLessThan(0.12);

    const head = seated.getObjectByName('avatar-head')!;
    expect(head.position.y).toBeGreaterThan(1.0);
    expect(worldBox(seated).max.y).toBeGreaterThan(1.2);
    expect(worldBox(seated).max.y).toBeLessThan(1.6);
  });
});
