import * as THREE from 'three';

/** Zone bit assignments from CharacterCreator's CC0 output/clothing.json catalog. */
export type CharacterClothingName = 'coat' | 'shirt' | 'jeans' | 'skirt' | 'jacket' | 'dress' | 'boots';

export const CHARACTER_CLOTHING_ZONE_BITS: Readonly<Record<CharacterClothingName, number>> = {
  coat: 16,
  shirt: 512,
  jeans: 2,
  skirt: 4,
  jacket: 4096,
  dress: 2048,
  boots: 8192,
};

const CLOTHING_LAYER: Readonly<Record<CharacterClothingName, number>> = {
  boots: 1,
  jeans: 2,
  skirt: 2,
  shirt: 3,
  coat: 4,
  jacket: 4,
  dress: 3,
};

/** Bitmask of body zones hidden by all worn garments. */
export function getBodyHiddenZoneMask(worn: readonly CharacterClothingName[]): number {
  return worn.reduce((mask, name) => mask | CHARACTER_CLOTHING_ZONE_BITS[name], 0);
}

/** Bitmask of higher-layer garments that hide portions of a lower garment. */
export function getCoveringZoneMask(
  garment: CharacterClothingName,
  worn: readonly CharacterClothingName[],
): number {
  return worn.reduce((mask, other) => {
    if (CLOTHING_LAYER[other] <= CLOTHING_LAYER[garment]) return mask;
    return mask | CHARACTER_CLOTHING_ZONE_BITS[other];
  }, 0);
}

/**
 * Removes triangles whose three vertices are tagged as covered by `mask` in the
 * source mesh's _CCZONE attribute. GLTFLoader lowercases custom semantic names.
 * Returning the input unchanged avoids cloning geometries that have no matching
 * mask (or are fully visible).
 */
export function filterTrianglesByZoneMask(
  geometry: THREE.BufferGeometry,
  mask: number,
  attributeName = '_cczone',
): THREE.BufferGeometry {
  if (!mask || !geometry.index) return geometry;

  const zones = geometry.getAttribute(attributeName);
  if (!zones) return geometry;

  const index = geometry.index;
  const kept: number[] = [];
  for (let offset = 0; offset + 2 < index.count; offset += 3) {
    const a = index.getX(offset);
    const b = index.getX(offset + 1);
    const c = index.getX(offset + 2);
    const aCovered = (Math.trunc(zones.getX(a)) & mask) !== 0;
    const bCovered = (Math.trunc(zones.getX(b)) & mask) !== 0;
    const cCovered = (Math.trunc(zones.getX(c)) & mask) !== 0;
    if (aCovered && bCovered && cCovered) continue;
    kept.push(a, b, c);
  }

  if (kept.length === index.count) return geometry;

  const filtered = geometry.clone();
  filtered.setIndex(kept);
  filtered.deleteAttribute(attributeName);
  return filtered;
}
