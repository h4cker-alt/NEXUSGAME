import * as THREE from 'three';

export class Drone {
  public readonly group =
    new THREE.Group();

  public health = 100;
  public readonly maxHealth = 100;

  private velocity =
    new THREE.Vector3();

  private readonly speed = 2.5;
  private readonly attackRange = 16;

  private healthBar!: THREE.Mesh;
  private target: THREE.Object3D;

  constructor(
    position: THREE.Vector3,
    target: THREE.Object3D
  ) {
    this.target = target;

    this.createDrone();

    this.group.position.copy(
      position
    );
  }

  private createDrone() {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(
        1,
        16,
        12
      ),
      new THREE.MeshStandardMaterial({
        color: 0x252c42,
        metalness: 0.8,
        roughness: 0.25
      })
    );

    body.scale.set(
      1,
      0.65,
      1
    );

    body.castShadow = true;

    this.group.add(body);

    // Core
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.28,
        12,
        8
      ),
      new THREE.MeshBasicMaterial({
        color: 0xff304f
      })
    );

    core.position.y = -0.05;

    this.group.add(core);

    // Drone arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(
          1.8,
          0.12,
          0.12
        ),
        new THREE.MeshStandardMaterial({
          color: 0x101522,
          metalness: 0.9
        })
      );

      arm.position.x = side * 0.7;

      this.group.add(arm);
    }

    this.createHealthBar();
  }

  private createHealthBar() {
    const background =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          2.2,
          0.18
        ),
        new THREE.MeshBasicMaterial({
          color: 0x220811
        })
      );

    background.position.y = 1.45;

    this.group.add(background);

    this.healthBar =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          2.2,
          0.18
        ),
        new THREE.MeshBasicMaterial({
          color: 0xff304f
        })
      );

    this.healthBar.position.set(
      0,
      1.45,
      0.01
    );

    this.group.add(
      this.healthBar
    );
  }

  update(
    delta: number
  ) {
    if (this.health <= 0) {
      return;
    }

    const direction =
      this.target.position
        .clone()
        .sub(this.group.position);

    const distance =
      direction.length();

    if (
      distance > this.attackRange
    ) {
      direction.normalize();

      this.velocity.lerp(
        direction.multiplyScalar(
          this.speed
        ),
        0.05
      );

      this.group.position.add(
        this.velocity
          .clone()
          .multiplyScalar(delta)
      );
    } else {
      this.velocity.multiplyScalar(
        0.9
      );
    }

    if (distance > 0.1) {
      this.group.lookAt(
        this.target.position
      );
    }

    // Keep drone floating
    this.group.position.y =
      3 +
      Math.sin(
        performance.now() * 0.002 +
        this.group.position.x
      ) *
        0.35;

    this.healthBar.lookAt(
      this.target.position
    );
  }

  takeDamage(
    amount: number
  ): boolean {
    this.health -= amount;

    this.health =
      Math.max(0, this.health);

    const ratio =
      this.health /
      this.maxHealth;

    this.healthBar.scale.x =
      ratio;

    this.healthBar.position.x =
      -1.1 * (1 - ratio);

    if (this.health <= 0) {
      this.destroy();
      return true;
    }

    return false;
  }

  private destroy() {
    this.group.traverse(
      (object) => {
        if (
          object instanceof THREE.Mesh
        ) {
          object.geometry.dispose();

          if (
            object.material instanceof
            THREE.Material
          ) {
            object.material.dispose();
          }
        }
      }
    );
  }
}
