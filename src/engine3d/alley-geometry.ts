'use client';

/**
 * alley-geometry.ts — هندسه ماژولار کوچه تماشاخانه (علیرضا — موج ۴)
 * - زمین سنگ‌فرش
 * - دیوارهای چپ/راست
 * - نمای تئاتر با در
 * - لنگرهای playbill / row chart / door برای اتصال UI امیرعلی
 * - نورپردازی سینمایی
 * - همه ابعاد با مقیاس واقعی (متر) — شخصیت ۱.۷۵m قد
 */

import * as THREE from 'three';
import type { AlleyAnchors, WorldBounds } from './types';
import { DEFAULT_ALLEY_ANCHORS, DEFAULT_ALLEY_BOUNDS } from './types';

export interface AlleyGeometryResult {
  group: THREE.Group;
  anchors: AlleyAnchors;
  bounds: WorldBounds;
  lights: THREE.Light[];
  dispose: () => void;
}

export function createAlleyGeometry(): AlleyGeometryResult {
  const group = new THREE.Group();
  group.name = 'AlleyRoot';

  const bounds = DEFAULT_ALLEY_BOUNDS;
  const anchors = DEFAULT_ALLEY_ANCHORS;

  // --- زمین ---
  const groundGeo = new THREE.PlaneGeometry(22, 30);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a3a,
    roughness: 0.85,
    metalness: 0.15,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  ground.name = 'Ground';
  group.add(ground);

  // خطوط سنگ‌فرش (decal ساده)
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3a3a4a, transparent: true, opacity: 0.4 });
  for (let i = -14; i <= 8; i += 2) {
    const points = [new THREE.Vector3(-11, 0.01, i), new THREE.Vector3(11, 0.01, i)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, lineMat);
    group.add(line);
  }

  // --- دیوار چپ ---
  const wallLeftGeo = new THREE.BoxGeometry(0.6, 5, 28);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1e2e, roughness: 0.9 });
  const wallLeft = new THREE.Mesh(wallLeftGeo, wallMat);
  wallLeft.position.set(-9.5, 2.5, -3);
  wallLeft.castShadow = true;
  wallLeft.receiveShadow = true;
  wallLeft.name = 'WallLeft';
  group.add(wallLeft);

  // --- دیوار راست ---
  const wallRight = new THREE.Mesh(wallLeftGeo, wallMat);
  wallRight.position.set(9.5, 2.5, -3);
  wallRight.castShadow = true;
  wallRight.receiveShadow = true;
  wallRight.name = 'WallRight';
  group.add(wallRight);

  // --- تابلوی اعلانات (playbill) — لنگر چپ ---
  const billboardGeo = new THREE.BoxGeometry(2.8, 2.2, 0.15);
  const billboardMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.7 });
  const billboard = new THREE.Mesh(billboardGeo, billboardMat);
  billboard.position.set(anchors.playbill.x, anchors.playbill.y, anchors.playbill.z);
  billboard.name = 'PlaybillBoard';
  billboard.userData.anchorId = 'playbill';
  billboard.castShadow = true;
  group.add(billboard);

  // قاب طلایی دور تابلو
  const frameGeo = new THREE.EdgesGeometry(billboardGeo);
  const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: 0xc9a86a }));
  frame.position.copy(billboard.position);
  group.add(frame);

  // --- گیشه (row chart) — لنگر راست ---
  const counterGeo = new THREE.BoxGeometry(2.6, 1.6, 1.2);
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.6, metalness: 0.2 });
  const counter = new THREE.Mesh(counterGeo, counterMat);
  counter.position.set(anchors.rowChart.x, 1.0, anchors.rowChart.z);
  counter.name = 'RowChartCounter';
  counter.userData.anchorId = 'rowChart';
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  const chartGeo = new THREE.PlaneGeometry(2.2, 1.4);
  const chartMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.8, side: THREE.DoubleSide });
  const chart = new THREE.Mesh(chartGeo, chartMat);
  chart.position.set(anchors.rowChart.x, anchors.rowChart.y, anchors.rowChart.z + 0.61);
  chart.name = 'RowChartBoard';
  group.add(chart);

  // --- نمای تئاتر + در ---
  const facadeGeo = new THREE.BoxGeometry(8, 6, 0.8);
  const facadeMat = new THREE.MeshStandardMaterial({ color: 0x2e2a3a, roughness: 0.8 });
  const facade = new THREE.Mesh(facadeGeo, facadeMat);
  facade.position.set(anchors.theaterDoor.x, 3, anchors.theaterDoor.z - 0.5);
  facade.name = 'TheaterFacade';
  facade.castShadow = true;
  facade.receiveShadow = true;
  group.add(facade);

  const doorGeo = new THREE.BoxGeometry(2.2, 3.2, 0.2);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2218, roughness: 0.6, metalness: 0.1 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(anchors.theaterDoor.x, 1.6, anchors.theaterDoor.z);
  door.name = 'TheaterDoor';
  door.userData.anchorId = 'theaterDoor';
  door.castShadow = true;
  group.add(door);

  const doorLightGeo = new THREE.SphereGeometry(0.12, 12, 12);
  const doorLightMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, emissive: 0xc9a86a, emissiveIntensity: 1.2 });
  const doorLampLeft = new THREE.Mesh(doorLightGeo, doorLightMat);
  doorLampLeft.position.set(-1.6, 3.2, anchors.theaterDoor.z + 0.2);
  group.add(doorLampLeft);
  const doorLampRight = doorLampLeft.clone();
  doorLampRight.position.set(1.6, 3.2, anchors.theaterDoor.z + 0.2);
  group.add(doorLampRight);

  // --- نورپردازی ---
  const lights: THREE.Light[] = [];

  const ambient = new THREE.AmbientLight(0x9999bb, 0.55);
  group.add(ambient);
  lights.push(ambient);

  const moon = new THREE.DirectionalLight(0x8899cc, 1.2);
  moon.position.set(5, 10, 5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 30;
  moon.shadow.camera.left = -12;
  moon.shadow.camera.right = 12;
  moon.shadow.camera.top = 12;
  moon.shadow.camera.bottom = -12;
  group.add(moon);
  lights.push(moon);

  const doorSpot = new THREE.SpotLight(0xffd9a0, 2.5, 18, Math.PI / 6, 0.35, 1.2);
  doorSpot.position.set(0, 6, -8);
  doorSpot.target = door;
  doorSpot.castShadow = true;
  group.add(doorSpot);
  lights.push(doorSpot);

  const fillLeft = new THREE.PointLight(0xc9a86a, 0.8, 8);
  fillLeft.position.set(anchors.playbill.x, 2.5, anchors.playbill.z + 1);
  group.add(fillLeft);
  lights.push(fillLeft);

  const fillRight = new THREE.PointLight(0xc9a86a, 0.8, 8);
  fillRight.position.set(anchors.rowChart.x, 2.5, anchors.rowChart.z + 1);
  group.add(fillRight);
  lights.push(fillRight);

  // مه از scene اصلی میاد

  const dispose = () => {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  };

  return { group, anchors, bounds, lights, dispose };
}
