import * as THREE from 'three';

export type Collider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function collides(
  position: THREE.Vector3,
  radius: number,
  colliders: Collider[]
): boolean {
  for (const box of colliders) {
    const closestX = Math.max(
      box.minX,
      Math.min(position.x, box.maxX)
    );

    const closestZ = Math.max(
      box.minZ,
      Math.min(position.z, box.maxZ)
    );

    const dx = position.x - closestX;
    const dz = position.z - closestZ;

    if (dx * dx + dz * dz < radius * radius) {
      return true;
    }
  }

  return false;
}
