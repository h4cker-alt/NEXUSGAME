import * as THREE from "three";

export class BattleMap {
  public colliders: THREE.Box3[] = [];
  public houseLootSpawns: THREE.Vector3[] = [];

  private interiorZones: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    floorHeight: number;
    floors: number;
  }[] = [];

  private stairZones: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    startY: number;
    endY: number;
  }[] = [];

  private scene: THREE.Scene;
  private townGroup = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    scene.add(this.townGroup);

    this.createTerrain();
    this.createWater();
    this.createRoadNetwork();
    this.createTown();
    this.createPOIs();
    this.createWalls();
    this.createTrees();
    this.createHouseDoors();
    this.createHouseWindows();
    this.createHouseExteriorDetails();
    this.createRoadsideDetails();
    this.createNaturalVegetation();
    this.createCars();
    this.createStreetLights();
    this.createTower();
    this.createCommsCompound();
    this.createMountains();
    this.createOuterHills();
  }

  // ============================================================
  // TERRAIN
  // ============================================================

  private createTerrain() {
    const terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(
          520,
          520,
          64,
          64
        ),
      new THREE.MeshStandardMaterial({
        color: 0x697653,
        roughness: 1,
      })
    );

    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;

    this.townGroup.add(terrain);

    // Dirt patches
    for (let i = 0; i < 90; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(
          2 + Math.random() * 6,
          12
        ),
        new THREE.MeshStandardMaterial({
          color: 0x7d6b4f,
          roughness: 1,
        })
      );

      patch.rotation.x = -Math.PI / 2;

      patch.position.set(
        (Math.random() - 0.5) * 500,
        0.015,
        (Math.random() - 0.5) * 500
      );

      this.townGroup.add(patch);
    }
  }

  // ============================================================
  // WATER / RIVER
  // ============================================================

  private createWater() {
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d91ad,
      metalness: 0.15,
      roughness: 0.22,
      transparent: true,
      opacity: 0.82
    });

    // Main river crossing the island.
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 48),
      waterMaterial
    );

    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.035, -82);
    river.receiveShadow = true;
    this.townGroup.add(river);

    // Lake at the eastern side.
    const lake = new THREE.Mesh(
      new THREE.CircleGeometry(42, 32),
      waterMaterial
    );

    lake.rotation.x = -Math.PI / 2;
    lake.scale.set(1.35, 0.72, 1);
    lake.position.set(165, 0.04, 95);
    lake.receiveShadow = true;
    this.townGroup.add(lake);

    // Smaller pond in the western forest.
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(24, 28),
      waterMaterial
    );

    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(1.25, 0.75, 1);
    pond.position.set(-165, 0.045, 92);
    pond.receiveShadow = true;
    this.townGroup.add(pond);

    // Bridges across the main river.
    const bridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x55483c,
      roughness: 0.88
    });

    for (const x of [-105, 0, 105]) {
      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(
          22,
          0.45,
          55
        ),
        bridgeMaterial
      );

      bridge.position.set(x, 0.25, -82);
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      this.townGroup.add(bridge);

      // Bridge railings.
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(
            22,
            1.1,
            0.18
          ),
          bridgeMaterial
        );

        rail.position.set(
          x,
          0.85,
          -38 + side * 25
        );

        this.townGroup.add(rail);
      }
    }
  }

  // ============================================================
  // MAJOR MAP POIs
  // ============================================================

  private createPOIs() {
    const metal = new THREE.MeshStandardMaterial({
      color: 0x3b4148,
      metalness: 0.65,
      roughness: 0.38
    });

    const concrete = new THREE.MeshStandardMaterial({
      color: 0x777b78,
      roughness: 0.92
    });

    const roof = new THREE.MeshStandardMaterial({
      color: 0x252a30,
      metalness: 0.35,
      roughness: 0.6
    });

    // ------------------------------------------------------------
    // INDUSTRIAL COMPOUND
    // ------------------------------------------------------------

    const warehouse = new THREE.Mesh(
      new THREE.BoxGeometry(32, 7, 24),
      metal
    );

    warehouse.position.set(-175, 3.5, -20);
    warehouse.castShadow = true;
    warehouse.receiveShadow = true;
    this.townGroup.add(warehouse);

    const warehouseRoof = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.5, 26),
      roof
    );

    warehouseRoof.position.set(
      -175,
      7.25,
      -20
    );

    this.townGroup.add(warehouseRoof);

    // Warehouse doors.
    for (const z of [-28, -20, -12]) {
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 4.2, 4.5),
        concrete
      );

      door.position.set(
        -158.85,
        2.1,
        z
      );

      this.townGroup.add(door);
    }

    // ------------------------------------------------------------
    // GAS STATION
    // ------------------------------------------------------------

    const station = new THREE.Mesh(
      new THREE.BoxGeometry(18, 4, 14),
      concrete
    );

    station.position.set(
      165,
      2,
      -35
    );

    station.castShadow = true;
    this.townGroup.add(station);

    const stationRoof = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.45, 20),
      roof
    );

    stationRoof.position.set(
      165,
      4.25,
      -35
    );

    this.townGroup.add(stationRoof);

    // Fuel canopy.
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(28, 0.35, 12),
      metal
    );

    canopy.position.set(
      165,
      4.8,
      -17
    );

    this.townGroup.add(canopy);

    for (const x of [154, 176]) {
      const column = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 4.8, 0.45),
        metal
      );

      column.position.set(
        x,
        2.4,
        -17
      );

      this.townGroup.add(column);
    }

    // ------------------------------------------------------------
      // Fuel pumps.
      const pumpMaterial = new THREE.MeshStandardMaterial({
        color: 0x343a3f,
        metalness: 0.45,
        roughness: 0.5
      });

      for (const pumpX of [159, 165, 171]) {
        const pump = new THREE.Mesh(
          new THREE.BoxGeometry(1.25, 1.8, 0.75),
          pumpMaterial
        );

        pump.position.set(pumpX, 0.9, -17);
        pump.castShadow = true;
        this.townGroup.add(pump);

        const display = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.32, 0.06),
          new THREE.MeshStandardMaterial({
            color: 0x172026,
            emissive: 0x0b5664,
            emissiveIntensity: 1.2
          })
        );

        display.position.set(pumpX, 1.45, -16.62);
        this.townGroup.add(display);
      }

      // Tall roadside station sign.
      const signPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, 6.5, 10),
        metal
      );

      signPole.position.set(183, 3.25, -28);
      this.townGroup.add(signPole);

      const stationSign = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 2.8, 0.35),
        roof
      );

      stationSign.position.set(183, 6.7, -28);
      this.townGroup.add(stationSign);

      // Canopy lights.
      for (const lightX of [157, 165, 173]) {
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.12, 0.7),
          new THREE.MeshStandardMaterial({
            color: 0xfff0c2,
            emissive: 0xffc95f,
            emissiveIntensity: 2
          })
        );

        light.position.set(lightX, 4.58, -17);
        this.townGroup.add(light);
      }

    // ============================================================
    // OUTPOST HIGH GROUND
    // ============================================================

    const hillMaterial = new THREE.MeshStandardMaterial({
      color: 0x59634b,
      roughness: 1
    });

    const hill = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 42, 8, 24),
      hillMaterial
    );

    hill.position.set(-165, 4, 165);
    hill.scale.z = 0.82;
    hill.receiveShadow = true;
    this.townGroup.add(hill);

    // Access ramp.
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(9, 1.2, 32),
      concrete
    );

    ramp.position.set(-165, 4.1, 137);
    ramp.rotation.x = -0.12;
    ramp.castShadow = true;
    this.townGroup.add(ramp);

    // Lookout railing.
    const railingMaterial = new THREE.MeshStandardMaterial({
      color: 0x454b4e,
      metalness: 0.55,
      roughness: 0.5
    });

    for (const side of [-1, 1]) {
      const railing = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1.4, 22),
        railingMaterial
      );

      railing.position.set(
        -165 + side * 8,
        9.2,
        165
      );

      this.townGroup.add(railing);
    }

    // Communications antenna.
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 12, 10),
      railingMaterial
    );

    antenna.position.set(-165, 21, 165);
    this.townGroup.add(antenna);

    for (const y of [18, 21, 24]) {
      const antennaRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.8, 0.08, 8, 24),
        railingMaterial
      );

      antennaRing.position.set(-165, y, 165);
      antennaRing.rotation.x = Math.PI / 2;
      this.townGroup.add(antennaRing);
    }

    // Outpost warning lights.
    for (const [lx, lz] of [
      [-172, 165],
      [-158, 165],
      [-165, 174]
    ]) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff5533,
          emissive: 0xff2200,
          emissiveIntensity: 2
        })
      );

      beacon.position.set(lx, 10.2, lz);
      this.townGroup.add(beacon);
    }

    // Supply crates around the outpost.
    for (const [cx, cz] of [
      [-177, 158],
      [-180, 162],
      [-153, 158],
      [-154, 162]
    ]) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.2, 2.4),
        new THREE.MeshStandardMaterial({
          color: 0x80623d,
          roughness: 1
        })
      );

      crate.position.set(cx, 9, cz);
      this.townGroup.add(crate);
    }

    // HILLTOP OUTPOST
    // ------------------------------------------------------------

    const towerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(
        7,
        9,
        14,
        8
      ),
      concrete
    );

    towerBase.position.set(
      -165,
      7,
      165
    );

    towerBase.castShadow = true;
    this.townGroup.add(towerBase);

    const towerTop = new THREE.Mesh(
      new THREE.CylinderGeometry(
        10,
        8,
        1.2,
        8
      ),
      roof
    );

    towerTop.position.set(
      -165,
      14.6,
      165
    );

    this.townGroup.add(towerTop);

    // ------------------------------------------------------------
    // SMALL PARK / LANDMARK
    // ------------------------------------------------------------

    const park = new THREE.Mesh(
      new THREE.CircleGeometry(18, 20),
      new THREE.MeshStandardMaterial({
        color: 0x52734d,
        roughness: 1
      })
    );

    park.rotation.x = -Math.PI / 2;
    park.position.set(
      155,
      0.025,
      155
    );

    this.townGroup.add(park);

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;

      const treeX = 155 + Math.cos(angle) * 12;
      const treeZ = 155 + Math.sin(angle) * 12;

      this.createTree(treeX, treeZ);
    }
  }

  // ============================================================
  // ROADS
  // ============================================================

  private createRoadNetwork() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x42474a,
      roughness: 0.9,
    });

    const sidewalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaa79d,
      roughness: 1,
    });

    const roadPositions = [
      { x: 0, z: 0, width: 18, depth: 500 },
      { x: 0, z: 0, width: 500, depth: 18 },
      { x: -105, z: 0, width: 12, depth: 500 },
      { x: 105, z: 0, width: 12, depth: 500 },
      { x: 0, z: -105, width: 500, depth: 12 },
      { x: 0, z: 105, width: 500, depth: 12 },
    ];

    for (const road of roadPositions) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          road.width,
          0.08,
          road.depth
        ),
        roadMaterial
      );

      mesh.position.set(
        road.x,
        0.04,
        road.z
      );

      mesh.receiveShadow = true;

      this.townGroup.add(mesh);

      // Sidewalks
      const sidewalkWidth = 3;

      if (road.width < road.depth) {
        for (const side of [-1, 1]) {
          const sidewalk = new THREE.Mesh(
            new THREE.BoxGeometry(
              sidewalkWidth,
              0.12,
              road.depth
            ),
            sidewalkMaterial
          );

          sidewalk.position.set(
            road.x +
              side *
                (road.width / 2 + sidewalkWidth / 2),
            0.07,
            road.z
          );

          this.townGroup.add(sidewalk);
        }
      } else {
        for (const side of [-1, 1]) {
          const sidewalk = new THREE.Mesh(
            new THREE.BoxGeometry(
              road.width,
              0.12,
              sidewalkWidth
            ),
            sidewalkMaterial
          );

          sidewalk.position.set(
            road.x,
            0.07,
            road.z +
              side *
                (road.depth / 2 + sidewalkWidth / 2)
          );

          this.townGroup.add(sidewalk);
        }
      }
    }

    // Road markings
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0xe4d68b,
    });

    for (let z = -240; z <= 240; z += 16) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.02, 7),
        lineMaterial
      );

      line.position.set(0, 0.11, z);

      this.townGroup.add(line);
    }

    for (let x = -240; x <= 240; x += 16) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(7, 0.02, 0.25),
        lineMaterial
      );

      line.position.set(x, 0.11, 0);

      this.townGroup.add(line);
    }
  }

  // ============================================================
  // TOWN BUILDINGS
  // ============================================================

  private createTown() {
    const locations = [
      [-42, -45],
      [-82, -48],
      [-135, -50],

      [45, -45],
      [82, -48],
      [140, -48],

      [-45, 45],
      [-82, 50],
      [-135, 50],

      [45, 45],
      [82, 50],
      [140, 50],

      [-155, -115],
      [-110, -140],
      [-45, -135],

      [155, -115],
      [110, -140],
      [45, -135],

      [-155, 115],
      [-110, 140],
      [-45, 135],

      [155, 115],
      [110, 140],
      [45, 135],
    ];

    locations.forEach(([x, z], index) => {
      this.createBuilding(
        x,
        z,
        index % 3
      );
    });
  }

  private createBuilding(
    x: number,
    z: number,
    variant: number
  ) {
    const width =
      variant === 0
        ? 18
        : variant === 1
          ? 22
          : 16;

    const depth =
      variant === 0
        ? 16
        : variant === 1
          ? 20
          : 18;

    const floors =
      variant === 1
        ? 3
        : 2;

    const floorHeight = 3.4;
    const totalHeight = floors * floorHeight;

    this.interiorZones.push({
      minX: x - width / 2 + 0.8,
      maxX: x + width / 2 - 0.8,
      minZ: z - depth / 2 + 0.8,
      maxZ: z + depth / 2 - 0.8,
      floorHeight,
      floors
    });

    const colors = [
      0xb77a51,
      0xc69268,
      0x9b664b,
      0xb8a78e,
      0x8f7d68,
    ];

    const wallMaterial =
      new THREE.MeshStandardMaterial({
        color:
          colors[
            Math.floor(Math.random() * colors.length)
          ],
        roughness: 0.95,
      });

    // ============================================================
    // ENTERABLE HOUSE INTERIOR
    // ============================================================

    const wallThickness = 0.6;
    const doorWidth = 2.4;
    const doorHeight = 2.5;

    const addVisualWall = (
      w: number,
      h: number,
      d: number,
      px: number,
      py: number,
      pz: number,
      material: THREE.Material
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material
      );

      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      this.townGroup.add(mesh);
    };

    const addCollider = (
      w: number,
      h: number,
      d: number,
      px: number,
      py: number,
      pz: number
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d)
      );

      mesh.position.set(px, py, pz);

      this.colliders.push(
        new THREE.Box3().setFromObject(mesh)
      );
    };

    const insideWallMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xd7cbb9,
        roughness: 0.95
      });

    const woodMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x4a3024,
        roughness: 0.85
      });

    const floorMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x765d48,
        roughness: 0.95
      });

    const fabricMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x59636a,
        roughness: 0.9
      });

    const metalMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x272b2d,
        metalness: 0.65,
        roughness: 0.4
      });

    // ============================================================
    // OUTER HOUSE WALLS
    // ============================================================

    addVisualWall(
      wallThickness,
      totalHeight,
      depth,
      x - width / 2,
      totalHeight / 2,
      z,
      wallMaterial
    );

    addCollider(
      wallThickness,
      totalHeight,
      depth,
      x - width / 2,
      totalHeight / 2,
      z
    );

    addVisualWall(
      wallThickness,
      totalHeight,
      depth,
      x + width / 2,
      totalHeight / 2,
      z,
      wallMaterial
    );

    addCollider(
      wallThickness,
      totalHeight,
      depth,
      x + width / 2,
      totalHeight / 2,
      z
    );

    addVisualWall(
      width,
      totalHeight,
      wallThickness,
      x,
      totalHeight / 2,
      z + depth / 2,
      wallMaterial
    );

    addCollider(
      width,
      totalHeight,
      wallThickness,
      x,
      totalHeight / 2,
      z + depth / 2
    );

    // ============================================================
    // FRONT WALL + REAL GATE
    // ============================================================

    const frontWidth =
      (width - doorWidth) / 2;

    addVisualWall(
      frontWidth,
      totalHeight,
      wallThickness,
      x - (width + doorWidth) / 4,
      totalHeight / 2,
      z - depth / 2,
      wallMaterial
    );

    addCollider(
      frontWidth,
      totalHeight,
      wallThickness,
      x - (width + doorWidth) / 4,
      totalHeight / 2,
      z - depth / 2
    );

    addVisualWall(
      frontWidth,
      totalHeight,
      wallThickness,
      x + (width + doorWidth) / 4,
      totalHeight / 2,
      z - depth / 2,
      wallMaterial
    );

    addCollider(
      frontWidth,
      totalHeight,
      wallThickness,
      x + (width + doorWidth) / 4,
      totalHeight / 2,
      z - depth / 2
    );

    // Wall above gate.
    const aboveGate =
      totalHeight - doorHeight;

    if (aboveGate > 0) {
      addVisualWall(
        doorWidth,
        aboveGate,
        wallThickness,
        x,
        doorHeight + aboveGate / 2,
        z - depth / 2,
        wallMaterial
      );

      addCollider(
        doorWidth,
        aboveGate,
        wallThickness,
        x,
        doorHeight + aboveGate / 2,
        z - depth / 2
      );
    }

    // Door frame.
    addVisualWall(
      0.16,
      doorHeight,
      0.22,
      x - doorWidth / 2,
      doorHeight / 2,
      z - depth / 2 - 0.12,
      woodMaterial
    );

    addVisualWall(
      0.16,
      doorHeight,
      0.22,
      x + doorWidth / 2,
      doorHeight / 2,
      z - depth / 2 - 0.12,
      woodMaterial
    );

    addVisualWall(
      doorWidth + 0.32,
      0.16,
      0.22,
      x,
      doorHeight,
      z - depth / 2 - 0.12,
      woodMaterial
    );

    // ============================================================
    // FLOOR
    // ============================================================

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(
        width - 1.2,
        0.18,
        depth - 1.2
      ),
      floorMaterial
    );

    floor.position.set(
      x,
      0.09,
      z
    );

    floor.receiveShadow = true;
    this.townGroup.add(floor);

    // ============================================================
    // LIVING ROOM
    // ============================================================

    const sofa = new THREE.Mesh(
      new THREE.BoxGeometry(
        3.5,
        0.7,
        1.25
      ),
      fabricMaterial
    );

    sofa.position.set(
      x - width * 0.18,
      0.55,
      z - depth * 0.25
    );

    this.townGroup.add(sofa);

    const sofaBack = new THREE.Mesh(
      new THREE.BoxGeometry(
        3.5,
        0.95,
        0.3
      ),
      fabricMaterial
    );

    sofaBack.position.set(
      x - width * 0.18,
      1.0,
      z - depth * 0.25 - 0.48
    );

    this.townGroup.add(sofaBack);

    // Coffee table.
    const coffeeTable = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.8,
        0.18,
        1.0
      ),
      woodMaterial
    );

    coffeeTable.position.set(
      x - width * 0.18,
      0.72,
      z + 0.1
    );

    this.townGroup.add(coffeeTable);

    // TV unit.
    const tvUnit = new THREE.Mesh(
      new THREE.BoxGeometry(
        2.8,
        0.6,
        0.5
      ),
      woodMaterial
    );

    tvUnit.position.set(
      x - width * 0.36,
      0.4,
      z + depth * 0.25
    );

    this.townGroup.add(tvUnit);

    const tv = new THREE.Mesh(
      new THREE.BoxGeometry(
        2.0,
        1.15,
        0.12
      ),
      new THREE.MeshStandardMaterial({
        color: 0x111418,
        roughness: 0.25,
        metalness: 0.35
      })
    );

    tv.position.set(
      x - width * 0.36,
      1.25,
      z + depth * 0.25
    );

    this.townGroup.add(tv);

    // ============================================================
    // KITCHEN
    // ============================================================

    const kitchenCounter = new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.42,
        1.0,
        0.7
      ),
      woodMaterial
    );

    kitchenCounter.position.set(
      x + width * 0.24,
      0.5,
      z + depth * 0.36
    );

    this.townGroup.add(kitchenCounter);

    const kitchenTop = new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.44,
        0.12,
        0.76
      ),
      new THREE.MeshStandardMaterial({
        color: 0x9d9688,
        roughness: 0.6
      })
    );

    kitchenTop.position.set(
      x + width * 0.24,
      1.06,
      z + depth * 0.36
    );

    this.townGroup.add(kitchenTop);

    // Refrigerator.
    const fridge = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.0,
        2.2,
        0.9
      ),
      new THREE.MeshStandardMaterial({
        color: 0xb9bbb8,
        metalness: 0.45,
        roughness: 0.3
      })
    );

    fridge.position.set(
      x + width * 0.38,
      1.1,
      z + depth * 0.10
    );

    this.townGroup.add(fridge);

    // ============================================================
    // BEDROOM
    // ============================================================

    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(
        3.0,
        0.5,
        1.7
      ),
      fabricMaterial
    );

    bed.position.set(
      x - width * 0.25,
      0.48,
      z + depth * 0.38
    );

    this.townGroup.add(bed);

    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(
        2.8,
        0.18,
        1.55
      ),
      new THREE.MeshStandardMaterial({
        color: 0xd9d2c4,
        roughness: 0.95
      })
    );

    mattress.position.set(
      x - width * 0.25,
      0.78,
      z + depth * 0.38
    );

    this.townGroup.add(mattress);

    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.9,
        0.18,
        1.1
      ),
      new THREE.MeshStandardMaterial({
        color: 0xf0ebe1,
        roughness: 0.9
      })
    );

    pillow.position.set(
      x - width * 0.25,
      0.97,
      z + depth * 0.62
    );

    this.townGroup.add(pillow);

    // Wardrobe.
    const wardrobe = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.4,
        2.1,
        0.65
      ),
      woodMaterial
    );

    wardrobe.position.set(
      x - width * 0.39,
      1.05,
      z + depth * 0.18
    );

    this.townGroup.add(wardrobe);

    // ============================================================
    // STAIRS
    // ============================================================

    if (floors > 1) {
      const stairX =
        x + width * 0.30;

      const stairStartZ =
        z - depth * 0.28;

      const stairMaterial =
        new THREE.MeshStandardMaterial({
          color: 0x684b38,
          roughness: 0.9
        });

      for (let step = 0; step < 10; step++) {
        const stair = new THREE.Mesh(
          new THREE.BoxGeometry(
            2.8,
            0.20,
            0.72
          ),
          stairMaterial
        );

        stair.position.set(
          stairX,
          0.12 + step * 0.34,
          stairStartZ + step * 0.58
        );

        stair.castShadow = true;
        stair.receiveShadow = true;

        this.townGroup.add(stair);
      }

      // Stair railing.
      const railing = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.12,
          3.3,
          6.0
        ),
        metalMaterial
      );

      railing.position.set(
        stairX - 1.38,
        1.65,
        stairStartZ + 2.6
      );

      this.townGroup.add(railing);

      // Traversal zone used by main.ts.
      this.stairZones.push({
        minX: stairX - 1.55,
        maxX: stairX + 1.55,
        minZ: stairStartZ - 0.5,
        maxZ: stairStartZ + 6.1,
        startY: 0,
        endY: floorHeight
      });

      // ==========================================================
      // SECOND FLOOR
      // ==========================================================

      // ==========================================================
      // SECOND FLOOR WITH REAL STAIRWELL OPENING
      // ==========================================================

      const upperWidth = width - 1.2;
      const upperDepth = depth - 1.2;
      const slabY = floorHeight + 0.08;

      // The staircase passes through this opening.
      const openingWidth = 3.5;
      const openingStartZ = stairStartZ - 0.65;
      const openingEndZ = stairStartZ + 5.75;
      const openingDepth = openingEndZ - openingStartZ;

      const floorMinX = x - upperWidth / 2;
      const floorMaxX = x + upperWidth / 2;
      const floorMinZ = z - upperDepth / 2;
      const floorMaxZ = z + upperDepth / 2;

      const openingMinX = stairX - openingWidth / 2;
      const openingMaxX = stairX + openingWidth / 2;

      const addUpperFloorPiece = (
        pieceWidth: number,
        pieceDepth: number,
        px: number,
        pz: number
      ) => {
        if (pieceWidth <= 0 || pieceDepth <= 0) return;

        const piece = new THREE.Mesh(
          new THREE.BoxGeometry(
            pieceWidth,
            0.16,
            pieceDepth
          ),
          floorMaterial
        );

        piece.position.set(
          px,
          slabY,
          pz
        );

        piece.receiveShadow = true;
        this.townGroup.add(piece);
      };

      // Floor section in front of the stairwell.
      addUpperFloorPiece(
        upperWidth,
        Math.max(0, openingStartZ - floorMinZ),
        x,
        floorMinZ + (openingStartZ - floorMinZ) / 2
      );

      // Floor section behind the stairwell.
      addUpperFloorPiece(
        upperWidth,
        Math.max(0, floorMaxZ - openingEndZ),
        x,
        openingEndZ + (floorMaxZ - openingEndZ) / 2
      );

      // Left side of the stairwell.
      addUpperFloorPiece(
        Math.max(0, openingMinX - floorMinX),
        openingDepth,
        floorMinX + (openingMinX - floorMinX) / 2,
        openingStartZ + openingDepth / 2
      );

      // Right side of the stairwell.
      addUpperFloorPiece(
        Math.max(0, floorMaxX - openingMaxX),
        openingDepth,
        openingMaxX + (floorMaxX - openingMaxX) / 2,
        openingStartZ + openingDepth / 2
      );

      // Small landing at the top of the stairs.
      addUpperFloorPiece(
        openingWidth,
        1.15,
        stairX,
        openingEndZ - 0.35
      );

      // Upper bedroom.
      const upperBed = new THREE.Mesh(
        new THREE.BoxGeometry(
          3.0,
          0.48,
          1.7
        ),
        fabricMaterial
      );

      upperBed.position.set(
        x - width * 0.25,
        floorHeight + 0.34,
        z + depth * 0.22
      );

      this.townGroup.add(upperBed);

      const upperPillow = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.9,
          0.18,
          1.1
        ),
        new THREE.MeshStandardMaterial({
          color: 0xf0ebe1,
          roughness: 0.9
        })
      );

      upperPillow.position.set(
        x - width * 0.25,
        floorHeight + 0.62,
        z + depth * 0.48
      );

      this.townGroup.add(upperPillow);

      // Upper wardrobe.
      const upperWardrobe = new THREE.Mesh(
        new THREE.BoxGeometry(
          1.4,
          2.1,
          0.65
        ),
        woodMaterial
      );

      upperWardrobe.position.set(
        x + width * 0.34,
        floorHeight + 1.05,
        z + depth * 0.25
      );

      this.townGroup.add(upperWardrobe);

      // Upper landing railing.
      const landingRail = new THREE.Mesh(
        new THREE.BoxGeometry(
          width * 0.52,
          0.12,
          0.12
        ),
        metalMaterial
      );

      landingRail.position.set(
        x - width * 0.02,
        floorHeight + 1.05,
        z - depth * 0.12
      );

      this.townGroup.add(landingRail);

      for (let i = 0; i < 7; i++) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.10,
            1.0,
            0.10
          ),
          metalMaterial
        );

        post.position.set(
          x - width * 0.27 + i * width * 0.09,
          floorHeight + 0.52,
          z - depth * 0.12
        );

        this.townGroup.add(post);
      }
    }

    // ============================================================
    // CEILING + LIGHTING
    // ============================================================

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(
        width - 1.2,
        0.18,
        depth - 1.2
      ),
      new THREE.MeshStandardMaterial({
        color: 0xd8d1c4,
        roughness: 1
      })
    );

    ceiling.position.set(
      x,
      totalHeight - 0.08,
      z
    );

    this.townGroup.add(ceiling);

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.22,
        12,
        8
      ),
      new THREE.MeshStandardMaterial({
        color: 0xffe4ae,
        emissive: 0xffad45,
        emissiveIntensity: 1.8
      })
    );

    lamp.position.set(
      x - width * 0.08,
      2.9,
      z - depth * 0.08
    );

    this.townGroup.add(lamp);

    const indoorLight = new THREE.PointLight(
      0xffd19a,
      2.0,
      Math.max(width, depth) * 2
    );

    indoorLight.position.set(
      x - width * 0.08,
      2.5,
      z - depth * 0.08
    );

    this.townGroup.add(indoorLight);

    // ============================================================
    // LOOT — INSIDE THE HOME
    // ============================================================

    this.houseLootSpawns.push(
      new THREE.Vector3(
        x - width * 0.25,
        0,
        z + depth * 0.12
      )
    );

    this.houseLootSpawns.push(
      new THREE.Vector3(
        x + width * 0.25,
        0,
        z + depth * 0.30
      )
    );

    if (floors > 1) {
      this.houseLootSpawns.push(
        new THREE.Vector3(
          x - width * 0.22,
          floorHeight,
          z + depth * 0.22
        )
      );
    }

  }

  // ============================================================
  // WINDOWS
  // ============================================================

  public getInteriorFloorY(
    px: number,
    pz: number,
    currentY: number = 0
  ): number | null {
    // Stairs: interpolate continuously between floors.
    for (const stair of this.stairZones) {
      if (
        px >= stair.minX &&
        px <= stair.maxX &&
        pz >= stair.minZ &&
        pz <= stair.maxZ
      ) {
        const span = stair.maxZ - stair.minZ;
        const t = span !== 0
          ? THREE.MathUtils.clamp(
              (pz - stair.minZ) / span,
              0,
              1
            )
          : 0;

        return THREE.MathUtils.lerp(
          stair.startY,
          stair.endY,
          t
        );
      }
    }

    // Real permanent house floors.
    // Once the player reaches the upper floor, this returns
    // floorHeight everywhere inside that house — not just near loot.
    for (const house of this.interiorZones) {
      if (
        px < house.minX ||
        px > house.maxX ||
        pz < house.minZ ||
        pz > house.maxZ
      ) {
        continue;
      }

      if (
        house.floors > 1 &&
        currentY >= house.floorHeight * 0.5
      ) {
        return house.floorHeight;
      }

      return 0;
    }

    return null;
  }

  private createWindows(
    x: number,
    z: number,
    width: number,
    depth: number,
    floors: number,
    floorHeight: number
  ) {
    const windowMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x9dd4df,
        metalness: 0.15,
        roughness: 0.2,
        emissive: 0x163c48,
        emissiveIntensity: 0.25,
      });

    const frameMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xe3ddd0,
        roughness: 0.8,
      });

    for (let floor = 0; floor < floors; floor++) {
      const y =
        floor * floorHeight +
        floorHeight * 0.62;

      // Front
      for (const wx of [-width * 0.28, width * 0.28]) {
        const window = new THREE.Mesh(
          new THREE.BoxGeometry(
            2.1,
            1.45,
            0.12
          ),
          windowMaterial
        );

        window.position.set(
          x + wx,
          y,
          z - depth / 2 - 0.08
        );

        this.townGroup.add(window);

        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(
            2.45,
            1.75,
            0.08
          ),
          frameMaterial
        );

        frame.position.copy(window.position);
        frame.position.z -= 0.05;

        this.townGroup.add(frame);

        // Put glass back in front of frame
        this.townGroup.add(window);
      }

      // Back
      for (const wx of [-width * 0.28, width * 0.28]) {
        const window = new THREE.Mesh(
          new THREE.BoxGeometry(
            2.1,
            1.45,
            0.12
          ),
          windowMaterial
        );

        window.position.set(
          x + wx,
          y,
          z + depth / 2 + 0.08
        );

        this.townGroup.add(window);
      }

      // Side windows
      for (const side of [-1, 1]) {
        const window = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.12,
            1.45,
            2.1
          ),
          windowMaterial
        );

        window.position.set(
          x + side * (width / 2 + 0.08),
          y,
          z
        );

        this.townGroup.add(window);
      }
    }
  }

  // ============================================================
  // ROOFS
  // ============================================================

  private createRoof(
    x: number,
    z: number,
    width: number,
    depth: number,
    y: number
  ) {
    const roofMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x9b4d2f,
        roughness: 0.9,
      });

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(
        Math.max(width, depth) * 0.72,
        2.5,
        4
      ),
      roofMaterial
    );

    roof.rotation.y = Math.PI / 4;

    roof.scale.z =
      depth / width;

    roof.position.set(
      x,
      y + 1.1,
      z
    );

    roof.castShadow = true;

    this.townGroup.add(roof);
  }

  // ============================================================
  // CONCRETE WALLS
  // ============================================================

    // ============================================================
    // ============================================================
    // ============================================================
    // CONCRETE WALLS
    // ============================================================

  private createWalls() {
    const wallMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x8f8d82,
        roughness: 1,
      });

    const walls = [
      [-30, -28, 35, 0.8],
      [35, -25, 42, 0.8],
      [-38, 28, 28, 0.8],
      [42, 30, 38, 0.8],
      [-100, 18, 30, 0.8],
      [105, -18, 30, 0.8],
    ];

    for (const [x, z, length, thickness] of walls) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(
          length,
          1.6,
          thickness
        ),
        wallMaterial
      );

      wall.position.set(
        x,
        0.8,
        z
      );

      wall.castShadow = true;

      this.townGroup.add(wall);

      this.colliders.push(
        new THREE.Box3().setFromObject(wall)
      );
    }
  }

  // ============================================================
  // TREES
  // ============================================================

  private createTrees() {
    for (let i = 0; i < 100; i++) {
      let x =
        (Math.random() - 0.5) *
        480;

      let z =
        (Math.random() - 0.5) *
        480;

      // Avoid central roads
      if (
        Math.abs(x) < 13 ||
        Math.abs(z) < 13
      ) {
        continue;
      }

      this.createTree(x, z);
    }
  }

  private createTree(
    x: number,
    z: number
  ) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.25,
        0.38,
        2.8,
        8
      ),
      new THREE.MeshStandardMaterial({
        color: 0x63432b,
        roughness: 1,
      })
    );

    trunk.position.set(
      x,
      1.4,
      z
    );

    trunk.castShadow = true;

    this.townGroup.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(
        2.2 + Math.random(),
        10,
        8
      ),
      new THREE.MeshStandardMaterial({
        color: 0x376d38,
        roughness: 1,
      })
    );

    leaves.position.set(
      x,
      4.2,
      z
    );

    leaves.castShadow = true;

    this.townGroup.add(leaves);
  }

  // ============================================================
  // CARS
  // ============================================================

  private createNaturalVegetation() {
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4634,
      roughness: 1
    });

    const leafMaterials = [
      new THREE.MeshStandardMaterial({
        color: 0x3f633c,
        roughness: 1
      }),
      new THREE.MeshStandardMaterial({
        color: 0x52734d,
        roughness: 1
      }),
      new THREE.MeshStandardMaterial({
        color: 0x315537,
        roughness: 1
      })
    ];

    // Irregular vegetation clusters around the island.
    for (let i = 0; i < 110; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 75 + Math.random() * 165;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Keep the main roads/town center relatively open.
      if (
        Math.abs(x) < 55 &&
        Math.abs(z) < 70
      ) {
        continue;
      }

      const tree = new THREE.Group();

      const trunkHeight =
        2.4 + Math.random() * 2.2;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.18,
          0.32,
          trunkHeight,
          7
        ),
        trunkMaterial
      );

      trunk.position.y = trunkHeight / 2;
      tree.add(trunk);

      const canopy = new THREE.Mesh(
        new THREE.DodecahedronGeometry(
          1.8 + Math.random() * 1.5,
          1
        ),
        leafMaterials[
          Math.floor(Math.random() * leafMaterials.length)
        ]
      );

      canopy.position.y =
        trunkHeight + 1.1 + Math.random() * 0.7;

      canopy.scale.set(
        0.9 + Math.random() * 0.35,
        1.0 + Math.random() * 0.45,
        0.9 + Math.random() * 0.35
      );

      tree.add(canopy);

      tree.position.set(
        x,
        0,
        z
      );

      tree.rotation.y =
        Math.random() * Math.PI * 2;

      tree.scale.setScalar(
        0.8 + Math.random() * 0.7
      );

      this.townGroup.add(tree);
    }

    // Low bushes fill the gaps between larger trees.
    const bushMaterial = new THREE.MeshStandardMaterial({
      color: 0x46663f,
      roughness: 1
    });

    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 65 + Math.random() * 170;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (
        Math.abs(x) < 48 &&
        Math.abs(z) < 62
      ) {
        continue;
      }

      const bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(
          0.7 + Math.random() * 0.8,
          1
        ),
        bushMaterial
      );

      bush.position.set(
        x,
        0.65,
        z
      );

      bush.scale.y =
        0.65 + Math.random() * 0.45;

      bush.rotation.y =
        Math.random() * Math.PI * 2;

      this.townGroup.add(bush);
    }
  }

  private createRoadsideDetails() {
    const dirtMaterial = new THREE.MeshStandardMaterial({
      color: 0x756349,
      roughness: 1
    });

    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0x625849,
      roughness: 1
    });

    // Roadside dirt shoulders.
    const shoulders = [
      [0, -10, 500, 3],
      [0, 10, 500, 3],
      [-10, 0, 3, 500],
      [10, 0, 3, 500],
      [-105, -9, 210, 2.5],
      [-105, 9, 210, 2.5],
      [105, -9, 210, 2.5],
      [105, 9, 210, 2.5]
    ];

    for (const [x, z, width, depth] of shoulders) {
      const shoulder = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        dirtMaterial
      );

      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(x, 0.025, z);

      this.townGroup.add(shoulder);
    }

    // Irregular roadside marker posts.
    const roads = [
      [-105, -150, 0],
      [-105, -70, 0],
      [-105, 35, 0],
      [-105, 115, 0],
      [0, -150, 0],
      [0, -70, 0],
      [0, 35, 0],
      [0, 115, 0],
      [105, -150, 0],
      [105, -70, 0],
      [105, 35, 0],
      [105, 115, 0]
    ];

    for (let i = 0; i < roads.length; i++) {
      const [x, z] = roads[i];

      const offset =
        i % 2 === 0 ? -7 : 7;

      const post = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.18,
          1.1,
          0.18
        ),
        postMaterial
      );

      post.position.set(
        x + offset,
        0.55,
        z + ((i % 3) - 1) * 2
      );

      post.rotation.y =
        (Math.random() - 0.5) * 0.18;

      this.townGroup.add(post);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.3,
          0.12,
          0.3
        ),
        new THREE.MeshStandardMaterial({
          color: 0xc8b98c,
          roughness: 0.9
        })
      );

      cap.position.set(
        post.position.x,
        1.12,
        post.position.z
      );

      this.townGroup.add(cap);
    }

    // Small gravel pull-offs near the settlement edges.
    const pullOffs = [
      [-63, -61, 0.25],
      [62, -62, -0.2],
      [-62, 63, -0.15],
      [62, 64, 0.2],
      [132, -64, 0.15],
      [-132, 64, -0.2]
    ];

    for (const [x, z, rotation] of pullOffs) {
      const pullOff = new THREE.Mesh(
        new THREE.CircleGeometry(7, 14),
        dirtMaterial
      );

      pullOff.rotation.x = -Math.PI / 2;
      pullOff.rotation.z = rotation;
      pullOff.position.set(x, 0.035, z);
      pullOff.scale.set(1.5, 0.65, 1);

      this.townGroup.add(pullOff);
    }
  }

  private createHouseExteriorDetails() {
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x714536,
      roughness: 0.9
    });

    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0xb7a58b,
      roughness: 0.85
    });

    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x4b5052,
      metalness: 0.35,
      roughness: 0.7
    });

    const homes = [
      [-42, -45, 18, 16],
      [-82, -48, 22, 20],
      [-135, -50, 16, 18],
      [45, -45, 18, 16],
      [82, -48, 22, 20],
      [140, -48, 16, 18],
      [-45, 45, 18, 16],
      [-82, 50, 22, 20],
      [-135, 50, 16, 18],
      [45, 45, 18, 16],
      [82, 50, 22, 20],
      [140, 50, 16, 18]
    ];

    for (let i = 0; i < homes.length; i++) {
      const [x, z, width, depth] = homes[i];

      const floors =
        i % 3 === 1 ? 3 : 2;

      const roofY =
        floors * 3.4 + 0.25;

      // Low-pitched roof slab.
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(
          width + 1.4,
          0.45,
          depth + 1.4
        ),
        roofMaterial
      );

      roof.position.set(
        x,
        roofY,
        z
      );

      roof.rotation.y =
        (i % 2 === 0 ? -1 : 1) * 0.025;

      roof.castShadow = true;
      this.townGroup.add(roof);

      // Front awning.
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.min(width * 0.55, 8),
          0.22,
          2.0
        ),
        trimMaterial
      );

      awning.position.set(
        x,
        2.7,
        z - depth / 2 - 0.9
      );

      awning.rotation.x = -0.08;
      this.townGroup.add(awning);

      // Exterior steps.
      for (let step = 0; step < 3; step++) {
        const stair = new THREE.Mesh(
          new THREE.BoxGeometry(
            2.8 - step * 0.25,
            0.18,
            0.65
          ),
          trimMaterial
        );

        stair.position.set(
          x,
          0.09 + step * 0.18,
          z - depth / 2 - 1.0 + step * 0.45
        );

        this.townGroup.add(stair);
      }

      // Chimney.
      if (i % 3 !== 2) {
        const chimney = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.9,
            1.8,
            0.9
          ),
          trimMaterial
        );

        chimney.position.set(
          x + width * 0.25,
          roofY + 0.8,
          z + depth * 0.18
        );

        this.townGroup.add(chimney);

        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(
            1.1,
            0.18,
            1.1
          ),
          metalMaterial
        );

        cap.position.set(
          chimney.position.x,
          roofY + 1.72,
          chimney.position.z
        );

        this.townGroup.add(cap);
      }

      // Rooftop AC unit.
      if (i % 2 === 0) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(
            1.8,
            0.8,
            1.4
          ),
          metalMaterial
        );

        ac.position.set(
          x - width * 0.25,
          roofY + 0.45,
          z - depth * 0.15
        );

        this.townGroup.add(ac);

        const fan = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.38,
            0.38,
            0.08,
            12
          ),
          trimMaterial
        );

        fan.position.set(
          ac.position.x,
          ac.position.y + 0.45,
          ac.position.z
        );

        this.townGroup.add(fan);
      }
    }
  }


  private createHouseWindows() {
    const houses = [
      [-42,-45],[-82,-48],[-135,-50],
      [45,-45],[82,-48],[140,-48],
      [-45,45],[-82,50],[-135,50],
      [45,45],[82,50],[140,50],
      [-155,-115],[-110,-140],[-45,-135],
      [155,-115],[110,-140],[45,-135],
      [-155,115],[-110,140],[-45,135],
      [155,115],[110,140],[45,135]
    ];

    const glass = new THREE.MeshStandardMaterial({
      color: 0x8fc7d8,
      roughness: 0.18,
      metalness: 0.08,
      emissive: 0x102c35,
      emissiveIntensity: 0.35
    });

    const frame = new THREE.MeshStandardMaterial({
      color: 0x30363a,
      roughness: 0.8
    });

    const warmInterior = new THREE.MeshStandardMaterial({
      color: 0xffd58a,
      emissive: 0xffa63d,
      emissiveIntensity: 0.65,
      roughness: 0.5
    });

    for (const [x, z] of houses) {
      const variant = Math.abs(x + z) % 3;
      const width = variant === 1 ? 22 : variant === 2 ? 16 : 18;
      const depth = variant === 1 ? 20 : variant === 2 ? 18 : 16;
      // Houses have two visible exterior window levels.
      // Prevent a third window row from appearing above the roof.
      const floors = 2;
      const floorHeight = 3.4;

      const addWindow = (
        wx: number,
        wy: number,
        wz: number,
        sx: number,
        sy: number,
        sz: number
      ) => {
        const glassPane = new THREE.Mesh(
          new THREE.BoxGeometry(sx, sy, sz),
          glass
        );

        const glow = new THREE.Mesh(
          new THREE.BoxGeometry(
            Math.max(0.18, sx * 0.72),
            Math.max(0.18, sy * 0.68),
            Math.max(0.04, sz * 0.5)
          ),
          warmInterior
        );
        glow.position.set(
          wx,
          wy,
          wz + (sz <= 0.2 ? -0.035 : 0)
        );
        this.townGroup.add(glow);
        glassPane.position.set(wx, wy, wz);
        glassPane.castShadow = true;
        this.townGroup.add(glassPane);

        const vertical = new THREE.Mesh(
          new THREE.BoxGeometry(
            sz > sx ? 0.10 : 0.10,
            sy + 0.16,
            sz > sx ? sz + 0.08 : 0.10
          ),
          frame
        );
        vertical.position.set(wx, wy, wz);
        this.townGroup.add(vertical);

        const horizontal = new THREE.Mesh(
          new THREE.BoxGeometry(
            sx + 0.16,
            0.10,
            sz + 0.16
          ),
          frame
        );
        horizontal.position.set(wx, wy, wz);
        this.townGroup.add(horizontal);

        // Window center crossbars
        const windowDivider = new THREE.MeshStandardMaterial({
          color: 0x252a2d,
          roughness: 0.75
        });

        const vBar = new THREE.Mesh(
          new THREE.BoxGeometry(
            sz > sx ? 0.06 : 0.06,
            sy - 0.12,
            sz > sx ? sz + 0.02 : 0.06
          ),
          windowDivider
        );
        vBar.position.set(wx, wy, wz);
        this.townGroup.add(vBar);

        const hBar = new THREE.Mesh(
          new THREE.BoxGeometry(
            sx + 0.02,
            0.06,
            sz > sx ? sz + 0.02 : 0.06
          ),
          windowDivider
        );
        hBar.position.set(wx, wy, wz);
        this.townGroup.add(hBar);

        // Four-pane window divider
        const verticalDivider = new THREE.Mesh(
          new THREE.BoxGeometry(
            sz > sx ? 0.07 : 0.07,
            sy - 0.08,
            sz > sx ? sz + 0.02 : 0.07
          ),
          frame
        );
        verticalDivider.position.set(wx, wy, wz);
        this.townGroup.add(verticalDivider);

        const horizontalDivider = new THREE.Mesh(
          new THREE.BoxGeometry(
            sx + 0.02,
            0.07,
            sz > sx ? sz + 0.02 : 0.07
          ),
          frame
        );
        horizontalDivider.position.set(wx, wy, wz);
        this.townGroup.add(horizontalDivider);

        // Small curtain panels
        const curtain = new THREE.MeshStandardMaterial({
          color: 0xe7dfcf,
          roughness: 0.9
        });

        const curtainWidth = Math.max(0.25, sx * 0.18);
        const curtainHeight = sy * 0.82;

        if (sz <= sx) {
          const leftCurtain = new THREE.Mesh(
            new THREE.BoxGeometry(curtainWidth, curtainHeight, 0.035),
            curtain
          );
          leftCurtain.position.set(
            wx - sx * 0.38,
            wy,
            wz - 0.065
          );
          this.townGroup.add(leftCurtain);

          const rightCurtain = leftCurtain.clone();
          rightCurtain.position.x = wx + sx * 0.38;
          this.townGroup.add(rightCurtain);
        } else {
          const leftCurtain = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, curtainHeight, curtainWidth),
            curtain
          );
          leftCurtain.position.set(
            wx - 0.065,
            wy,
            wz - sz * 0.38
          );
          this.townGroup.add(leftCurtain);

          const rightCurtain = leftCurtain.clone();
          rightCurtain.position.z = wz + sz * 0.38;
          this.townGroup.add(rightCurtain);
        }
      };

      // Front / back windows
      for (let floor = 0; floor < floors; floor++) {
        const y = 1.85 + floor * floorHeight;

        addWindow(
          x - width * 0.24,
          y,
          z - depth / 2 - 0.01,
          2.7, 1.9, 0.10
        );

        addWindow(
          x + width * 0.24,
          y,
          z - depth / 2 - 0.01,
          2.7, 1.9, 0.10
        );

        // Rear windows
        addWindow(
          x - width * 0.24,
          y,
          z + depth / 2 + 0.01,
          2.7, 1.9, 0.10
        );
      }

      // Side windows
    }
  }

  private createHouseDoors() {
    const houses = [
      [-42,-45],[-82,-48],[-135,-50],
      [45,-45],[82,-48],[140,-48],
      [-45,45],[-82,50],[-135,50],
      [45,45],[82,50],[140,50],
      [-155,-115],[-110,-140],[-45,-135],
      [155,-115],[110,-140],[45,-135],
      [-155,115],[-110,140],[-45,135],
      [155,115],[110,140],[45,135]
    ];

    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x554238,
      roughness: 0.72
    });

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3032,
      roughness: 0.8
    });

    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8a36a,
      metalness: 0.7,
      roughness: 0.3
    });

    for (const [x, z] of houses) {
      const variant = Math.abs(x + z) % 3;
      const width = variant === 1 ? 22 : variant === 2 ? 16 : 18;
      const depth = variant === 1 ? 20 : variant === 2 ? 18 : 16;

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 3.0, 0.14),
        doorMaterial
      );
      door.position.set(
        x,
        1.5,
        z - depth / 2 - 0.10
      );
      door.castShadow = true;
      this.townGroup.add(door);

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 3.35, 0.18),
        frameMaterial
      );
      frame.position.set(
        x,
        1.67,
        z - depth / 2 - 0.04
      );
      this.townGroup.add(frame);

      // Put the door slightly in front of the frame.
      door.position.z -= 0.09;

      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 8),
        handleMaterial
      );
      handle.position.set(
        x + 0.48,
        1.45,
        z - depth / 2 - 0.25
      );
      this.townGroup.add(handle);

      // Entry step
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.22, 0.85),
        new THREE.MeshStandardMaterial({
          color: 0x77736b,
          roughness: 1
        })
      );
      step.position.set(
        x,
        0.11,
        z - depth / 2 - 0.48
      );
      step.castShadow = true;
      this.townGroup.add(step);

      // Small overhead entrance canopy
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(3.0, 0.18, 1.15),
        new THREE.MeshStandardMaterial({
          color: 0x4d5150,
          roughness: 0.85
        })
      );
      canopy.position.set(
        x,
        3.25,
        z - depth / 2 - 0.48
      );
      canopy.rotation.x = -0.08;
      this.townGroup.add(canopy);
    }
  }

  private createCars() {
    const positions = [
      [-18, 20, 0.1],
      [20, -20, Math.PI],
      [-75, 12, Math.PI / 2],
      [75, -12, -Math.PI / 2],
      [-155, 0, Math.PI / 2],
      [155, 8, -Math.PI / 2],
    ];

    for (const [x, z, rotation] of positions) {
      this.createCar(
        x,
        z,
        rotation
      );
    }
  }

  private createCar(
    x: number,
    z: number,
    rotation: number
  ) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(
        4.2,
        1.1,
        2
      ),
      new THREE.MeshStandardMaterial({
        color: 0x6f665b,
        roughness: 0.8,
      })
    );

    body.position.y = 0.8;

    group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(
        2.3,
        1.0,
        1.7
      ),
      new THREE.MeshStandardMaterial({
        color: 0x39444b,
        roughness: 0.5,
        metalness: 0.2,
      })
    );

    cabin.position.set(
      -0.2,
      1.55,
      0
    );

    group.add(cabin);

    const wheelMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x151515,
        roughness: 1,
      });

    for (const wx of [-1.35, 1.35]) {
      for (const wz of [-1.05, 1.05]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.48,
            0.48,
            0.3,
            12
          ),
          wheelMaterial
        );

        wheel.rotation.z = Math.PI / 2;

        wheel.position.set(
          wx,
          0.48,
          wz
        );

        group.add(wheel);
      }
    }

    group.position.set(
      x,
      0,
      z
    );

    group.rotation.y = rotation;

    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
      }
    });

    this.townGroup.add(group);
  }

  // ============================================================
  // STREET LIGHTS
  // ============================================================

  private createStreetLights() {
    const positions = [
      [-12, -55],
      [12, -55],
      [-12, 55],
      [12, 55],
      [-55, -12],
      [-55, 12],
      [55, -12],
      [55, 12],
    ];

    for (const [x, z] of positions) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.08,
          0.12,
          5,
          8
        ),
        new THREE.MeshStandardMaterial({
          color: 0x45494a,
          metalness: 0.7,
          roughness: 0.4,
        })
      );

      pole.position.set(
        x,
        2.5,
        z
      );

      this.townGroup.add(pole);

      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.18,
          8,
          8
        ),
        new THREE.MeshStandardMaterial({
          color: 0xffe5ad,
          emissive: 0xffb347,
          emissiveIntensity: 2,
        })
      );

      lamp.position.set(
        x,
        5,
        z
      );

      this.townGroup.add(lamp);
    }
  }

  // ============================================================
  // COMMUNICATION TOWER
  // ============================================================

  private createTower() {
    const group = new THREE.Group();

    const metal =
      new THREE.MeshStandardMaterial({
        color: 0x555e62,
        metalness: 0.8,
        roughness: 0.45,
      });

    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(
        1.2,
        2.2,
        35,
        6,
        1,
        true
      ),
      metal
    );

    tower.position.y = 17.5;

    group.add(tower);

    for (let y = 6; y < 34; y += 5) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
          1.5 - y * 0.018,
          0.07,
          6,
          12
        ),
        metal
      );

      ring.position.y = y;

      group.add(ring);
    }

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.08,
        0.08,
        8,
        6
      ),
      metal
    );

    antenna.position.y = 39;

    group.add(antenna);

    group.position.set(
      0,
      0,
      -170
    );

    this.townGroup.add(group);
  }

  // ============================================================
  // MOUNTAINS
  // ============================================================

  // ============================================================
  // OUTER TERRAIN HILLS
  // ============================================================

  private createOuterHills() {
    const hillMaterial = new THREE.MeshStandardMaterial({
      color: 0x59664b,
      roughness: 1
    });

    const hills = [
      [-205, -155, 42, 18],
      [-115, -185, 55, 22],
      [20, -190, 48, 20],
      [150, -175, 55, 24],
      [205, -95, 38, 18],
      [205, 40, 46, 20],
      [185, 150, 58, 25],
      [70, 190, 48, 20],
      [-65, 190, 58, 24],
      [-190, 145, 48, 21],
      [-210, 40, 38, 18]
    ];

    for (const [x, z, radius, height] of hills) {
      const hill = new THREE.Mesh(
        new THREE.CylinderGeometry(
          radius * 0.55,
          radius,
          height,
          20
        ),
        hillMaterial
      );

      hill.position.set(x, height / 2 - 0.1, z);
      hill.scale.z = 0.75;
      hill.receiveShadow = true;
      hill.castShadow = true;

      this.townGroup.add(hill);
    }
  }

  // ============================================================
  // CENTRAL COMMS COMPOUND
  // ============================================================

  private createCommsCompound() {
    const concrete = new THREE.MeshStandardMaterial({
      color: 0x777b78,
      roughness: 0.92
    });

    const metal = new THREE.MeshStandardMaterial({
      color: 0x3b4148,
      metalness: 0.65,
      roughness: 0.38
    });

    // Raised concrete equipment pad.
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.8, 24),
      concrete
    );

    pad.position.set(0, 0.4, 120);
    pad.receiveShadow = true;
    this.townGroup.add(pad);

    // Main communications mast.
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.3, 24, 12),
      metal
    );

    mast.position.set(0, 12.8, 120);
    mast.castShadow = true;
    this.townGroup.add(mast);

    // Mast platform.
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.45, 12),
      metal
    );

    platform.position.set(0, 8.5, 120);
    this.townGroup.add(platform);

    // Satellite dishes.
    for (const [dx, dz, rotation] of [
      [-7, 120, -0.35],
      [7, 120, 0.35]
    ]) {
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        concrete
      );

      dish.position.set(dx, 3.8, dz);
      dish.rotation.z = rotation;
      this.townGroup.add(dish);

      const dishPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, 3, 8),
        metal
      );

      dishPole.position.set(dx, 2, dz);
      this.townGroup.add(dishPole);
    }

    // Control cabinet.
    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(5, 3.5, 4),
      metal
    );

    cabinet.position.set(0, 2.15, 112);
    cabinet.castShadow = true;
    this.townGroup.add(cabinet);

    // Cable conduits.
    for (const x of [-2, 0, 2]) {
      const conduit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 8, 8),
        metal
      );

      conduit.position.set(x, 4.3, 112);
      conduit.rotation.z = Math.PI / 2;
      this.townGroup.add(conduit);
    }

    // Concrete perimeter barriers.
    for (const [x, z, rotation] of [
      [-12, 110, 0],
      [12, 110, 0],
      [-12, 130, 0],
      [12, 130, 0]
    ]) {
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(5, 1.2, 1.1),
        concrete
      );

      barrier.position.set(x, 1, z);
      barrier.rotation.y = rotation;
      this.townGroup.add(barrier);
    }

    // Equipment crates.
    for (const [x, z] of [
      [-7, 112],
      [7, 112],
      [-8, 127],
      [8, 127]
    ]) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.2, 2.4),
        new THREE.MeshStandardMaterial({
          color: 0x80623d,
          roughness: 1
        })
      );

      crate.position.set(x, 1.1, z);
      this.townGroup.add(crate);
    }

    // Perimeter warning lights.
    for (const [x, z] of [
      [-10, 110],
      [10, 110],
      [-10, 130],
      [10, 130]
    ]) {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff5533,
          emissive: 0xff2200,
          emissiveIntensity: 2
        })
      );

      light.position.set(x, 2.2, z);
      this.townGroup.add(light);
    }
  }

  private createMountains() {
    const mountainMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x66745f,
        roughness: 1,
      });

    const positions = [
      [-210, -220, 90],
      [-100, -240, 110],
      [30, -250, 100],
      [160, -230, 120],
      [230, -150, 100],
      [-240, 20, 100],
      [-245, 170, 110],
      [240, 80, 120],
      [190, 220, 100],
      [0, 240, 110],
      [-150, 220, 100],
    ];

    for (const [x, z, size] of positions) {
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(
          size,
          size * 1.8,
          7
        ),
        mountainMaterial
      );

      mountain.position.set(
        x,
        size * 0.45 - 5,
        z
      );

      mountain.rotation.y =
        Math.random() * Math.PI;

      this.townGroup.add(mountain);
    }
  }
}
