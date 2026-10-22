import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  THEATER_SEAT_DIMENSIONS,
  createInstancedTheaterSeats,
  createTheaterSeat,
} from '../../src/engine3d/theater-seat';
import {
  createSeatedPlayerCharacter,
  createTheaterGeometry,
} from '../../src/engine3d/theater-geometry';

function worldBox(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function worldPosition(object: THREE.Object3D): THREE.Vector3 {
  object.updateWorldMatrix(true, false);
  return object.getWorldPosition(new THREE.Vector3());
}

describe('صندلی تئاتر — جهت پشتی و تناسبات واقعی', () => {
  it('ابعاد مرجع در بازه صندلی واقعی سالن است، نه صندلی بلند کارتونی', () => {
    expect(THEATER_SEAT_DIMENSIONS.facing).toBe('-Z');
    expect(THEATER_SEAT_DIMENSIONS.backrestSide).toBe('+Z');
    // پشتی باید پشت بدن تماشاگر باشد؛ مرکز منفی یعنی پشتی وارونه جلوی صندلی است
    expect(THEATER_SEAT_DIMENSIONS.backrestCenterZ).toBeGreaterThan(0.15);
    expect(THEATER_SEAT_DIMENSIONS.overallHeight).toBeGreaterThan(0.9);
    expect(THEATER_SEAT_DIMENSIONS.overallHeight).toBeLessThan(1.05);
    expect(THEATER_SEAT_DIMENSIONS.seatHeight).toBeGreaterThan(0.42);
    expect(THEATER_SEAT_DIMENSIONS.seatHeight).toBeLessThan(0.49);
  });

  it('پشتی پشت نشیمن (+Z) است و کل صندلی از سر تماشاگر نشسته کوتاه‌تر است', () => {
    const seat = createTheaterSeat(2, 3);
    const box = worldBox(seat);
    const size = box.getSize(new THREE.Vector3());

    expect(box.min.y).toBeGreaterThanOrEqual(-0.01); // پایه‌ها روی کف
    expect(box.max.y).toBeGreaterThan(0.9);
    expect(box.max.y).toBeLessThan(1.05); // پیش‌تر تا ۱٫۲۵ (و در کات‌سین ۱٫۷۱) متر بود
    expect(size.x).toBeGreaterThan(0.65);
    expect(size.x).toBeLessThan(0.78);

    const cushion = seat.getObjectByName('seat-cushion')!;
    const backCushion = seat.getObjectByName('seat-back-cushion')!;
    const cushionPos = worldPosition(cushion);
    const backPos = worldPosition(backCushion);

    // قرارداد جهت: صحنه ‎-Z‎ است، پس مرکز پشتی باید آشکارا عقب‌تر از نشیمن باشد
    expect(backPos.z).toBeGreaterThan(cushionPos.z + 0.18);
    expect(backPos.z).toBeGreaterThan(0.15);
    expect(backPos.y).toBeGreaterThan(0.6);
    expect(backPos.y).toBeLessThan(0.8);

    // روی تشک در ارتفاع واقعی نشیمن است
    const cushionBox = worldBox(cushion);
    expect(cushionBox.max.y).toBeGreaterThan(0.44);
    expect(cushionBox.max.y).toBeLessThan(0.49);
  });

  it('پاها و تنه آواتار نشسته با پشتی درگیر نمی‌شوند (پا جلو ‎-Z‎، پشتی عقب ‎+Z‎)', () => {
    const seat = createTheaterSeat(1, 1);
    const seatTopY = worldBox(seat).max.y; // قبل از افزودن آواتار: فقط خود صندلی
    const avatar = createSeatedPlayerCharacter({
      playerId: 'seat-1',
      playerName: 'مریم',
      seatIndex: 0,
    });
    seat.add(avatar);

    const leftLeg = avatar.getObjectByName('avatar-leg-left')!;
    const shoePos = worldPosition(leftLeg.children[leftLeg.children.length - 1]);
    const backPos = worldPosition(seat.getObjectByName('seat-back-cushion')!);
    const headPos = worldPosition(avatar.getObjectByName('avatar-head')!);

    expect(shoePos.z).toBeLessThan(-0.15); // نوک پا به سمت صحنه
    expect(backPos.z).toBeGreaterThan(0.15); // پشتی پشت بدن، نه جلوی زانوها
    expect(headPos.y).toBeGreaterThan(seatTopY); // سر از تاج پشتی بیرون می‌زند
  });

  it('قطعات واقعی صندلی هست و تشک‌ها مکعب تخت نیستند', () => {
    const seat = createTheaterSeat(3, 4);
    for (const name of [
      'seat-cushion',
      'seat-pan',
      'seat-backrest',
      'seat-back-cushion',
      'seat-lumbar-pad',
      'seat-back-shell',
      'seat-back-top-cap',
      'seat-frame-left',
      'seat-frame-right',
      'seat-armrest-left',
      'seat-armrest-right',
      'seat-number-plate',
    ]) {
      expect(seat.getObjectByName(name), name).toBeDefined();
    }

    const cushion = seat.getObjectByName('seat-cushion') as THREE.Mesh;
    const backCushion = seat.getObjectByName('seat-back-cushion') as THREE.Mesh;
    expect(cushion.geometry.type).toBe('ExtrudeGeometry');
    expect(backCushion.geometry.type).toBe('ExtrudeGeometry');

    // مخمل فیزیکی با برق لبه‌ای (sheen) و نقشه رویه‌ای، نه رنگ تخت
    const velvet = cushion.material as THREE.MeshPhysicalMaterial;
    expect(velvet).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(velvet.sheen).toBeGreaterThan(0);
    expect(velvet.map).not.toBeNull();

    // پلاک شماره روی پشت پوسته و رو به ردیف پشتی است
    const platePos = worldPosition(seat.getObjectByName('seat-number-plate')!);
    const backPos = worldPosition(backCushion);
    expect(platePos.z).toBeGreaterThan(backPos.z);
  });

  it('نسخه Instanced کات‌سین همان جهت و ارتفاع را دارد', () => {
    const group = createInstancedTheaterSeats([
      { x: 0, z: 0 },
      { x: 0.88, z: -1.08 },
    ]);
    const box = worldBox(group);
    expect(box.max.y).toBeLessThan(1.05);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);

    const backs = group.getObjectByName('instanced-seat-back-cushions') as THREE.InstancedMesh;
    expect(backs).toBeDefined();
    expect(backs.count).toBe(2);
    const matrix = new THREE.Matrix4();
    backs.getMatrixAt(0, matrix);
    const backPos = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(backPos.z).toBeGreaterThan(0.15);

    const kit = (group.userData as { seatKit?: { dispose: () => void } }).seatKit;
    kit?.dispose();
  });

  it('هر ۲۰ صندلی سالن پشتیِ عقب و ارتفاع یکسان واقعی دارند', () => {
    const theater = createTheaterGeometry();
    try {
      expect(theater.seats).toHaveLength(20);
      theater.group.updateMatrixWorld(true);
      for (const seat of theater.seats) {
        const backPos = worldPosition(seat.getObjectByName('seat-back-cushion')!);
        expect(backPos.z).toBeGreaterThan(seat.position.z + 0.15);
        const seatBox = worldBox(seat);
        expect(seatBox.max.y - seat.position.y).toBeLessThan(1.05);
      }
      // سکوی پلکانی زیر ردیف‌های عقب وجود دارد تا صندلی‌ها معلق نباشند
      expect(theater.group.getObjectByName('SeatRiser_2')).toBeDefined();
      expect(theater.group.getObjectByName('SeatRiser_4')).toBeDefined();
    } finally {
      theater.dispose();
    }
  });

  it('مصرف‌کننده‌ها دیگر هندسه صندلیِ وارونه/بلندِ جدا نمی‌سازند', () => {
    const cutscene = readFileSync('src/components/cinema/ThreeCutsceneView.tsx', 'utf8');
    expect(cutscene).toContain('createInstancedTheaterSeats');
    expect(cutscene).not.toContain('BoxGeometry(1.0, 1.12, 0.25)');

    const geometry = readFileSync('src/engine3d/theater-geometry.ts', 'utf8');
    expect(geometry).toContain('createTheaterSeat(row, col, seatKit)');
    expect(geometry).not.toContain('back.position.set(0, 0.8, -0.38)');

    // نمای دوبعدی هم کوتاه‌تر شده و پشت سر ردیف جلو از پشت دیده می‌شود
    const css = readFileSync('src/components/cinema/AuditoriumPerformanceView.module.css', 'utf8');
    expect(css).toContain('clamp(54px, 11.5vh, 92px)');
    expect(css).not.toContain('clamp(74px, 17vh, 132px)');
    const view = readFileSync('src/components/cinema/AuditoriumPerformanceView.tsx', 'utf8');
    expect(view).toContain('PlayerBackOfHead');
  });
});
