import * as THREE from 'three';

export class SafeZone {
  public center = new THREE.Vector3(0, 0, 0);

  public radius = 180;

  public targetRadius = 180;

  public phase = 1;

  public timeRemaining = 120;

  private readonly ring: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.RingGeometry(
      0.96,
      1,
      128
    );

    const material =
      new THREE.MeshBasicMaterial({
        color: 0x00eaff,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide
      });

    this.ring = new THREE.Mesh(
      geometry,
      material
    );

    this.ring.rotation.x =
      -Math.PI / 2;

    this.ring.position.y = 0.08;

    scene.add(this.ring);

    this.updateVisual();
  }

  update(delta: number) {
    this.timeRemaining -= delta;

    if (this.timeRemaining <= 0) {
      this.startNextPhase();
    }

    if (
      Math.abs(
        this.radius -
          this.targetRadius
      ) > 0.05
    ) {
      this.radius = THREE.MathUtils.lerp(
        this.radius,
        this.targetRadius,
        Math.min(delta * 0.35, 1)
      );
    }

    this.updateVisual();
  }

  private startNextPhase() {
    this.phase++;

    this.timeRemaining =
      Math.max(
        35,
        120 - this.phase * 10
      );

    this.targetRadius =
      Math.max(
        25,
        this.radius * 0.62
      );

    const maxOffset =
      Math.max(
        0,
        this.radius -
          this.targetRadius
      );

    this.center.x +=
      (Math.random() * 2 - 1) *
      maxOffset *
      0.35;

    this.center.z +=
      (Math.random() * 2 - 1) *
      maxOffset *
      0.35;
  }

  private updateVisual() {
    this.ring.position.x =
      this.center.x;

    this.ring.position.z =
      this.center.z;

    this.ring.scale.set(
      this.radius,
      this.radius,
      this.radius
    );
  }

  isOutside(
    position: THREE.Vector3
  ) {
    const dx =
      position.x -
      this.center.x;

    const dz =
      position.z -
      this.center.z;

    return (
      Math.sqrt(
        dx * dx +
        dz * dz
      ) > this.radius
    );
  }

  getDamagePerSecond() {
    return (
      2 +
      this.phase * 1.5
    );
  }

  getTimeText() {
    const seconds =
      Math.max(
        0,
        Math.ceil(
          this.timeRemaining
        )
      );

    const minutes =
      Math.floor(
        seconds / 60
      );

    const remaining =
      seconds % 60;

    return `${minutes}:${remaining
      .toString()
      .padStart(2, '0')}`;
  }
}
