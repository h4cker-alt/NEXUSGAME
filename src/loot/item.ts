import * as THREE from 'three';

export type LootType =
  | 'rifle'
  | 'smg'
  | 'shotgun'
  | 'armor'
  | 'medkit'
  | 'ammo';

export type LootData = {
  type: LootType;
  amount: number;
  label: string;
};

export class LootItem {
  public readonly group =
    new THREE.Group();

  public readonly data: LootData;

  public collected = false;

  private time = Math.random() * 10;

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    data: LootData
  ) {
    this.data = data;

    this.createVisual();

    this.group.position.copy(
      position
    );

    scene.add(
      this.group
    );
  }

  private createVisual() {
    let color = 0xffffff;

    if (
      this.data.type ===
      'rifle'
    ) {
      color = 0xffc857;
    }

    if (
      this.data.type ===
      'smg'
    ) {
      color = 0x5ee7ff;
    }

    if (
      this.data.type ===
      'shotgun'
    ) {
      color = 0xff6b6b;
    }

    if (
      this.data.type ===
      'armor'
    ) {
      color = 0x9b8cff;
    }

    if (
      this.data.type ===
      'medkit'
    ) {
      color = 0x62e572;
    }

    if (
      this.data.type ===
      'ammo'
    ) {
      color = 0xf0f0f0;
    }

    const mesh =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.7,
          0.45,
          0.7
        ),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.12,
          metalness: 0.5,
          roughness: 0.35
        })
      );

    mesh.castShadow = true;

    this.group.add(
      mesh
    );
  }

  update(delta: number) {
    if (
      this.collected
    ) {
      return;
    }

    this.time += delta;

    this.group.rotation.y +=
      delta * 1.5;

    this.group.position.y =
      0.6 +
      Math.sin(
        this.time * 2
      ) *
        0.12;
  }

  collect() {
    this.collected = true;

    this.group.visible =
      false;
  }

  getDistanceTo(
    position: THREE.Vector3
  ) {
    return this.group.position.distanceTo(
      position
    );
  }
}
