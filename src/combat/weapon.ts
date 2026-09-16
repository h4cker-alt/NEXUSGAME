import * as THREE from 'three';

export class Weapon {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private raycaster = new THREE.Raycaster();
  private flashTimer = 0;

  public readonly group = new THREE.Group();
  public damage = 25;
  public fireRate = 180;
  private lastShot = 0;

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene
  ) {
    this.camera = camera;
    this.scene = scene;

    this.createWeapon();
  }

  private createWeapon() {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.18, 0.75),
      new THREE.MeshStandardMaterial({
        color: 0x151a27,
        metalness: 0.8,
        roughness: 0.3
      })
    );

    body.position.set(0.32, -0.25, -0.65);
    body.rotation.x = -0.08;

    this.group.add(body);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.045,
        0.055,
        0.38,
        12
      ),
      new THREE.MeshStandardMaterial({
        color: 0x30384d,
        metalness: 0.9,
        roughness: 0.2
      })
    );

    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(
      0.32,
      -0.23,
      -1.15
    );

    this.group.add(barrel);

    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.04,
        0.05,
        0.16
      ),
      new THREE.MeshBasicMaterial({
        color: 0x00eaff
      })
    );

    sight.position.set(
      0.32,
      -0.14,
      -0.72
    );

    this.group.add(sight);
  }

  update(delta: number) {
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;

      if (this.flashTimer <= 0) {
        this.removeFlash();
      }
    }
  }

  shoot(
    targets: THREE.Object3D[]
  ): THREE.Object3D | null {
    const now = performance.now();

    if (
      now - this.lastShot <
      this.fireRate
    ) {
      return null;
    }

    this.lastShot = now;

    this.createFlash();

    this.raycaster.setFromCamera(
      new THREE.Vector2(0, 0),
      this.camera
    );

    const hits =
      this.raycaster.intersectObjects(
        targets,
        true
      );

    if (hits.length === 0) {
      return null;
    }

    return hits[0].object;
  }

  private createFlash() {
    this.removeFlash();

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.12,
        8,
        8
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffd36a
      })
    );

    flash.position.set(
      0.32,
      -0.23,
      -1.35
    );

    this.group.add(flash);

    this.flashTimer = 0.045;
  }

  private removeFlash() {
    const flash =
      this.group.children.find(
        (child) =>
          child instanceof THREE.Mesh &&
          child.geometry instanceof
            THREE.SphereGeometry
      );

    if (flash) {
      this.group.remove(flash);
      if (flash instanceof THREE.Mesh) {
        flash.geometry.dispose();
      }

      if (
        flash instanceof THREE.Mesh &&
        flash.material instanceof
        THREE.Material
      ) {
        flash.material.dispose();
      }
    }
  }
}
