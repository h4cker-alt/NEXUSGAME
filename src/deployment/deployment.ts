import * as THREE from "three";

export type DeploymentState =
  | "PLANE"
  | "FALLING"
  | "PARACHUTE"
  | "LANDED";

export class Deployment {
  public state: DeploymentState = "PLANE";

  public plane: THREE.Group;
  public parachute: THREE.Group;

  public position = new THREE.Vector3();

  private direction = new THREE.Vector3(1, 0, 0);

  private planeSpeed = 42;

  private fallSpeed = 12;
  private parachuteSpeed = 5;

  private mapLimit = 235;

  constructor(private scene: THREE.Scene) {
    this.plane = this.createPlane();
    this.parachute = this.createParachute();

    this.plane.visible = false;
    this.parachute.visible = false;

    scene.add(this.plane);
    scene.add(this.parachute);
  }

  // ============================================================
  // AIRCRAFT
  // ============================================================

  private createPlane() {
    const group = new THREE.Group();

    // ============================================================
    // MATERIALS
    // ============================================================

    const hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x161c24,
      metalness: 0.82,
      roughness: 0.28
    });

    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x202938,
      metalness: 0.72,
      roughness: 0.34
    });

    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x071827,
      metalness: 0.7,
      roughness: 0.12,
      emissive: 0x06334a,
      emissiveIntensity: 0.45
    });

    const cyanMaterial = new THREE.MeshStandardMaterial({
      color: 0x00bde8,
      emissive: 0x00d9ff,
      emissiveIntensity: 3.2,
      metalness: 0.25,
      roughness: 0.25
    });

    const magentaMaterial = new THREE.MeshStandardMaterial({
      color: 0xff21d4,
      emissive: 0xff16d0,
      emissiveIntensity: 2.4,
      metalness: 0.25,
      roughness: 0.28
    });

    const engineMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      metalness: 0.9,
      roughness: 0.22
    });

    // ============================================================
    // MAIN FUSELAGE
    // ============================================================

    // ============================================================
    // MAIN TRANSPORT FUSELAGE
    // ============================================================
    // Deliberately NOT a capsule. The aircraft uses a broad,
    // angular military-transport silhouette like the reference.

    const fuselage = new THREE.Mesh(
      new THREE.BoxGeometry(
        7.8,
        2.8,
        3.0
      ),
      hullMaterial
    );

    fuselage.position.x = -0.1;
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    group.add(fuselage);

    // Upper armored spine.
    const upperBody = new THREE.Mesh(
      new THREE.BoxGeometry(
        5.8,
        1.0,
        2.35
      ),
      panelMaterial
    );

    upperBody.position.set(
      -0.15,
      1.45,
      0
    );

    upperBody.castShadow = true;
    group.add(upperBody);

    // Lower cargo body.
    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(
        5.9,
        0.75,
        2.65
      ),
      panelMaterial
    );

    lowerBody.position.set(
      -0.35,
      -1.55,
      0
    );

    lowerBody.castShadow = true;
    group.add(lowerBody);

    // ============================================================
    // ANGULAR NOSE
    // ============================================================

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(
        1.55,
        3.4,
        8
      ),
      hullMaterial
    );

    // Cone points along +X.
    nose.rotation.z = -Math.PI / 2;

    nose.position.x = 4.75;
    nose.scale.z = 0.92;
    nose.castShadow = true;
    group.add(nose);

    // Nose armor plate.
    const nosePlate = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.0,
        1.55,
        2.35
      ),
      panelMaterial
    );

    nosePlate.position.set(
      3.65,
      0,
      0
    );

    nosePlate.castShadow = true;
    group.add(nosePlate);

    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 1.05, 2.35),
      glassMaterial
    );

    cockpit.position.set(
      3.95,
      0.72,
      0
    );

    cockpit.rotation.z = -0.10;
    group.add(cockpit);

    // Cockpit center divider.
    const cockpitDivider = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.12, 2.4),
      hullMaterial
    );

    cockpitDivider.position.set(
      3.36,
      0.66,
      0
    );

    group.add(cockpitDivider);

    // ============================================================
    // WINGS
    // ============================================================

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.0,
        0.22,
        18.5
      ),
      panelMaterial
    );

    wing.position.x = 0.25;
    wing.castShadow = true;
    group.add(wing);

    // Swept wing tips.
    for (const z of [-7.1, 7.1]) {
      const tip = new THREE.Mesh(
        new THREE.BoxGeometry(
          2.0,
          0.16,
          2.5
        ),
        panelMaterial
      );

      tip.position.set(
        -0.25,
        0.02,
        z
      );

      tip.rotation.y =
        z > 0 ? -0.16 : 0.16;

      tip.castShadow = true;
      group.add(tip);

      // Cyan wing edge.
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.08,
          0.06,
          2.35
        ),
        cyanMaterial
      );

      edge.position.set(
        0.22,
        0.15,
        z
      );

      group.add(edge);
    }

    // ============================================================
    // FUTURISTIC WING CIRCUIT STRIPS
    // ============================================================

    for (const z of [-5.8, -3.4, 3.4, 5.8]) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.08,
          0.045,
          2.0
        ),
        z < 0 ? cyanMaterial : magentaMaterial
      );

      strip.position.set(
        0.42,
        0.15,
        z
      );

      group.add(strip);
    }

    // Central glowing emblem.
    const emblem = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.78, 3),
      cyanMaterial
    );

    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(
      0.5,
      1.35,
      0
    );

    group.add(emblem);

    // ============================================================
    // FOUR TURBOPROP ENGINES
    // ============================================================

    const enginePositions = [
      [0.55, -3.35],
      [0.55, 3.35],
      [-0.35, -5.05],
      [-0.35, 5.05]
    ];

    for (const [engineX, engineZ] of enginePositions) {
      const engine = new THREE.Group();

      const nacelle = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.68,
          0.78,
          2.0,
          16
        ),
        engineMaterial
      );

      nacelle.rotation.x = Math.PI / 2;
      engine.add(nacelle);

      const intake = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.50,
          0.58,
          0.12,
          16
        ),
        hullMaterial
      );

      intake.rotation.x = Math.PI / 2;
      intake.position.z = 0.98;
      engine.add(intake);

      // Propeller hub.
      const hub = new THREE.Mesh(
        new THREE.SphereGeometry(0.20, 10, 8),
        cyanMaterial
      );

      hub.position.z = 1.08;
      engine.add(hub);

      // Four propeller blades.
      const propeller = new THREE.Group();

      for (let blade = 0; blade < 4; blade++) {
        const bladeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.12,
            1.35,
            0.10
          ),
          panelMaterial
        );

        bladeMesh.position.y = 0.68;
        bladeMesh.rotation.z =
          (Math.PI * 2 * blade) / 4;

        propeller.add(bladeMesh);
      }

      propeller.position.z = 1.16;
      propeller.userData.isPropeller = true;

      engine.add(propeller);

      engine.position.set(
        engineX,
        -0.18,
        engineZ
      );

      engine.userData.propeller = propeller;

      group.add(engine);
    }

    // ============================================================
    // TAIL
    // ============================================================

    const tailFin = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.7,
        3.9,
        0.25
      ),
      panelMaterial
    );

    tailFin.position.set(
      -3.45,
      1.65,
      0
    );

    tailFin.rotation.z = -0.10;
    tailFin.castShadow = true;
    group.add(tailFin);

    const tailLight = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.35,
        0.12,
        0.12
      ),
      magentaMaterial
    );

    tailLight.position.set(
      -3.55,
      3.15,
      0
    );

    group.add(tailLight);

    // Horizontal tail planes.
    for (const z of [-2.3, 2.3]) {
      const stabilizer = new THREE.Mesh(
        new THREE.BoxGeometry(
          1.45,
          0.16,
          3.4
        ),
        panelMaterial
      );

      stabilizer.position.set(
        -3.25,
        1.0,
        z
      );

      stabilizer.rotation.y =
        z > 0 ? -0.12 : 0.12;

      group.add(stabilizer);
    }

    // ============================================================
    // REAR CARGO RAMP
    // ============================================================

    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(
        2.8,
        0.12,
        3.1
      ),
      hullMaterial
    );

    ramp.position.set(
      -4.15,
      -1.15,
      0
    );

    ramp.rotation.z = -0.28;
    ramp.castShadow = true;
    group.add(ramp);

    // Cyan ramp edge.
    const rampLight = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.08,
        0.08,
        2.8
      ),
      cyanMaterial
    );

    rampLight.position.set(
      -5.35,
      -1.55,
      0
    );

    group.add(rampLight);

    // ============================================================
    // SCALE / DEBUG FLAGS
    // ============================================================

    group.scale.setScalar(1.35);

    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return group;
  }

  // ============================================================
  // PARACHUTE
  // ============================================================

  private createParachute() {
    const group = new THREE.Group();

    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(
        4,
        24,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
      ),
      new THREE.MeshStandardMaterial({
        color: 0xe5edf0,
        side: THREE.DoubleSide,
        roughness: 0.8,
      })
    );

    canopy.scale.y = 0.45;

    canopy.position.y = 4;

    group.add(canopy);

    const ropesMaterial =
      new THREE.LineBasicMaterial({
        color: 0xffffff,
      });

    const ropePositions = [
      [-3, 4, -2],
      [3, 4, -2],
      [-3, 4, 2],
      [3, 4, 2],
    ];

    for (const [x, y, z] of ropePositions) {
      const points = [
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(
          x * 0.35,
          0,
          z * 0.35
        ),
      ];

      const geometry =
        new THREE.BufferGeometry().setFromPoints(
          points
        );

      const rope =
        new THREE.Line(
          geometry,
          ropesMaterial
        );

      group.add(rope);
    }

    group.visible = false;

    return group;
  }

  // ============================================================
  // START
  // ============================================================

  start() {
    this.state = "PLANE";

    this.plane.visible = true;
    this.parachute.visible = false;

    this.position.set(
      -230,
      95,
      -230
    );

    this.plane.position.copy(
      this.position
    );

    this.plane.rotation.y =
      Math.PI / 4;
  }

  // ============================================================
  // JUMP
  // ============================================================

  jump() {
    if (
      this.state !== "PLANE"
    ) {
      return false;
    }

    this.state = "FALLING";

    this.plane.visible = false;

    this.parachute.visible = false;

    this.position.y = 95;

    return true;
  }

  // ============================================================
  // PARACHUTE
  // ============================================================

  openParachute() {
    if (
      this.state !==
      "FALLING"
    ) {
      return;
    }

    this.state =
      "PARACHUTE";

    this.parachute.visible =
      true;

    this.parachute.position.copy(
      this.position
    );
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(
    delta: number
  ) {
    if (
      this.state ===
      "PLANE"
    ) {
      this.position.x +=
        this.planeSpeed *
        delta;

      this.position.z +=
        this.planeSpeed *
        delta;

      this.plane.position.copy(
        this.position
      );

      this.plane.rotation.y =
        Math.PI / 4;

      // Animate all four turboprop propellers.
      this.plane.traverse((object) => {
        if (
          object instanceof THREE.Group &&
          object.userData.isPropeller === true
        ) {
          object.rotation.z += delta * 32;
        }
      });

      // Subtle aircraft banking while flying.
      this.plane.rotation.z =
        Math.sin(performance.now() * 0.0015) * 0.025;

      if (
        this.position.x >
          this.mapLimit ||
        this.position.z >
          this.mapLimit
      ) {
        this.position.set(
          -230,
          95,
          -230
        );
      }

      return;
    }

    if (
      this.state ===
      "FALLING"
    ) {
      this.position.y -=
        this.fallSpeed *
        delta;

      if (
        this.position.y <
        35
      ) {
        this.openParachute();
      }

      return;
    }

    if (
      this.state ===
      "PARACHUTE"
    ) {
      this.position.y -=
        this.parachuteSpeed *
        delta;

      this.parachute.position.copy(
        this.position
      );

      if (
        this.position.y <=
        1
      ) {
        this.position.y = 0;

        this.state =
          "LANDED";

        this.parachute.visible =
          false;
      }
    }
  }

  // ============================================================
  // DESTROY
  // ============================================================

  dispose() {
    this.scene.remove(
      this.plane
    );

    this.scene.remove(
      this.parachute
    );
  }
}
