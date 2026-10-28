import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  filterTrianglesByZoneMask,
  getBodyHiddenZoneMask,
  getCoveringZoneMask,
} from '../../src/engine3d/characters/clothing-zones';

describe('character clothing-zone masks', () => {
  it('combines worn body zones and higher garment layers', () => {
    expect(getBodyHiddenZoneMask(['coat', 'shirt', 'jeans', 'boots'])).toBe(16 | 512 | 2 | 8192);
    expect(getBodyHiddenZoneMask(['dress', 'boots'])).toBe(2048 | 8192);
    expect(getCoveringZoneMask('shirt', ['coat', 'shirt', 'jeans'])).toBe(16);
    expect(getCoveringZoneMask('jeans', ['coat', 'shirt', 'jeans'])).toBe(16 | 512);
    expect(getCoveringZoneMask('skirt', ['shirt', 'skirt', 'jacket'])).toBe(512 | 4096);
    expect(getCoveringZoneMask('coat', ['coat', 'shirt', 'jeans'])).toBe(0);
  });

  it('removes only fully covered triangles and leaves the shared source geometry untouched', () => {
    const source = new THREE.BufferGeometry();
    source.setAttribute('_cczone', new THREE.Float32BufferAttribute([1, 1, 1, 1, 0, 1], 1));
    source.setIndex([0, 1, 2, 3, 4, 5]);

    const filtered = filterTrianglesByZoneMask(source, 1);

    expect(filtered).not.toBe(source);
    expect(Array.from(filtered.index!.array)).toEqual([3, 4, 5]);
    expect(filtered.getAttribute('_cczone')).toBeUndefined();
    expect(source.index!.count).toBe(6);
    filtered.dispose();
    source.dispose();
  });

  it('does not clone geometry when the mask has no matching vertices', () => {
    const source = new THREE.BufferGeometry();
    source.setAttribute('_cczone', new THREE.Float32BufferAttribute([0, 0, 0], 1));
    source.setIndex([0, 1, 2]);

    expect(filterTrianglesByZoneMask(source, 1)).toBe(source);
    source.dispose();
  });
});
