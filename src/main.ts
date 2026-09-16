import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./style.css";

import { BattleMap } from "./map/battleMap";
import { SafeZone } from "./battle/zone";
import { LootItem, LootType } from "./loot/item";
import { Deployment } from "./deployment/deployment";

type GameState =
  | "LOBBY"
  | "MATCHMAKING"
  | "LOADING"
  | "DEPLOYMENT"
  | "BATTLE"
  | "RESULTS";

const gltfLoader = new GLTFLoader();
let pistolGLB: THREE.Group | null = null;
let rifleGLB: THREE.Group | null = null;
let playerGLB: THREE.Group | null = null;

gltfLoader.load(
  "/assets/glb/human/player.glb",
  (gltf) => {
    playerGLB = gltf.scene;
    playerGLB.visible = false;

    playerGLB.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    scene.add(playerGLB);

    if (player) {
      const oldChildren = [...player.children];

      for (const child of oldChildren) {
        player.remove(child);
      }

      const model = playerGLB.clone(true);
      model.name = "LOCAL_PLAYER_MODEL";

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const height = Math.max(size.y, 0.01);

      model.scale.setScalar(0.8 / height);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

      model.position.x -= scaledCenter.x;
      model.position.z -= scaledCenter.z;
      model.position.y -= scaledBox.min.y;

      model.traverse((object) => {
        object.visible = true;

        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          object.frustumCulled = false;
        }
      });

      player.add(model);
    }

    console.log("PLAYER GLB LOADED");
  },
  undefined,
  (error) => {
    console.error("PLAYER GLB LOAD FAILED:", error);
  }
);

gltfLoader.load(
  "/weapons/models/rifle.glb",
  (gltf) => {
    rifleGLB = gltf.scene;
    rifleGLB.visible = false;

    rifleGLB.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    scene.add(rifleGLB);

    console.log("RIFLE GLB LOADED");
  },
  undefined,
  (error) => {
    console.error("RIFLE GLB LOAD FAILED:", error);
  }
);

gltfLoader.load(
  "/weapons/models/pistol.glb",
  (gltf) => {
    pistolGLB = gltf.scene;
    pistolGLB.visible = false;

    pistolGLB.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    scene.add(pistolGLB);

    console.log("PISTOL GLB LOADED");
  },
  undefined,
  (error) => {
    console.error("PISTOL GLB LOAD FAILED:", error);
  }
);

type NetworkPlayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  deploymentState: "PLANE" | "FALLING" | "PARACHUTE" | "LANDED";
  health: number;
  armor: number;
  kills: number;
};

let multiplayerSocket: WebSocket | null = null;
let networkPlayerId = "";
const networkPlayers = new Map<string, NetworkPlayer>();

type RemotePlayerVisual = {
  group: THREE.Group;
  targetPosition: THREE.Vector3;
  targetYaw: number;
};

const remotePlayerVisuals = new Map<string, RemotePlayerVisual>();

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x79bde8);
scene.fog = new THREE.Fog(0x79bde8, 180, 520);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 8, 12);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

const remoteDebug = document.createElement("div");
remoteDebug.id = "remoteDebug";
remoteDebug.textContent = "REMOTE: 0 | NETWORK: 0";
remoteDebug.style.position = "fixed";
remoteDebug.style.top = "72px";
remoteDebug.style.left = "20px";
remoteDebug.style.zIndex = "99999";
remoteDebug.style.padding = "8px 12px";
remoteDebug.style.background = "rgba(0,0,0,.75)";
remoteDebug.style.color = "#00ffff";
remoteDebug.style.font = "12px monospace";
remoteDebug.style.pointerEvents = "none";
document.body.appendChild(remoteDebug);

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

renderer.domElement.addEventListener("mousedown", (event) => {
  if (
    state === "BATTLE" &&
    event.button === 2
  ) {
    isAiming = true;
  }
});

renderer.domElement.addEventListener("mouseup", (event) => {
  if (event.button === 2) {
    isAiming = false;
  }
});

renderer.domElement.addEventListener("mousedown", (event) => {
  if (
    state === "BATTLE" &&
    event.button === 0
  ) {
    isShooting = true;
    shoot();
  }
});

renderer.domElement.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    isShooting = false;
  }
});

document.addEventListener("pointerlockchange", () => {
  const locked =
    document.pointerLockElement === renderer.domElement;

  document.body.classList.toggle(
    "gameMouseLocked",
    locked
  );
});

document.addEventListener("pointerlockerror", () => {
  console.warn("NEXUS: Pointer Lock was blocked by the browser.");
});

/* =========================================================
   LIGHTING
========================================================= */

const hemisphereLight = new THREE.HemisphereLight(
  0xbfe8ff,
  0x526044,
  2.1
);

scene.add(hemisphereLight);

const sun = new THREE.DirectionalLight(
  0xffffff,
  2.5
);

sun.position.set(120, 180, 80);
sun.castShadow = true;

sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;

scene.add(sun);

/* =========================================================
   GAME VARIABLES
========================================================= */

let state: GameState = "LOBBY";

let battleMap: BattleMap | null = new BattleMap(scene);
let safeZone: SafeZone | null = null;
let deployment: Deployment | null = null;

let player: THREE.Group | null = null;
let fpsWeapon: THREE.Group | null = null;

let playerHealth = 100;
let playerArmor = 50;

let alivePlayers = 50;
let kills = 0;
let matchDamage = 0;
let matchStartTime = 0;

let ammo = 0;
let medkits = 0;

const WEAPON_CONFIG = {
  RIFLE: {
    damage: 25,
    fireRate: 110,
    magazine: 30,
    reserve: 120,
    pellets: 1,
    spread: 0.006,
    color: 0x20252b
  },
  SMG: {
    damage: 16,
    fireRate: 70,
    magazine: 40,
    reserve: 160,
    pellets: 1,
    spread: 0.018,
    color: 0x182027
  },
  SHOTGUN: {
    damage: 14,
    fireRate: 700,
    magazine: 6,
    reserve: 36,
    pellets: 8,
    spread: 0.075,
    color: 0x29251f
  },
  PISTOL: {
    damage: 30,
    fireRate: 260,
    magazine: 12,
    reserve: 72,
    pellets: 1,
    spread: 0.012,
    color: 0x15171a
  }
} as const;

function getWeaponConfig() {
  if (currentWeapon === "NONE") return null;
  return WEAPON_CONFIG[currentWeapon];
}

type WeaponName = keyof typeof WEAPON_CONFIG | "NONE";

let currentWeapon: WeaponName = "NONE";

const enemies: THREE.Group[] = [];

const enemyAttackCooldown = new Map<THREE.Group, number>();
const enemyMoveSpeed = 2.2;
const enemyAttackRange = 18;
const enemyAttackDamage = 3;
const enemyAttackRate = 1800;

type LootWeapon =
  | "RIFLE"
  | "SMG"
  | "SHOTGUN"
  | "PISTOL";

interface WorldLoot {
  object: THREE.Group;
  weapon: LootWeapon;
  ammo: number;
  picked: boolean;
}

const worldLoot: WorldLoot[] = [];


const activeBullets: THREE.Mesh[] = [];
const bulletDirections = new Map<THREE.Mesh, THREE.Vector3>();
const BULLET_SPEED = 140;
const BULLET_LIFE = 1.2;
const ENEMY_HEALTH = 100;


let isShooting = false;
let isAiming = false;
let isReloading = false;
let lastShotTime = 0;
let weaponRecoil = 0;
let weaponRecoilSide = 0;
let muzzleFlashTime = 0;

const MAGAZINE_SIZE = 30;
const FIRE_RATE = 110;
const RELOAD_TIME = 1400;

ammo = MAGAZINE_SIZE;

let yaw = 0;
let pitch = -0.15;

const keys = new Set<string>();

/* =========================================================
   UI HELPER
========================================================= */

function makeElement(
  tag: string,
  className: string,
  text = ""
): HTMLElement {
  const element =
    document.createElement(tag);

  element.className = className;
  element.textContent = text;

  return element;
}

/* =========================================================
   LOBBY UI
========================================================= */

const lobbyUI =
  makeElement(
    "div",
    "gameUI lobbyUI"
  );

lobbyUI.innerHTML = `
  <!-- TOP NAVIGATION -->
  <div class="nexusNav">

    <div class="nexusLogo">
      <div>NEXUS</div>
      <span>BATTLE CITY</span>
    </div>

    <div class="navTabs">
      <button class="navTab active" data-panel="play">PLAY</button>
      <button class="navTab" data-panel="inventory">INVENTORY</button>
      <button class="navTab" data-panel="missions">MISSIONS</button>
      <button class="navTab" data-panel="character">CHARACTER</button>
      <button class="navTab" data-panel="armory">ARMORY</button>
      <button class="navTab" data-panel="store">STORE</button>
      <button class="navTab" data-panel="settings">SETTINGS</button>
    </div>

    <div class="playerProfile">
      <div class="profileAvatar">K</div>
      <div class="profileInfo">
        <strong>👑 KING</strong>
        <span>LEVEL 12</span>
      </div>
      <div class="levelBar">
        <i></i>
      </div>
      <b class="profileArrow">›</b>
    </div>

  </div>

  <!-- CURRENCY -->
  <div class="currencyBar">
    <span>🪙 2,450</span>
    <span>💎 120</span>
    <b>＋</b>
    <span>♟</span>
    <span>✉</span>
    <span>⚙</span>
  </div>

  <!-- LEFT PANELS -->
  <aside class="lobbyLeft">

    <div class="lobbyPanel seasonPanel">
      <div class="panelTitle">SEASON 1</div>
      <div class="panelAccent">RISE TO GLORY</div>

      <div class="seasonBadge">◆</div>

      <div class="levelText">
        LV. 12
        <span>350 / 1000</span>
      </div>

      <div class="progressBar">
        <i></i>
      </div>

      <div class="panelArrow">›</div>
    </div>

    <div class="lobbyPanel missionsPanel">
      <div class="panelHeader">
        <strong>DAILY MISSIONS</strong>
        <span>3/3</span>
      </div>

      <div class="mission">
        <b>✓</b>
        <span>Play 3 matches</span>
        <small>1/3</small>
      </div>

      <div class="mission">
        <b>✓</b>
        <span>Get 5 kills</span>
        <small>0/5</small>
      </div>

      <div class="mission">
        <b>✓</b>
        <span>Survive for 20 minutes</span>
        <small>0/20</small>
      </div>

      <div class="panelFooter">
        VIEW ALL MISSIONS <b>›</b>
      </div>
    </div>

    <div class="lobbyPanel weaponPromo">
      <div class="weaponGraphic">▰</div>
      <strong>NEW WEAPONS</strong>
      <span>IN BATTLE CITY</span>
      <button class="newWeaponsMapButton" id="newWeaponsMapButton" type="button">›</button>
    </div>

    <div class="battleModePanel">

      <div class="battleModeHeader">
        <div>
          <strong>BATTLE ROYALE</strong>
          <span id="battleRoyaleMapName">BATTLE CITY</span></span>
        </div>
        <b>›</b>
      </div>

      <div class="modeRow">
        <button class="modeButton active" data-mode="SOLO">SOLO</button>
        <button class="modeButton" data-mode="DUO">DUO</button>
        <button class="modeButton" data-mode="SQUAD">SQUAD</button>
      </div>

      <button class="playButton">START</button>

    </div>

  </aside>

  <!-- RIGHT PANELS -->
  <aside class="lobbyRight">

    <div class="nextBattlePanel">
      <div>
        <strong>THE NEXT<br>BATTLE<br>AWAITS</strong>
      </div>
      <b>›</b>
    </div>

    <button class="sideMenuButton" data-panel="events">
      <span>▣</span> EVENTS <b>›</b>
    </button>

    <button class="sideMenuButton" data-panel="leaderboard">
      <span>▥</span> LEADERBOARD <b>›</b>
    </button>

    <button class="sideMenuButton" data-panel="achievements">
      <span>♜</span> ACHIEVEMENTS <b>›</b>
    </button>

    <button class="sideMenuButton battlePassButton" data-panel="battle-pass">
      <span>◆</span> BATTLE PASS <b>›</b>
    </button>

    <div class="communityPanel">
      <strong>JOIN OUR COMMUNITY</strong>
      <div class="socialIcons">
        <span>◉</span>
        <span>▶</span>
        <span>◎</span>
      </div>
      <b>›</b>
    </div>

    <button class="nextMapPanel" id="nextMapButton" data-panel="map">
      <div>
        <strong>NEXT MAP</strong>
        <span id="nextMapName">RANDOM</span>
      </div>
      <strong>⤨</strong>
      <b>›</b>
    </button>

  </aside>

  <!-- CHARACTER ACTION -->
  <button class="outfitButton">
    ◈ &nbsp; CHANGE OUTFIT
  </button>

  <!-- WORLD CHAT -->
  <div class="worldChat">
    <span class="chatIcon">•••</span>
    <strong>WORLD</strong>
    <span>Type a message...</span>
    <b>›</b>
  </div>

  <!-- AUDIO -->
  <div class="audioButtons">
    <button>♩</button>
    <button>◖</button>
  </div>

  <!-- BOTTOM -->
  <div class="lobbyBottom">
    <span>SEASON 1</span>
    <span>50 PLAYERS ONLINE</span>
    <span>BUILD 0.1</span>
  </div>
`;

document.body.appendChild(lobbyUI);

/* =========================================================
   MATCHMAKING UI
========================================================= */

const matchmakingUI =
  makeElement(
    "div",
    "gameUI matchmakingUI"
  );

matchmakingUI.innerHTML = `
  <div class="matchCard">
    <div class="matchTitle">
      MATCHMAKING
    </div>

    <div class="matchSpinner"></div>

    <div class="matchStatus">
      SEARCHING FOR PLAYERS...
    </div>

    <div class="matchMap" id="matchMap">
      MAP: RANDOM
    </div>

    <div class="matchMode" id="matchMode">
      MODE: SOLO
    </div>
  </div>
`;

document.body.appendChild(
  matchmakingUI
);

/* =========================================================
   LOADING UI
========================================================= */

const loadingUI =
  makeElement(
    "div",
    "gameUI loadingUI"
  );

loadingUI.innerHTML = `
  <div class="loadingCard">
    <div class="loadingTitle">
      LOADING BATTLEFIELD
    </div>

    <div class="loadingBar">
      <div class="loadingFill"></div>
    </div>

    <div class="loadingPercent">
      0%
    </div>
  </div>
`;

document.body.appendChild(
  loadingUI
);

/* =========================================================
   DEPLOYMENT UI
========================================================= */

const deploymentUI =
  makeElement(
    "div",
    "gameUI deploymentUI"
  );

deploymentUI.innerHTML = `
  <div class="deploymentTop">

    <div class="deploymentStats">
      <span>ALIVE</span>
      <strong id="deploymentAlive">
        50
      </strong>
    </div>

    <div class="deploymentTimer">
      <span id="deploymentTimer">
        15
      </span>
    </div>

  </div>

  <div class="deploymentHelp">

    <div class="helpTitle">
      AIR CONTROLS
    </div>

    <div class="helpLine">
      <b>W</b>
      <span>MOVE FORWARD</span>
    </div>

    <div class="helpLine">
      <b>A</b>
      <span>MOVE LEFT</span>
    </div>

    <div class="helpLine">
      <b>S</b>
      <span>MOVE BACK</span>
    </div>

    <div class="helpLine">
      <b>D</b>
      <span>MOVE RIGHT</span>
    </div>

    <div class="helpLine">
      <b>SPACE</b>
      <span>JUMP / DEPLOY</span>
    </div>

    <div class="airMessage">
      USE W A S D TO STEER WHILE IN AIR
    </div>

  </div>

  <div class="deploymentCenter">
    <div
      class="deploymentStatus"
      id="deploymentStatus"
    >
      WAITING FOR JUMP
    </div>
  </div>

  <div class="altitude">

    <div class="altitudeLine"></div>

    <div class="altitudeText">
      <span id="altitudeValue">
        95
      </span>
      m
    </div>

  </div>
`;

document.body.appendChild(
  deploymentUI
);

/* =========================================================
   BATTLE HUD
========================================================= */

const battleUI =
  makeElement(
    "div",
    "gameUI battleUI"
  );

battleUI.innerHTML = `
  <div class="hudTop">

    <div class="hudBox">
      Alive
      <strong id="aliveValue">
        50
      </strong>
    </div>

    <div class="hudBox">
      Kills
      <strong id="killsValue">
        0
      </strong>
    </div>

    <div
      class="compass"
      id="compass"
    >
      N
    </div>

  </div>

  <div class="miniMap">
    <div class="miniMapPlayer"></div>
  </div>

  <div
    class="zoneWarning"
    id="zoneWarning"
  >
    SAFE ZONE
  </div>

  <div class="weaponHUD" id="weaponHUD">

    <div class="weaponSlot" id="weaponSlot1" data-weapon="RIFLE">
      <span class="slotNumber">1</span>
      <span class="weaponIcon">
        <svg viewBox="0 0 120 48" aria-hidden="true">
          <path d="M8 19h43l8-6h22v5h27v8H82v5H65l-9-5H42l-8 12H23l4-13H8z"/>
          <path d="M52 19v-7h7v7z"/>
          <path d="M68 26l-4 17h-9l2-17z"/>
        </svg>
      </span>
      <span class="slotAmmo" id="slotAmmo1">30</span>
    </div>

    <div class="weaponSlot" id="weaponSlot2" data-weapon="SMG">
      <span class="slotNumber">2</span>
      <span class="weaponIcon">
        <svg viewBox="0 0 120 48" aria-hidden="true">
          <path d="M8 18h57l7-5h25v7h15v9H88v5H70l-8-8H43l-5 12H26l3-14H8z"/>
          <path d="M61 27l-5 17H45l3-17z"/>
          <path d="M75 18v-8h9v8z"/>
        </svg>
      </span>
      <span class="slotAmmo" id="slotAmmo2">40</span>
    </div>

    <div class="weaponSlot" id="weaponSlot3" data-weapon="SHOTGUN">
      <span class="slotNumber">3</span>
      <span class="weaponIcon">
        <svg viewBox="0 0 120 48" aria-hidden="true">
          <path d="M7 19h35l9-5h23v6h38v8H73l-8 5H48l-10 11H26l5-15H7z"/>
          <path d="M48 28l-3 15H34l3-15z"/>
          <path d="M58 14h12v-5h6v9H58z"/>
        </svg>
      </span>
      <span class="slotAmmo" id="slotAmmo3">6</span>
    </div>

    <div class="weaponSlot" id="weaponSlot4" data-weapon="PISTOL">
      <span class="slotNumber">4</span>
      <span class="weaponIcon">
        <svg viewBox="0 0 120 48" aria-hidden="true">
          <path d="M15 17h46l8 5h26v9H68l-9 5H42l-5 9H26l3-14H15z"/>
          <path d="M48 30l-3 15H34l4-15z"/>
          <path d="M69 22h30v5H69z"/>
        </svg>
      </span>
      <span class="slotAmmo" id="slotAmmo4">12</span>
    </div>

    <div class="weaponAmmo">
      <span id="weaponName">NONE</span>
      <strong id="ammoValue">0</strong>
    </div>

  </div>

  <div class="healthHUD">

    <div class="healthRow">
      <span>♥</span>

      <div class="healthBar">
        <div
          class="healthFill"
          id="healthFill"
        ></div>
      </div>

      <strong id="healthValue">
        100
      </strong>
    </div>

    <div class="armorRow">
      <span>◆</span>

      <div class="armorBar">
        <div
          class="armorFill"
          id="armorFill"
        ></div>
      </div>

      <strong id="armorValue">
        50
      </strong>
    </div>

  </div>

  <div class="crosshair">
    <span></span>
    <span></span>
    <span></span>
    <span></span>
  </div>

  <div class="battleHelp">
    <b>W A S D</b> MOVE
    <br />
    <b>SHIFT</b> SPRINT
    <br />
    <b>E</b> PICK UP
    <br />
    <b>H</b> MEDKIT
    <br />
    <b>SPACE</b> JUMP
    <br />
    <b>CLICK</b> SHOOT
  </div>
`;

document.body.appendChild(
  battleUI
);

/* =========================================================
   RESULTS UI
========================================================= */

const resultsUI =
  makeElement(
    "div",
    "gameUI resultsUI"
  );

resultsUI.innerHTML = `
  <div class="resultsCard">

    <div class="resultsEyebrow">
      NEXUS // MATCH RESULT
    </div>

    <div class="resultsTitle">
      YOU DIED
    </div>

    <div class="resultsSubtitle">
      SQUAD ELIMINATED
    </div>

    <div class="resultsPlacement">
      #<span id="placementValue">12</span>
      <small>RANK</small>
    </div>

    <div class="resultsStats">

      <div class="resultStat">
        <span>KILLS</span>
        <strong id="resultKills">0</strong>
      </div>

      <div class="resultStat">
        <span>PLAYERS LEFT</span>
        <strong id="resultAlive">1</strong>
      </div>

      <div class="resultStat">
        <span>DAMAGE</span>
        <strong id="resultDamage">0</strong>
      </div>

      <div class="resultStat">
        <span>TIME SURVIVED</span>
        <strong id="resultTime">--:--</strong>
      </div>

    </div>

    <div class="resultsDivider"></div>

    <div class="resultsDetails">
      <div>
        <span>WEAPON</span>
        <strong id="resultWeapon">NONE</strong>
      </div>

      <div>
        <span>STATUS</span>
        <strong>ELIMINATED</strong>
      </div>
    </div>

    <button class="returnButton" type="button">
      RETURN TO LOBBY
    </button>

  </div>
`;

document.body.appendChild(
  resultsUI
);

/* =========================================================
   UI REFERENCES
========================================================= */

const playButton =
  lobbyUI.querySelector<HTMLButtonElement>(
    ".playButton"
  )!;

const modeButtons =
  Array.from(
    lobbyUI.querySelectorAll<HTMLButtonElement>(
      ".modeButton"
    )
  );

const matchMap =
  matchmakingUI.querySelector<HTMLElement>(
    "#matchMap"
  )!;

const matchMode =
  matchmakingUI.querySelector<HTMLElement>(
    "#matchMode"
  )!;

const loadingFill =
  loadingUI.querySelector<HTMLElement>(
    ".loadingFill"
  )!;

const loadingPercent =
  loadingUI.querySelector<HTMLElement>(
    ".loadingPercent"
  )!;

const deploymentTimerElement =
  deploymentUI.querySelector<HTMLElement>(
    "#deploymentTimer"
  )!;

const deploymentStatus =
  deploymentUI.querySelector<HTMLElement>(
    "#deploymentStatus"
  )!;

const altitudeValue =
  deploymentUI.querySelector<HTMLElement>(
    "#altitudeValue"
  )!;

const deploymentAlive =
  deploymentUI.querySelector<HTMLElement>(
    "#deploymentAlive"
  )!;

const aliveValue =
  battleUI.querySelector<HTMLElement>(
    "#aliveValue"
  )!;

const killsValue =
  battleUI.querySelector<HTMLElement>(
    "#killsValue"
  )!;

const weaponName =
  battleUI.querySelector<HTMLElement>(
    "#weaponName"
  )!;

const ammoValue =
  battleUI.querySelector<HTMLElement>(
    "#ammoValue"
  )!;

const healthValue =
  battleUI.querySelector<HTMLElement>(
    "#healthValue"
  )!;

const armorValue =
  battleUI.querySelector<HTMLElement>(
    "#armorValue"
  )!;

const healthFill =
  battleUI.querySelector<HTMLElement>(
    "#healthFill"
  )!;

const armorFill =
  battleUI.querySelector<HTMLElement>(
    "#armorFill"
  )!;

const zoneWarning =
  battleUI.querySelector<HTMLElement>(
    "#zoneWarning"
  )!;

const returnButton =
  resultsUI.querySelector<HTMLButtonElement>(
    ".returnButton"
  )!;

const placementValue =
  resultsUI.querySelector<HTMLElement>(
    "#placementValue"
  )!;

const resultKills =
  resultsUI.querySelector<HTMLElement>(
    "#resultKills"
  )!;

const resultAlive =
  resultsUI.querySelector<HTMLElement>(
    "#resultAlive"
  )!;

const resultDamage =
  resultsUI.querySelector<HTMLElement>(
    "#resultDamage"
  )!;

const resultTime =
  resultsUI.querySelector<HTMLElement>(
    "#resultTime"
  )!;

const resultWeapon =
  resultsUI.querySelector<HTMLElement>(
    "#resultWeapon"
  )!;

/* =========================================================
   STATE MANAGEMENT
========================================================= */

function setState(
  nextState: GameState
) {
  state = nextState;

  /*
    THIS IS THE MAIN FIX.

    The old cyberpunk environment only exists
    visually in the lobby.

    As soon as we leave the lobby it is hidden.
  */

  lobbyUI.style.display =
    state === "LOBBY"
      ? "flex"
      : "none";

  matchmakingUI.style.display =
    state === "MATCHMAKING"
      ? "flex"
      : "none";

  loadingUI.style.display =
    state === "LOADING"
      ? "flex"
      : "none";

  deploymentUI.style.display =
    state === "DEPLOYMENT"
      ? "flex"
      : "none";

  battleUI.style.display =
    state === "BATTLE"
      ? "flex"
      : "none";

  resultsUI.style.display =
    state === "RESULTS"
      ? "flex"
      : "none";

  resultsUI.style.pointerEvents =
    state === "RESULTS"
      ? "auto"
      : "none";

  lobbyUI.style.pointerEvents =
    state === "LOBBY"
      ? "auto"
      : "none";

  deploymentUI.style.pointerEvents =
    state === "DEPLOYMENT"
      ? "auto"
      : "none";

  renderer.domElement.style.pointerEvents =
    state === "BATTLE" ||
    state === "DEPLOYMENT"
      ? "auto"
      : "none";

  resultsUI.style.pointerEvents =
    state === "RESULTS"
      ? "auto"
      : "none";


}

/* =========================================================
   MODE
========================================================= */

let selectedMode = "SOLO";

modeButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        modeButtons.forEach(
          (other) => {
            other.classList.remove(
              "active"
            );
          }
        );

        button.classList.add(
          "active"
        );

        selectedMode =
          button.dataset.mode ??
          "SOLO";
      }
    );
  }
);

/* =========================================================
   PLAY
========================================================= */


// ============================================================
// LOBBY INTERACTION SYSTEM
// ============================================================


// ─────────────────────────────────────────────────────────────
// ACCOUNT SYSTEM
// ─────────────────────────────────────────────────────────────

const accountUI = document.createElement("div");
accountUI.className = "accountUI";
accountUI.innerHTML = `
  <div class="accountWindow">
    <div class="accountHeader">
      <span>NEXUS // ACCOUNT</span>
      <button id="accountClose" type="button">×</button>
    </div>

    <div class="accountTitle" id="accountTitle">LOGIN</div>

    <div class="accountTabs">
      <button class="accountTab active" data-auth-mode="login" type="button">
        LOGIN
      </button>
      <button class="accountTab" data-auth-mode="register" type="button">
        CREATE ACCOUNT
      </button>
    </div>

    <form id="accountForm">
      <label>
        USERNAME
        <input
          id="accountUsername"
          type="text"
          minlength="3"
          maxlength="20"
          autocomplete="username"
          required
        />
      </label>

      <label>
        PASSWORD
        <input
          id="accountPassword"
          type="password"
          minlength="6"
          autocomplete="current-password"
          required
        />
      </label>

      <button id="accountSubmit" class="accountSubmit" type="submit">
        LOGIN
      </button>

      <div id="accountMessage" class="accountMessage"></div>
    </form>

    <div class="accountProfilePanel" id="accountProfilePanel">
      <div class="accountProfileName" id="accountProfileName">GUEST</div>

      <div class="accountProfileStats">
        <div>
          <span>LEVEL</span>
          <strong id="accountProfileLevel">1</strong>
        </div>
        <div>
          <span>XP</span>
          <strong id="accountProfileXP">0</strong>
        </div>
        <div>
          <span>COINS</span>
          <strong id="accountProfileCoins">0</strong>
        </div>
        <div>
          <span>GEMS</span>
          <strong id="accountProfileGems">0</strong>
        </div>
      </div>

      <button
        id="accountLogout"
        class="accountLogout"
        type="button"
      >
        LOG OUT
      </button>
    </div>
  </div>
`;

document.body.appendChild(accountUI);

const accountForm =
  accountUI.querySelector<HTMLFormElement>("#accountForm");

const accountUsernameInput =
  accountUI.querySelector<HTMLInputElement>("#accountUsername");

const accountPasswordInput =
  accountUI.querySelector<HTMLInputElement>("#accountPassword");

const accountSubmit =
  accountUI.querySelector<HTMLButtonElement>("#accountSubmit");

const accountMessage =
  accountUI.querySelector<HTMLElement>("#accountMessage");

const accountTitle =
  accountUI.querySelector<HTMLElement>("#accountTitle");

const accountClose =
  accountUI.querySelector<HTMLButtonElement>("#accountClose");

const accountProfilePanel =
  accountUI.querySelector<HTMLElement>("#accountProfilePanel");

const accountProfileName =
  accountUI.querySelector<HTMLElement>("#accountProfileName");

const accountProfileLevel =
  accountUI.querySelector<HTMLElement>("#accountProfileLevel");

const accountProfileXP =
  accountUI.querySelector<HTMLElement>("#accountProfileXP");

const accountProfileCoins =
  accountUI.querySelector<HTMLElement>("#accountProfileCoins");

const accountProfileGems =
  accountUI.querySelector<HTMLElement>("#accountProfileGems");

const accountLogout =
  accountUI.querySelector<HTMLButtonElement>("#accountLogout");

let accountAuthMode: "login" | "register" = "login";

let pendingAuthUsername = "";
let pendingAuthPassword = "";

let accountToken =
  localStorage.getItem("nexus_account_token") ?? "";

let accountUsername = "👑 KING";
let accountLevel = 12;
let accountXP = 0;
let accountCoins = 2450;
let accountGems = 120;

function updateLobbyAccount() {
  const profile =
    lobbyUI.querySelector<HTMLElement>(".playerProfile");

  if (profile) {
    const name =
      profile.querySelector<HTMLElement>(
        ".profileInfo strong"
      );

    const level =
      profile.querySelector<HTMLElement>(
        ".profileInfo span"
      );

    if (name) {
      name.textContent = accountUsername;
    }

    if (level) {
      level.textContent = `LEVEL ${accountLevel}`;
    }
  }

  if (accountProfileName) {
    accountProfileName.textContent = accountUsername;
  }

  if (accountProfileLevel) {
    accountProfileLevel.textContent =
      String(accountLevel);
  }

  if (accountProfileXP) {
    accountProfileXP.textContent =
      accountXP.toLocaleString();
  }

  if (accountProfileCoins) {
    accountProfileCoins.textContent =
      accountCoins.toLocaleString();
  }

  if (accountProfileGems) {
    accountProfileGems.textContent =
      accountGems.toLocaleString();
  }

  const currencyBar =
    lobbyUI.querySelector<HTMLElement>(".currencyBar");

  if (currencyBar) {
    const text = currencyBar.textContent ?? "";

    if (text.includes("🪙")) {
      const coinNodes =
        currencyBar.querySelectorAll<HTMLElement>(
          "[data-currency='coins']"
        );

      coinNodes.forEach((node) => {
        node.textContent =
          `🪙 ${accountCoins.toLocaleString()}`;
      });
    }

    if (text.includes("💎")) {
      const gemNodes =
        currencyBar.querySelectorAll<HTMLElement>(
          "[data-currency='gems']"
        );

      gemNodes.forEach((node) => {
        node.textContent =
          `💎 ${accountGems.toLocaleString()}`;
      });
    }
  }
}


function setAccountMessage(message: string, error = false) {
  if (!accountMessage) return;
  accountMessage.textContent = message;
  accountMessage.classList.toggle("error", error);
}

function openAccountUI() {
  accountUI.classList.add("open");
  accountUI.style.display = "flex";
  setAccountMessage("");

  if (accountToken && accountUsername !== "👑 KING") {
    showAccountProfile();
  } else {
    showAccountAuth();

    window.setTimeout(() => {
      accountUsernameInput?.focus();
    }, 50);
  }
}

function closeAccountUI() {
  accountUI.classList.remove("open");
  accountUI.style.display = "none";
}

function showAccountProfile() {
  accountForm?.classList.add("accountFormHidden");
  accountProfilePanel?.classList.add("visible");
  updateLobbyAccount();
}

function showAccountAuth() {
  accountForm?.classList.remove("accountFormHidden");
  accountProfilePanel?.classList.remove("visible");
}

accountLogout?.addEventListener("click", () => {
  if (
    multiplayerSocket &&
    multiplayerSocket.readyState === WebSocket.OPEN
  ) {
    multiplayerSocket.send(
      JSON.stringify({
        type: "logout"
      })
    );
  }

  accountToken = "";
  accountUsername = "👑 KING";
  accountLevel = 1;
  accountXP = 0;
  accountCoins = 0;
  accountGems = 0;

  localStorage.removeItem(
    "nexus_account_token"
  );

  showAccountAuth();
  setAccountMode("login");
  setAccountMessage("LOGGED OUT");

  updateLobbyAccount();

  console.log("ACCOUNT LOGGED OUT");
});

function setAccountMode(mode: "login" | "register") {
  accountAuthMode = mode;

  accountUI
    .querySelectorAll<HTMLButtonElement>(".accountTab")
    .forEach((tab) => {
      tab.classList.toggle(
        "active",
        tab.dataset.authMode === mode
      );
    });

  if (accountTitle) {
    accountTitle.textContent =
      mode === "login" ? "LOGIN" : "CREATE ACCOUNT";
  }

  if (accountSubmit) {
    accountSubmit.textContent =
      mode === "login" ? "LOGIN" : "CREATE ACCOUNT";
  }

  if (accountPasswordInput) {
    accountPasswordInput.autocomplete =
      mode === "login" ? "current-password" : "new-password";
  }

  setAccountMessage("");
}

accountUI
  .querySelectorAll<HTMLButtonElement>(".accountTab")
  .forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.authMode;
      if (mode === "login" || mode === "register") {
        setAccountMode(mode);
      }
    });
  });

accountClose?.addEventListener("click", () => {
  closeAccountUI();
});

accountUI.addEventListener("click", (event) => {
  if (event.target === accountUI) {
    closeAccountUI();
  }
});

accountForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const username =
    accountUsernameInput?.value.trim() ?? "";

  const password =
    accountPasswordInput?.value ?? "";

  if (!username || !password) {
    setAccountMessage("ENTER USERNAME AND PASSWORD", true);
    return;
  }

  if (username.length < 3 || username.length > 16) {
    setAccountMessage(
      "USERNAME MUST BE 3-16 CHARACTERS",
      true
    );
    return;
  }

  if (password.length < 6 || password.length > 72) {
    setAccountMessage(
      "PASSWORD MUST BE 6-72 CHARACTERS",
      true
    );
    return;
  }

  pendingAuthUsername = username;
  pendingAuthPassword = password;

  if (
    !multiplayerSocket ||
    multiplayerSocket.readyState === WebSocket.CLOSED ||
    multiplayerSocket.readyState === WebSocket.CLOSING
  ) {
    setAccountMessage("CONNECTING TO SERVER...");
    connectMultiplayer();
    return;
  }

  if (multiplayerSocket.readyState === WebSocket.CONNECTING) {
    setAccountMessage("CONNECTING TO SERVER...");
    return;
  }

  const message = {
    type:
      accountAuthMode === "login"
        ? "auth_login"
        : "auth_register",
    username: pendingAuthUsername,
    password: pendingAuthPassword
  };

  multiplayerSocket.send(JSON.stringify(message));

  setAccountMessage(
    accountAuthMode === "login"
      ? "LOGGING IN..."
      : "ACCOUNT CREATING..."
  );
});

// Make the existing profile card open the account screen.
const profileButton =
  lobbyUI.querySelector<HTMLElement>(".playerProfile");

profileButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  openAccountUI();
});

const lobbyTabs = Array.from(
  lobbyUI.querySelectorAll<HTMLButtonElement>(".navTab")
);

const lobbySideButtons = Array.from(
  lobbyUI.querySelectorAll<HTMLButtonElement>(".sideMenuButton")
);

const outfitButton = lobbyUI.querySelector<HTMLButtonElement>(
  ".outfitButton"
);

const nextMapButton = lobbyUI.querySelector<HTMLButtonElement>(
  "#nextMapButton"
);

const nextMapName = lobbyUI.querySelector<HTMLElement>(
  "#nextMapName"
);

const battleRoyaleMapName =
  lobbyUI.querySelector<HTMLElement>(
    "#battleRoyaleMapName"
  );

const newWeaponsMapButton =
  lobbyUI.querySelector<HTMLButtonElement>(
    "#newWeaponsMapButton"
  );

const lobbyMaps = [
  "RANDOM",
  "BATTLE CITY",
  "DESERT OUTPOST",
  "INDUSTRIAL ZONE"
];

let lobbyMapIndex = 0;
let selectedMap = lobbyMaps[lobbyMapIndex];

const lobbyPage = document.createElement("div");
lobbyPage.className = "lobbyPage";

lobbyPage.innerHTML = `
  <div class="lobbyPageTop">
    <button class="lobbyPageBack" id="lobbyPageBack" type="button">
      ‹ BACK
    </button>

    <div class="lobbyPageBrand">
      <strong>NEXUS</strong>
      <span>BATTLE CITY</span>
    </div>

    <div class="lobbyPagePlayer">
      <strong>👑 KING</strong>
      <span>LEVEL 12</span>
    </div>
  </div>

  <div class="lobbyPageBody">
    <div class="lobbyPageEyebrow">NEXUS // BATTLE CITY</div>
    <h1 id="lobbyPageTitle">INVENTORY</h1>
    <div id="lobbyPageContent"></div>
  </div>
`;

lobbyUI.appendChild(lobbyPage);

const lobbyPageTitle = lobbyPage.querySelector<HTMLElement>(
  "#lobbyPageTitle"
);

const lobbyPageContent = lobbyPage.querySelector<HTMLElement>(
  "#lobbyPageContent"
);

const lobbyPageBack = lobbyPage.querySelector<HTMLButtonElement>(
  "#lobbyPageBack"
);

const lobbyPageContentMap: Record<string, string> = {

  inventory: `
    <div class="fullPageGrid">

      <div class="inventoryWeaponCard selected" data-inventory-weapon="RIFLE">
        <span class="itemType">PRIMARY WEAPON</span>
        <strong>RIFLE</strong>

        <div class="inventoryWeaponImage">
          <img src="/weapons/rifle.png" alt="Rifle">
        </div>

        <span>30 MAGAZINE · 120 RESERVE</span>
        <button type="button">EQUIPPED</button>
      </div>

      <div class="inventoryWeaponCard" data-inventory-weapon="SMG">
        <span class="itemType">SUB MACHINE GUN</span>
        <strong>UMP-45</strong>

        <div class="inventoryWeaponImage">
          <img src="/weapons/smg.png" alt="UMP-45">
        </div>

        <span>40 MAGAZINE · 160 RESERVE</span>
        <button type="button">EQUIP</button>
      </div>

      <div class="inventoryWeaponCard" data-inventory-weapon="SHOTGUN">
        <span class="itemType">SPECIAL WEAPON</span>
        <strong>SHOTGUN</strong>

        <div class="inventoryWeaponImage">
          <img src="/weapons/shotgun.png" alt="Shotgun">
        </div>

        <span>6 MAGAZINE · 36 RESERVE</span>
        <button type="button">EQUIP</button>
      </div>

      <div class="inventoryWeaponCard" data-inventory-weapon="PISTOL">
        <span class="itemType">SIDEARM</span>
        <strong>PISTOL</strong>

        <div class="inventoryWeaponImage">
          <img src="/weapons/pistol.png" alt="Pistol">
        </div>

        <span>12 MAGAZINE · 72 RESERVE</span>
        <button type="button">EQUIP</button>
      </div>

    </div>
  `,

  missions: `
    <div class="missionPage">

      <div class="missionHeader">
        <strong>DAILY MISSIONS</strong>
        <span>RESET IN 18:42:12</span>
      </div>

      <div class="missionRow">
        <div>
          <strong>SURVIVOR</strong>
          <span>Survive for 10 minutes in a battle.</span>
        </div>
        <b>0 / 10</b>
      </div>

      <div class="missionRow">
        <div>
          <strong>MARKSMAN</strong>
          <span>Deal 500 damage to enemy players.</span>
        </div>
        <b>125 / 500</b>
      </div>

      <div class="missionRow">
        <div>
          <strong>EXPLORER</strong>
          <span>Visit 3 different locations.</span>
        </div>
        <b>1 / 3</b>
      </div>

      <div class="missionHeader">
        <strong>SEASON MISSIONS</strong>
        <span>SEASON 1</span>
      </div>

      <div class="missionRow">
        <div>
          <strong>RISE TO GLORY</strong>
          <span>Finish in the top 10.</span>
        </div>
        <b>0 / 1</b>
      </div>

    </div>
  `,

  character: `
    <div class="characterPage">

      <div class="characterHero">
        <div class="characterHeroFigure" id="characterPreview3D">
  <div class="characterPreviewGrid"></div>
  <div class="characterPreviewModel">
    <div class="previewHead"></div>
    <div class="previewBody"></div>
    <div class="previewArm previewArmLeft"></div>
    <div class="previewArm previewArmRight"></div>
    <div class="previewLeg previewLegLeft"></div>
    <div class="previewLeg previewLegRight"></div>
  </div>
</div>

        <div class="characterInfo">
          <span>PLAYER CHARACTER</span>
          <h2 id="characterAccountName">👑 KING</h2>
          <strong id="characterAccountLevel">LEVEL 12</strong>

          <div class="characterXP">
            <i id="characterXPBar"></i>
          </div>

          <small id="characterXPText">350 / 1000 XP</small>

          <button type="button">CHANGE OUTFIT</button>
        </div>
      </div>

      <div class="characterOptions">
        <div>
          <span>HEADGEAR</span>
          <strong>DEFAULT</strong>
        </div>
        <div>
          <span>OUTFIT</span>
          <strong>URBAN SOLDIER</strong>
        </div>
        <div>
          <span>BACKPACK</span>
          <strong>TACTICAL PACK</strong>
        </div>
        <div>
          <span>EMOTE</span>
          <strong>READY</strong>
        </div>
      </div>

    </div>
  `,

  armory: `
    <div class="armoryPage">

      <div class="armoryCard active" data-armory-weapon="RIFLE">
        <span>ASSAULT RIFLE</span>
        <h2>RIFLE</h2>

        <div class="armoryWeaponVisual realWeapon">
          <img src="/weapons/rifle.png" alt="RIFLE weapon">
        </div>

        <div class="armoryStats">
          <div><span>DAMAGE</span><b>25</b><i><em style="width:72%"></em></i></div>
          <div><span>FIRE RATE</span><b>110</b><i><em style="width:68%"></em></i></div>
          <div><span>RANGE</span><b>HIGH</b><i><em style="width:82%"></em></i></div>
          <div><span>MAGAZINE</span><b>30</b><i><em style="width:70%"></em></i></div>
        </div>

        <button type="button">EQUIPPED</button>
      </div>

      <div class="armoryCard" data-armory-weapon="SMG">
        <span>SUB MACHINE GUN</span>
        <h2>SMG</h2>

        <div class="armoryWeaponVisual realWeapon">
          <img src="/weapons/smg.png" alt="SMG weapon">
        </div>

        <div class="armoryStats">
          <div><span>DAMAGE</span><b>16</b><i><em style="width:54%"></em></i></div>
          <div><span>FIRE RATE</span><b>70</b><i><em style="width:94%"></em></i></div>
          <div><span>RANGE</span><b>MED</b><i><em style="width:48%"></em></i></div>
          <div><span>MAGAZINE</span><b>40</b><i><em style="width:88%"></em></i></div>
        </div>

        <button type="button">EQUIP</button>
      </div>

      <div class="armoryCard" data-armory-weapon="SHOTGUN">
        <span>COMBAT SHOTGUN</span>
        <h2>SHOTGUN</h2>

        <div class="armoryWeaponVisual realWeapon">
          <img src="/weapons/shotgun.png" alt="SHOTGUN weapon">
        </div>

        <div class="armoryStats">
          <div><span>DAMAGE</span><b>14 × 8</b><i><em style="width:96%"></em></i></div>
          <div><span>FIRE RATE</span><b>700</b><i><em style="width:30%"></em></i></div>
          <div><span>RANGE</span><b>LOW</b><i><em style="width:35%"></em></i></div>
          <div><span>MAGAZINE</span><b>6</b><i><em style="width:28%"></em></i></div>
        </div>

        <button type="button">EQUIP</button>
      </div>

      <div class="armoryCard" data-armory-weapon="PISTOL">
        <span>SERVICE SIDEARM</span>
        <h2>PISTOL</h2>

        <div class="armoryWeaponVisual realWeapon">
          <img src="/weapons/pistol.png" alt="PISTOL weapon">
        </div>

        <div class="armoryStats">
          <div><span>DAMAGE</span><b>30</b><i><em style="width:78%"></em></i></div>
          <div><span>FIRE RATE</span><b>260</b><i><em style="width:48%"></em></i></div>
          <div><span>RANGE</span><b>MED</b><i><em style="width:52%"></em></i></div>
          <div><span>MAGAZINE</span><b>12</b><i><em style="width:35%"></em></i></div>
        </div>

        <button type="button">EQUIP</button>
      </div>

    </div>
  `,

  store: `
    <div class="storePage">

      <div class="storeTop">
        <strong>FEATURED ITEMS</strong>
        <span>COINS 2,450</span>
      </div>

      <div class="storeGrid">

        <div class="storeProduct">
          <div class="storeProductImage">◆</div>
          <span>CHARACTER SKIN</span>
          <strong>URBAN CAMO</strong>
          <b>850 COINS</b>
          <button type="button">PURCHASE</button>
        </div>

        <div class="storeProduct">
          <div class="storeProductImage">◆</div>
          <span>WEAPON SKIN</span>
          <strong>NIGHTFALL</strong>
          <b>1,200 COINS</b>
          <button type="button">PURCHASE</button>
        </div>

        <div class="storeProduct">
          <div class="storeProductImage">◆</div>
          <span>ARMOR SKIN</span>
          <strong>ROYAL ARMOR</strong>
          <b>600 COINS</b>
          <button type="button">PURCHASE</button>
        </div>

        <div class="storeProduct">
          <div class="storeProductImage">◆</div>
          <span>EMOTE</span>
          <strong>VICTORY</strong>
          <b>400 COINS</b>
          <button type="button">PURCHASE</button>
        </div>

      </div>
    </div>
  `,

  events: `
    <div class="featurePage">
      <div class="featureHero">
        <span>LIMITED TIME</span>
        <h2>NEXUS CITY EVENTS</h2>
        <p>Complete special challenges and earn exclusive rewards.</p>
      </div>

      <div class="featureGrid">
        <div class="featureCard">
          <strong>URBAN WAR</strong>
          <span>Win 3 Battle Royale matches</span>
          <b>REWARD · 500 XP</b>
        </div>
        <div class="featureCard">
          <strong>HOT DROP</strong>
          <span>Get 10 eliminations at named POIs</span>
          <b>REWARD · 750 XP</b>
        </div>
        <div class="featureCard">
          <strong>LAST STANDING</strong>
          <span>Finish in the top 5</span>
          <b>REWARD · 1,000 XP</b>
        </div>
      </div>
    </div>
  `,

  leaderboard: `
    <div class="leaderboardPage">
      <div class="leaderboardHeader">
        <span>SEASON 1</span>
        <strong>TOP PLAYERS</strong>
      </div>

      <div class="leaderboardRow first">
        <b>#01</b>
        <strong>SHADOW</strong>
        <span>2,840 RP</span>
        <em>48 WINS</em>
      </div>

      <div class="leaderboardRow">
        <b>#02</b>
        <strong>PHANTOM</strong>
        <span>2,710 RP</span>
        <em>43 WINS</em>
      </div>

      <div class="leaderboardRow">
        <b>#03</b>
        <strong>VIPER</strong>
        <span>2,590 RP</span>
        <em>39 WINS</em>
      </div>

      <div class="leaderboardRow yourRank">
        <b>#127</b>
        <strong>👑 KING</strong>
        <span>1,240 RP</span>
        <em>12 WINS</em>
      </div>
    </div>
  `,

  achievements: `
    <div class="achievementPage">
      <div class="achievementCard unlocked">
        <div>★</div>
        <strong>FIRST BLOOD</strong>
        <span>Get your first elimination.</span>
        <b>UNLOCKED</b>
      </div>

      <div class="achievementCard unlocked">
        <div>◆</div>
        <strong>SURVIVOR</strong>
        <span>Finish in the top 10.</span>
        <b>UNLOCKED</b>
      </div>

      <div class="achievementCard">
        <div>◇</div>
        <strong>CHAMPION</strong>
        <span>Win your first Battle Royale.</span>
        <b>LOCKED</b>
      </div>

      <div class="achievementCard">
        <div>◇</div>
        <strong>HUNTER</strong>
        <span>Eliminate 100 enemies.</span>
        <b>24 / 100</b>
      </div>

      <div class="achievementCard">
        <div>◇</div>
        <strong>EXPLORER</strong>
        <span>Visit every POI on the map.</span>
        <b>6 / 10</b>
      </div>

      <div class="achievementCard">
        <div>◇</div>
        <strong>VETERAN</strong>
        <span>Reach Level 25.</span>
        <b>12 / 25</b>
      </div>
    </div>
  `,

  "battle-pass": `
    <div class="battlePassPage">
      <div class="battlePassHero">
        <span>SEASON 1</span>
        <h2>RISE TO GLORY</h2>
        <p>350 / 1000 XP</p>
        <div class="battlePassProgress"><i></i></div>
        <strong>LEVEL 12</strong>
      </div>

      <div class="rewardTrack">
        <div class="reward unlocked">
          <span>LV. 10</span>
          <strong>500 COINS</strong>
          <b>CLAIMED</b>
        </div>

        <div class="reward unlocked">
          <span>LV. 11</span>
          <strong>XP BOOST</strong>
          <b>CLAIMED</b>
        </div>

        <div class="reward current">
          <span>LV. 12</span>
          <strong>ROYAL BADGE</strong>
          <b>CURRENT</b>
        </div>

        <div class="reward">
          <span>LV. 13</span>
          <strong>750 COINS</strong>
          <b>LOCKED</b>
        </div>

        <div class="reward">
          <span>LV. 14</span>
          <strong>NIGHTFALL</strong>
          <b>LOCKED</b>
        </div>
      </div>
    </div>
  `,

  map: `
    <div class="mapSelectionPage">
      <div class="mapSelectionHeader">
        <strong>SELECT BATTLEFIELD</strong>
        <span>CHOOSE YOUR DROP LOCATION</span>
      </div>

      <div class="mapSelectionGrid">
        ${lobbyMaps.map((map, index) => `
          <button
            type="button"
            class="mapSelectionCard ${index === lobbyMapIndex ? "selected" : ""}"
            data-map-index="${index}"
          >
            <span class="mapSelectionNumber">
              0${index + 1}
            </span>

            <div class="mapSelectionInfo">
              <strong>${map}</strong>
              <small>
                ${
                  map === "RANDOM"
                    ? "ROTATING BATTLEFIELD"
                    : map === "BATTLE CITY"
                      ? "URBAN COMBAT ZONE"
                      : map === "DESERT OUTPOST"
                        ? "OPEN DESERT TERRAIN"
                        : "INDUSTRIAL COMBAT ZONE"
                }
              </small>
            </div>

            <b class="mapSelectionCheck">
              ${index === lobbyMapIndex ? "SELECTED" : "SELECT"}
            </b>
          </button>
        `).join("")}
      </div>
    </div>
  `,

  settings: `
    <div class="settingsPage">

      <div class="settingsSection">
        <strong>GAMEPLAY</strong>

        <button type="button">
          <span>SHOW DAMAGE NUMBERS</span>
          <b>ON</b>
        </button>

        <button type="button">
          <span>AUTO PICKUP</span>
          <b>ON</b>
        </button>

        <button type="button">
          <span>HIT MARKER</span>
          <b>ON</b>
        </button>
      </div>

      <div class="settingsSection">
        <strong>GRAPHICS</strong>

        <button type="button">
          <span>QUALITY</span>
          <b>HIGH</b>
        </button>

        <button type="button">
          <span>SHADOWS</span>
          <b>HIGH</b>
        </button>

        <button type="button">
          <span>VIEW DISTANCE</span>
          <b>ULTRA</b>
        </button>
      </div>

      <div class="settingsSection">
        <strong>AUDIO</strong>

        <button type="button">
          <span>MASTER VOLUME</span>
          <b>100%</b>
        </button>

        <button type="button">
          <span>MUSIC</span>
          <b>ON</b>
        </button>

        <button type="button">
          <span>SFX</span>
          <b>100%</b>
        </button>
      </div>

    </div>
  `
};

function closeLobbyPage() {
  lobbyPage.classList.remove("open");
}

function openLobbyPanel(panel: string) {

  if (panel === "play") {
    closeLobbyPage();

    lobbyTabs.forEach((tab) => tab.classList.remove("active"));

    const playTab = lobbyTabs.find(
      (tab) => tab.textContent?.trim().toUpperCase() === "PLAY"
    );

    playTab?.classList.add("active");
    return;
  }

  const titles: Record<string, string> = {
    inventory: "INVENTORY",
    missions: "MISSIONS",
    character: "CHARACTER",
    armory: "ARMORY",
    store: "STORE",
    settings: "SETTINGS",
    events: "EVENTS",
    leaderboard: "LEADERBOARD",
    achievements: "ACHIEVEMENTS",
    "battle-pass": "BATTLE PASS",
    map: "NEXT MAP"
  };

  lobbyPageTitle!.textContent =
    titles[panel] ?? panel.toUpperCase();

  lobbyPageContent!.innerHTML =
    lobbyPageContentMap[panel] ??
    `
      <div class="comingSoonPage">
        <strong>${titles[panel] ?? panel.toUpperCase()}</strong>
        <span>THIS PAGE IS READY FOR CONTENT</span>
      </div>
    `;

  lobbyPage.classList.add("open");
  setupLobbyPageInteractions();
  setupInventoryInteractions();

  if (panel === "character") {
    updateCharacterAccount();
  }
}



function updateCharacterAccount() {
  const name =
    lobbyPageContent?.querySelector<HTMLElement>(
      "#characterAccountName"
    );

  const level =
    lobbyPageContent?.querySelector<HTMLElement>(
      "#characterAccountLevel"
    );

  const xpBar =
    lobbyPageContent?.querySelector<HTMLElement>(
      "#characterXPBar"
    );

  const xpText =
    lobbyPageContent?.querySelector<HTMLElement>(
      "#characterXPText"
    );

  if (!name || !level || !xpBar || !xpText) {
    return;
  }

  name.textContent = accountUsername;
  level.textContent = `LEVEL ${accountLevel}`;

  const xpPerLevel = 1000;
  const currentXP = Math.max(0, accountXP);
  const xpInLevel = currentXP % xpPerLevel;
  const progress =
    Math.min(100, (xpInLevel / xpPerLevel) * 100);

  xpBar.style.width = `${progress}%`;

  xpText.textContent =
    `${xpInLevel.toLocaleString()} / ${xpPerLevel.toLocaleString()} XP`;
}

function setupInventoryInteractions() {
  const cards = lobbyPageContent?.querySelectorAll<HTMLElement>(
    "[data-inventory-weapon]"
  );

  cards?.forEach((card) => {
    const button = card.querySelector<HTMLButtonElement>("button");

    button?.addEventListener("click", () => {
      const weapon = card.dataset.inventoryWeapon as WeaponName;

      if (!weapon || weapon === "NONE") return;

      cards.forEach((item) => {
        item.classList.remove("selected");

        const itemButton =
          item.querySelector<HTMLButtonElement>("button");

        if (itemButton) {
          itemButton.textContent = "EQUIP";
        }
      });

      card.classList.add("selected");
      button.textContent = "EQUIPPED";

      switchWeapon(weapon);

      console.log(`INVENTORY WEAPON EQUIPPED: ${weapon}`);
    });
  });
}

function setupLobbyPageInteractions() {
  lobbyPageContent
    ?.querySelectorAll<HTMLButtonElement>("[data-map-index]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.mapIndex);

        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= lobbyMaps.length
        ) {
          return;
        }

        lobbyMapIndex = index;
        selectedMap = lobbyMaps[index];

        if (nextMapName) {
          nextMapName.textContent = selectedMap;
        }

        if (battleRoyaleMapName) {
          battleRoyaleMapName.textContent = selectedMap;
        }

        if (matchMap) {
          matchMap.textContent = `MAP: ${selectedMap}`;
        }

        lobbyPageContent
          ?.querySelectorAll<HTMLButtonElement>("[data-map-index]")
          .forEach((item) => {
            const selected =
              Number(item.dataset.mapIndex) === lobbyMapIndex;

            item.classList.toggle("selected", selected);

            const label =
              item.querySelector<HTMLElement>(".mapSelectionCheck");

            if (label) {
              label.textContent =
                selected ? "SELECTED" : "SELECT";
            }
          });

        console.log(`MAP SELECTED: ${selectedMap}`);
      });
    });

  lobbyPageContent?.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.textContent?.trim().toUpperCase() ?? "";

      if (action === "EQUIP") {
        lobbyPageContent
          ?.querySelectorAll<HTMLButtonElement>("button")
          .forEach((b) => {
            if (b.textContent?.trim().toUpperCase() === "EQUIPPED") {
              b.textContent = "EQUIP";
            }
          });

        button.textContent = "EQUIPPED";
        console.log("ITEM EQUIPPED");
      }

      if (action === "CHANGE OUTFIT") {
        button.textContent = "OUTFIT SELECTED";
        console.log("OUTFIT SELECTED");
      }

      if (action === "PURCHASE") {
        button.textContent = "PURCHASED";
        button.disabled = true;
        console.log("ITEM PURCHASED");
      }
    });
  });

  lobbyPageContent
    ?.querySelectorAll<HTMLButtonElement>(".settingsSection button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.querySelector("b");

        if (!value) return;

        const current = value.textContent?.trim().toUpperCase();

        const next: Record<string, string> = {
          ON: "OFF",
          OFF: "ON",
          HIGH: "ULTRA",
          ULTRA: "MEDIUM",
          MEDIUM: "LOW",
          LOW: "HIGH",
          "100%": "75%",
          "75%": "50%",
          "50%": "100%"
        };

        value.textContent = next[current ?? ""] ?? current ?? "";
      });
    });
}

lobbyPageBack?.addEventListener("click", closeLobbyPage);

document.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    closeLobbyPage();
  }
});

lobbyTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    lobbyTabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");

    const panel =
      tab.dataset.panel ??
      tab.textContent?.trim().toLowerCase() ??
      "play";

    openLobbyPanel(panel);
  });
});

lobbySideButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const panel = button.dataset.panel ?? "play";
    openLobbyPanel(panel);
  });
});

outfitButton?.addEventListener("click", () => {
  console.log("OUTFIT BUTTON");
  openLobbyPanel("character");
});

nextMapButton?.addEventListener("click", () => {
  openLobbyPanel("map");
});

newWeaponsMapButton?.addEventListener("click", () => {
  openLobbyPanel("map");
});

if (battleRoyaleMapName) {
  battleRoyaleMapName.textContent = selectedMap;
}

if (nextMapName) {
  nextMapName.textContent = selectedMap;
}

console.log("LOBBY INTERACTIONS READY");

playButton.addEventListener("click", () => {
  // Request pointer lock from the user's START click.
  // Browsers require a user gesture for Pointer Lock.
  renderer.domElement.focus();
  renderer.domElement.requestPointerLock?.();

  startMatchmaking();
});

function createRemotePlayer(player: NetworkPlayer) {
  const group = new THREE.Group();
  group.name = `REMOTE_PLAYER_${player.id}`;

  if (playerGLB) {
    const model = playerGLB.clone(true);
    model.name = "REMOTE_PLAYER_MODEL";

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const height = Math.max(size.y, 0.01);

    model.scale.setScalar(0.6 / height);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    model.position.x -= scaledCenter.x;
    model.position.z -= scaledCenter.z;
    model.position.y -= scaledBox.min.y;

    model.traverse((object) => {
      object.visible = true;

      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });

    group.add(model);
  } else {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x30363d,
      roughness: 0.75,
      metalness: 0.1
    });

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xc98f6b,
      roughness: 0.8
    });

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.9, 4, 8),
      bodyMaterial
    );
    torso.position.y = 1.05;
    torso.castShadow = true;
    torso.receiveShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 12, 8),
      skinMaterial
    );
    head.position.y = 1.85;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    const legGeometry = new THREE.CapsuleGeometry(0.13, 0.7, 4, 6);

    const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    leftLeg.position.set(-0.17, 0.42, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    rightLeg.position.set(0.17, 0.42, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    const armGeometry = new THREE.CapsuleGeometry(0.11, 0.65, 4, 6);

    const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
    leftArm.position.set(-0.46, 1.1, 0);
    leftArm.rotation.z = -0.08;
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
    rightArm.position.set(0.46, 1.1, 0);
    rightArm.rotation.z = 0.08;
    rightArm.castShadow = true;
    group.add(rightArm);
  }

  group.position.set(player.x, player.y, player.z);
  group.rotation.y = player.yaw;

  group.scale.setScalar(1.35);

  group.traverse((object) => {
    object.visible = true;

    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false;
      object.renderOrder = 5000;

      if (object.material instanceof THREE.Material) {
        object.material.depthTest = true;
        object.material.depthWrite = true;
      }
    }
  });

  const markerCanvas = document.createElement("canvas");
  markerCanvas.width = 256;
  markerCanvas.height = 64;

  const markerContext = markerCanvas.getContext("2d");

  if (markerContext) {
    markerContext.clearRect(0, 0, 256, 64);
    markerContext.fillStyle = "rgba(0, 0, 0, 0.75)";
    markerContext.fillRect(8, 8, 240, 48);
    markerContext.fillStyle = "#00ffff";
    markerContext.font = "bold 28px Arial";
    markerContext.textAlign = "center";
    markerContext.textBaseline = "middle";
    markerContext.fillText(
      player.name || "PLAYER",
      128,
      32
    );
  }

  const markerTexture = new THREE.CanvasTexture(markerCanvas);
  markerTexture.needsUpdate = true;

  const markerMaterial = new THREE.SpriteMaterial({
    map: markerTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const marker = new THREE.Sprite(markerMaterial);
  marker.name = "REMOTE_NAME_MARKER";
  marker.scale.set(3.2, 0.8, 1);
  marker.position.y = 2.8;
  marker.renderOrder = 10000;

  group.add(marker);

  const parachuteGroup = new THREE.Group();
  parachuteGroup.name = "REMOTE_PARACHUTE";
  parachuteGroup.visible = player.deploymentState === "PARACHUTE";

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.8,
      side: THREE.DoubleSide
    })
  );
  canopy.scale.set(1.25, 0.55, 1.25);
  canopy.position.y = 4.2;
  canopy.castShadow = true;
  parachuteGroup.add(canopy);

  const linesMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff
  });

  for (const x of [-1.1, 1.1]) {
    const points = [
      new THREE.Vector3(x, 4.0, 0),
      new THREE.Vector3(x * 0.35, 2.15, 0)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    parachuteGroup.add(
      new THREE.Line(geometry, linesMaterial)
    );
  }

  group.add(parachuteGroup);

  scene.add(group);

  console.log(
    "REMOTE PLAYER CREATED:",
    player.name,
    player.id,
    player.x,
    player.y,
    player.z
  );

  remotePlayerVisuals.set(player.id, {
    group,
    targetPosition: new THREE.Vector3(
      player.x,
      player.y,
      player.z
    ),
    targetYaw: player.yaw
  });

  const remoteDebug = document.getElementById("remoteDebug");
  if (remoteDebug) {
    remoteDebug.textContent =
      `REMOTE: ${remotePlayerVisuals.size} | NETWORK: ${networkPlayers.size}`;
  }
}

function removeRemotePlayer(playerId: string) {
  const visual = remotePlayerVisuals.get(playerId);

  if (!visual) return;

  scene.remove(visual.group);

  visual.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });

  remotePlayerVisuals.delete(playerId);
}

function syncRemotePlayers() {
  for (const [id, player] of networkPlayers) {
    if (id === networkPlayerId) continue;

    let visual = remotePlayerVisuals.get(id);

    if (!visual) {
      createRemotePlayer(player);
      visual = remotePlayerVisuals.get(id);
    }

    if (!visual) continue;

    visual.targetPosition.set(
      player.x,
      player.y,
      player.z
    );

    visual.targetYaw = player.yaw;

    visual.group.visible = true;

    const marker = visual.group.getObjectByName(
      "REMOTE_NAME_MARKER"
    );

    if (marker) {
      marker.visible = player.deploymentState !== "PLANE";
    }
  }

  for (const [id] of remotePlayerVisuals) {
    if (
      id === networkPlayerId ||
      !networkPlayers.has(id)
    ) {
      removeRemotePlayer(id);
    }
  }
}

function updateRemotePlayers(delta: number) {
  syncRemotePlayers();

  const remoteDebug = document.getElementById("remoteDebug");
  if (remoteDebug) {
    remoteDebug.textContent =
      `REMOTE: ${remotePlayerVisuals.size} | NETWORK: ${networkPlayers.size}`;
  }

  const smoothing = Math.min(1, delta * 12);

  for (const visual of remotePlayerVisuals.values()) {
    visual.group.position.lerp(
      visual.targetPosition,
      smoothing
    );

    const networkPlayer = networkPlayers.get(
      visual.group.name.replace("REMOTE_PLAYER_", "")
    );

    const parachute = visual.group.getObjectByName(
      "REMOTE_PARACHUTE"
    );

    if (parachute) {
      parachute.visible =
        networkPlayer?.deploymentState === "PARACHUTE";
    }

    if (networkPlayer?.deploymentState === "FALLING") {
      visual.group.rotation.z = 0.08;
    } else if (networkPlayer?.deploymentState === "PARACHUTE") {
      visual.group.rotation.z = 0;
    } else {
      visual.group.rotation.z = 0;
    }

    let yawDifference =
      visual.targetYaw - visual.group.rotation.y;

    while (yawDifference > Math.PI) {
      yawDifference -= Math.PI * 2;
    }

    while (yawDifference < -Math.PI) {
      yawDifference += Math.PI * 2;
    }

    visual.group.rotation.y +=
      yawDifference * smoothing;
  }
}

function clearRemotePlayers() {
  for (const id of remotePlayerVisuals.keys()) {
    removeRemotePlayer(id);
  }

  remotePlayerVisuals.clear();
}

function connectMultiplayer() {
  if (
    multiplayerSocket &&
    (multiplayerSocket.readyState === WebSocket.OPEN ||
     multiplayerSocket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const multiplayerURL =
    window.location.hostname.includes("app.github.dev")
      ? "wss://didactic-bassoon-r7p6vpgxprwqcprwx-3001.app.github.dev"
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname || "localhost"}:3001`;

  console.log("CONNECTING TO MULTIPLAYER:", multiplayerURL);

  multiplayerSocket = new WebSocket(multiplayerURL);

  multiplayerSocket.addEventListener("open", () => {
    console.log("MULTIPLAYER CONNECTED");

    if (accountToken) {
      setAccountMessage("CHECKING ACCOUNT SESSION...");

      multiplayerSocket?.send(
        JSON.stringify({
          type: "auth_session",
          token: accountToken
        })
      );

      return;
    }

    openAccountUI();

    if (pendingAuthUsername && pendingAuthPassword) {
      const authType =
        accountAuthMode === "login"
          ? "auth_login"
          : "auth_register";

      multiplayerSocket?.send(
        JSON.stringify({
          type: authType,
          username: pendingAuthUsername,
          password: pendingAuthPassword
        })
      );

      setAccountMessage(
        accountAuthMode === "login"
          ? "LOGGING IN..."
          : "ACCOUNT CREATING..."
      );
    } else {
      setAccountMessage("LOGIN OR CREATE AN ACCOUNT");
    }
  });

  multiplayerSocket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === "auth_success") {
        accountToken = String(message.token ?? "");

        accountUsername = String(
          message.account?.username ?? "👑 KING"
        );

        accountLevel = Number(
          message.account?.level ?? 1
        );

        accountXP = Number(
          message.account?.xp ?? 0
        );

        accountCoins = Number(
          message.account?.coins ?? 0
        );

        accountGems = Number(
          message.account?.gems ?? 0
        );

        localStorage.setItem(
          "nexus_account_token",
          accountToken
        );

        updateLobbyAccount();
        updateCharacterAccount();
        showAccountProfile();

        pendingAuthUsername = "";
        pendingAuthPassword = "";

        closeAccountUI();

        console.log(
          `ACCOUNT AUTHENTICATED: ${accountUsername}`
        );

        multiplayerSocket?.send(
          JSON.stringify({
            type: "join",
            name: accountUsername
          })
        );

        return;
      }

      if (message.type === "auth_error") {
        console.error(
          "ACCOUNT ERROR:",
          message.message
        );

        if (message.message === "SESSION EXPIRED") {
          accountToken = "";
          localStorage.removeItem(
            "nexus_account_token"
          );
        }

        openAccountUI();

        setAccountMessage(
          String(
            message.message ?? "ACCOUNT ERROR"
          ),
          true
        );

        return;
      }

      if (message.type === "welcome") {
        networkPlayerId = message.playerId;

        networkPlayers.clear();

        for (const networkPlayer of message.players ?? []) {
          networkPlayers.set(
            networkPlayer.id,
            networkPlayer
          );
        }

        syncRemotePlayers();

        console.log(
          `MULTIPLAYER JOINED — ${networkPlayers.size} PLAYERS`
        );

        console.log(
          "NETWORK DEBUG:",
          {
            localId: networkPlayerId,
            players: Array.from(networkPlayers.values()).map((p) => ({
              id: p.id,
              name: p.name,
              x: p.x,
              y: p.y,
              z: p.z
            })),
            remoteVisuals: remotePlayerVisuals.size
          }
        );

        return;
      }

      if (message.type === "player_joined") {
        networkPlayers.set(
          message.player.id,
          message.player
        );

        syncRemotePlayers();

        console.log(
          `PLAYER JOINED: ${message.player.name}`
        );

        console.log(
          "NETWORK DEBUG:",
          {
            localId: networkPlayerId,
            players: Array.from(networkPlayers.values()).map((p) => ({
              id: p.id,
              name: p.name,
              x: p.x,
              y: p.y,
              z: p.z
            })),
            remoteVisuals: remotePlayerVisuals.size
          }
        );

        return;
      }

      if (message.type === "player_left") {
        networkPlayers.delete(message.playerId);
        removeRemotePlayer(message.playerId);

        console.log(
          `PLAYER LEFT: ${message.playerId}`
        );

        return;
      }

      if (message.type === "players") {
        networkPlayers.clear();

        for (const networkPlayer of message.players ?? []) {
          networkPlayers.set(
            networkPlayer.id,
            networkPlayer
          );
        }

        syncRemotePlayers();

        return;
      }

      if (message.type === "error") {
        console.error(
          "MULTIPLAYER ERROR:",
          message.message
        );

        setAccountMessage(
          String(
            message.message ?? "MULTIPLAYER ERROR"
          ),
          true
        );

        return;
      }
    } catch (error) {
      console.error(
        "NETWORK MESSAGE ERROR:",
        error
      );
    }
  });

  multiplayerSocket.addEventListener("close", () => {
    console.log("MULTIPLAYER DISCONNECTED");

    multiplayerSocket = null;
    networkPlayerId = "";

    networkPlayers.clear();
    clearRemotePlayers();
  });

  multiplayerSocket.addEventListener("error", (error) => {
    console.error(
      "MULTIPLAYER CONNECTION ERROR:",
      error
    );

    setAccountMessage(
      "SERVER CONNECTION FAILED",
      true
    );
  });
}
function restoreAccountSession() {
  const savedToken =
    localStorage.getItem("nexus_account_token") ?? "";

  if (!savedToken) {
    console.log("NO SAVED ACCOUNT SESSION");
    return;
  }

  accountToken = savedToken;

  console.log("SAVED ACCOUNT SESSION FOUND");

  connectMultiplayer();
}

function sendNetworkState() {
  if (
    !multiplayerSocket ||
    multiplayerSocket.readyState !== WebSocket.OPEN ||
    !networkPlayerId ||
    !player
  ) {
    return;
  }

  multiplayerSocket.send(
    JSON.stringify({
      type: "state",
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.rotation.y,
      pitch: camera.rotation.x,
      deploymentState:
        state === "DEPLOYMENT" && deployment
          ? deployment.state
          : "LANDED"
    })
  );
}

if (accountToken) {
  restoreAccountSession();
}

function startMatchmaking() {
  connectMultiplayer();

  if (matchMap) {
    matchMap.textContent = `MAP: ${selectedMap}`;
  }

  if (matchMode) {
    matchMode.textContent = `MODE: ${selectedMode}`;
  }

  setState("MATCHMAKING");

  window.setTimeout(() => {
    startLoading();
  }, 1200);
}

function startLoading() {
  setState("LOADING");

  let progress = 0;

  loadingFill.style.width = "0%";
  loadingPercent.textContent = "0%";

  const interval = window.setInterval(() => {
    progress += 4;

    loadingFill.style.width = `${progress}%`;
    loadingPercent.textContent = `${progress}%`;

    if (progress >= 100) {
      progress = 100;
      window.clearInterval(interval);

      window.setTimeout(() => {
        startDeployment();
      }, 350);
    }
  }, 55);
}

/* =========================================================
   DEPLOYMENT START
========================================================= */

function startDeployment() {
  if (!battleMap) {
    battleMap = new BattleMap(scene);
  }

  safeZone = new SafeZone(scene);
  deployment = new Deployment(scene);

  deployment.start();

  if (player) {
    player.position.copy(deployment.position);

    if (deployment.state === "LANDED") {
      player.position.y = 0;
    }
    player.visible = true;
  }

  setState("DEPLOYMENT");
}

function createPlayerWeapon() {
  const weapon = new THREE.Group();
  weapon.name = "VISIBLE_FPS_RIFLE";

  const gun = new THREE.MeshBasicMaterial({
    color: 0x20252b
  });

  const black = new THREE.MeshBasicMaterial({
    color: 0x080a0d
  });

  const metal = new THREE.MeshBasicMaterial({
    color: 0x59636d
  });

  const skin = new THREE.MeshBasicMaterial({
    color: 0xc88765
  });

  const sleeve = new THREE.MeshBasicMaterial({
    color: 0x111820
  });

  // Main receiver
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.34, 1.15),
    gun
  );
  receiver.position.set(0, 0, 0);
  weapon.add(receiver);

  // Upper rail
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.10, 1.05),
    black
  );
  rail.position.set(0, 0.22, -0.08);
  weapon.add(rail);

  // Barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 1.20, 12),
    metal
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -1.08);
  weapon.add(barrel);

  // Muzzle
  const muzzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.085, 0.22, 12),
    black
  );
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.02, -1.70);
  weapon.add(muzzle);

  // Stock
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.30, 0.55),
    black
  );
  stock.position.set(0, 0, 0.82);
  weapon.add(stock);

  // Magazine
  const magazine = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.52, 0.28),
    black
  );
  magazine.position.set(0, -0.38, 0.12);
  magazine.rotation.x = -0.15;
  weapon.add(magazine);

  // Grip
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.44, 0.22),
    black
  );
  grip.position.set(0, -0.30, 0.43);
  grip.rotation.x = -0.20;
  weapon.add(grip);

  // Front handguard
  const handguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.30, 0.70),
    gun
  );
  handguard.position.set(0, 0, -0.72);
  weapon.add(handguard);

  // Front sight
  const frontSight = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.08),
    black
  );
  frontSight.position.set(0, 0.34, -1.05);
  weapon.add(frontSight);

  // Right arm
  const rightArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.70, 5, 8),
    sleeve
  );
  rightArm.position.set(0.42, -0.58, 0.05);
  rightArm.rotation.set(-0.35, 0, -0.45);
  weapon.add(rightArm);

  // Right hand
  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8),
    skin
  );
  rightHand.position.set(0.27, -0.27, 0.28);
  weapon.add(rightHand);

  // Left arm
  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.70, 5, 8),
    sleeve
  );
  leftArm.position.set(-0.28, -0.58, -0.48);
  leftArm.rotation.set(-0.35, 0, 0.45);
  weapon.add(leftArm);

  // Left hand
  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 8),
    skin
  );
  leftHand.position.set(-0.04, -0.16, -0.72);
  weapon.add(leftHand);

  weapon.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false;
      object.renderOrder = 1000;
      object.material.depthTest = false;
      object.material.depthWrite = false;
    }
  });

  return weapon;
}
function createPlayer() {
  const group = new THREE.Group();

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x263238,
    roughness: 0.72,
    metalness: 0.25
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.8
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc58b68,
    roughness: 0.9
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x090d12,
    roughness: 0.85
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x00d9ff,
    emissive: 0x003344,
    roughness: 0.25,
    metalness: 0.55
  });

  // Torso
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.05, 0.48),
    armorMat
  );
  torso.position.y = 1.55;
  torso.castShadow = true;
  group.add(torso);

  // Chest armor
  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.48, 0.12),
    darkMat
  );
  chest.position.set(0, 1.7, -0.29);
  chest.castShadow = true;
  group.add(chest);

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.2, 0.22, 10),
    skinMat
  );
  neck.position.y = 2.18;
  neck.castShadow = true;
  group.add(neck);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 12),
    skinMat
  );
  head.scale.set(1, 1.08, 0.9);
  head.position.y = 2.48;
  head.castShadow = true;
  group.add(head);

  // Helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.43, 16, 12),
    darkMat
  );
  helmet.scale.set(1, 0.72, 0.95);
  helmet.position.y = 2.67;
  helmet.castShadow = true;
  group.add(helmet);

  // Helmet front visor
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.16, 0.08),
    visorMat
  );
  visor.position.set(0, 2.51, -0.34);
  visor.castShadow = true;
  group.add(visor);

  // Left shoulder
  const leftShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    armorMat
  );
  leftShoulder.position.set(-0.58, 1.92, 0);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  // Right shoulder
  const rightShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    armorMat
  );
  rightShoulder.position.set(0.58, 1.92, 0);
  rightShoulder.castShadow = true;
  group.add(rightShoulder);

  // Left arm
  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.62, 5, 8),
    armorMat
  );
  leftArm.position.set(-0.34, 1.38, -0.18);
  leftArm.rotation.set(-0.45, 0, -0.35);
  leftArm.castShadow = true;
  group.add(leftArm);

  // Right arm
  const rightArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.62, 5, 8),
    armorMat
  );
  rightArm.position.set(0.48, 1.38, -0.22);
  rightArm.rotation.set(-0.35, 0, 0.22);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Left hand
  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 10, 8),
    skinMat
  );
  leftHand.position.set(0.18, 1.25, -0.62);
  leftHand.castShadow = true;
  group.add(leftHand);

  // Right hand
  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 10, 8),
    skinMat
  );
  rightHand.position.set(0.43, 1.12, -0.24);
  rightHand.castShadow = true;
  group.add(rightHand);

  // Waist
  const waist = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.3, 0.44),
    darkMat
  );
  waist.position.y = 0.98;
  waist.castShadow = true;
  group.add(waist);

  // Left leg
  const leftLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.68, 5, 8),
    darkMat
  );
  leftLeg.position.set(-0.22, 0.58, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  // Right leg
  const rightLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.68, 5, 8),
    darkMat
  );
  rightLeg.position.set(0.22, 0.58, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Left boot
  const leftBoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.22, 0.5),
    bootMat
  );
  leftBoot.position.set(-0.22, 0.12, -0.05);
  leftBoot.castShadow = true;
  group.add(leftBoot);

  // Right boot
  const rightBoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.22, 0.5),
    bootMat
  );
  rightBoot.position.set(0.22, 0.12, -0.05);
  rightBoot.castShadow = true;
  group.add(rightBoot);

  group.position.set(0, 0, 0);

  group.userData.velocityY = 0;
  group.userData.grounded = true;

  const weapon = createPlayerWeapon();

  // FPS weapon is rendered from the camera.
  camera.add(weapon);

  weapon.position.set(0.42, -0.38, -0.72);
  weapon.rotation.set(0, 0, 0);

  group.userData.weapon = weapon;

  scene.add(group);

  return group;
}

player = createPlayer();

/* =========================================================
   INPUT
========================================================= */

window.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (
    state === "BATTLE" &&
    event.code === "KeyE" &&
    !event.repeat
  ) {
    pickupNearbyLoot();
  }

  if (
    state === "BATTLE" &&
    !event.repeat
  ) {
    if (event.code === "Digit1") {
      switchWeapon("RIFLE");
    }

    if (event.code === "Digit2") {
      switchWeapon("SMG");
    }

    if (event.code === "Digit3") {
      switchWeapon("SHOTGUN");
    }

    if (event.code === "Digit4") {
      switchWeapon("PISTOL");
    }
  }

  if (
    state === "BATTLE" &&
    event.code === "KeyR" &&
    !event.repeat
  ) {
    reload();
  }

  /* Prevent browser scrolling while playing */
  if (
    state === "DEPLOYMENT" ||
    state === "BATTLE"
  ) {
    if (
      event.code === "Space" ||
      event.code === "ArrowUp" ||
      event.code === "ArrowDown" ||
      event.code === "ArrowLeft" ||
      event.code === "ArrowRight"
    ) {
      event.preventDefault();
    }
  }

  /* AIRCRAFT / PARACHUTE */
  if (
    state === "DEPLOYMENT" &&
    event.code === "Space" &&
    !event.repeat &&
    deployment
  ) {
    if (deployment.state === "PLANE") {
      deployment.jump();
    } else if (
      deployment.state === "FALLING"
    ) {
      deployment.openParachute();
    }
  }

  /* GROUND JUMP */
  if (
    state === "BATTLE" &&
    event.code === "Space" &&
    !event.repeat &&
    player
  ) {
    if (!player.userData.jumpVelocity) {
      player.userData.jumpVelocity = 7;
      player.userData.grounded = true;
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

/* =========================================================
   AIR MOVEMENT
========================================================= */

function updateAirMovement(delta: number) {
  if (!deployment || !player) return;

  if (
    deployment.state !== "FALLING" &&
    deployment.state !== "PARACHUTE"
  ) {
    return;
  }

  const direction = new THREE.Vector3();

  if (
    keys.has("KeyW") ||
    keys.has("ArrowUp")
  ) {
    direction.z -= 1;
  }

  if (
    keys.has("KeyS") ||
    keys.has("ArrowDown")
  ) {
    direction.z += 1;
  }

  if (
    keys.has("KeyA") ||
    keys.has("ArrowLeft")
  ) {
    direction.x -= 1;
  }

  if (
    keys.has("KeyD") ||
    keys.has("ArrowRight")
  ) {
    direction.x += 1;
  }

  if (direction.lengthSq() > 0) {
    direction.normalize();

    direction.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw
    );

    const speed =
      deployment.state === "PARACHUTE"
        ? 18
        : 12;

    deployment.position.x +=
      direction.x * speed * delta;

    deployment.position.z +=
      direction.z * speed * delta;
  }

  deployment.position.x =
    THREE.MathUtils.clamp(
      deployment.position.x,
      -245,
      245
    );

  deployment.position.z =
    THREE.MathUtils.clamp(
      deployment.position.z,
      -245,
      245
    );

  player.position.copy(
    deployment.position
  );

  player.rotation.y = yaw;
}

/* =========================================================
   DEPLOYMENT UPDATE
========================================================= */

let deploymentTime = 15;

function updateDeployment(delta: number) {
  if (!deployment || !player) return;

  deployment.update(delta);

  updateAirMovement(delta);

  syncRemotePlayers();
  updateRemotePlayers(delta);

  player.position.copy(
    deployment.position
  );

  sendNetworkState();

  altitudeValue.textContent =
    Math.max(
      0,
      Math.round(deployment.position.y)
    ).toString();

  deploymentAlive.textContent =
    alivePlayers.toString();

  deploymentStatus.textContent =
    deployment.state === "PLANE"
      ? "WAITING FOR JUMP"
      : deployment.state === "FALLING"
      ? "FREE FALL"
      : deployment.state === "PARACHUTE"
      ? "PARACHUTE OPEN"
      : "LANDED";

  if (deployment.state === "PLANE") {
    deploymentTime -= delta;

    deploymentTimerElement.textContent =
      Math.max(
        0,
        Math.ceil(deploymentTime)
      ).toString();
  }

  if (
    deployment.state === "LANDED"
  ) {
    startBattle();
  }
}

/* =========================================================
   BATTLE
========================================================= */

function startBattle() {

  currentWeapon = "NONE";
  ammo = 0;
  isReloading = false;

  if (fpsWeapon) {
    fpsWeapon.visible = false;
  }

  if (player) {
    player.visible = false;
  }

  camera.rotation.order = "YXZ";

  if (!player) return;

  // TRUE FPP: never render the third-person body.
  player.visible = false;

  if (deployment) {
    player.position.copy(
      deployment.position
    );
  }

  const serverSpawn = networkPlayers.get(networkPlayerId);

  if (serverSpawn) {
    player.position.set(
      serverSpawn.x,
      serverSpawn.y,
      serverSpawn.z
    );

    player.rotation.y = serverSpawn.yaw;
  }

  setState("BATTLE");

  matchStartTime = performance.now();
  matchDamage = 0;

  player.visible = false;

  forceFPP();

  spawnEnemies();
  spawnHouseLoot();

  weaponName.textContent =
    currentWeapon;

  ammoValue.textContent =
    ammo.toString();
}

function createWeaponLoot(
  x: number,
  y: number,
  z: number,
  weapon: LootWeapon
) {
  const loot = new THREE.Group();
  loot.name = `LOOT_${weapon}`;

  const colorMap: Record<LootWeapon, number> = {
    RIFLE: 0x30343a,
    SMG: 0x252a30,
    SHOTGUN: 0x493522,
    PISTOL: 0x17191d
  };

  const weaponMaterial = new THREE.MeshStandardMaterial({
    color: colorMap[weapon],
    roughness: 0.35,
    metalness: 0.75,
    emissive: 0x101820,
    emissiveIntensity: 0.4
  });

  // Main body.
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      weapon === "SHOTGUN" ? 0.28 : 0.24,
      0.22,
      weapon === "RIFLE" ? 1.35 : 0.95
    ),
    weaponMaterial
  );

  body.rotation.y = Math.PI / 2;
  body.castShadow = true;
  loot.add(body);

  // Grip.
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.48, 0.28),
    weaponMaterial
  );

  grip.position.set(0, -0.28, 0.12);
  grip.rotation.x = -0.22;
  grip.castShadow = true;
  loot.add(grip);

  // Muzzle/barrel.
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.055,
      0.055,
      weapon === "RIFLE" ? 0.85 : 0.55,
      8
    ),
    weaponMaterial
  );

  barrel.rotation.z = Math.PI / 2;
  barrel.position.z =
    weapon === "RIFLE" ? -0.95 : -0.68;

  barrel.castShadow = true;
  loot.add(barrel);

  // Bright pickup marker.
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.045, 8, 24),
    new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.9
    })
  );

  glow.rotation.x = Math.PI / 2;
  glow.position.y = 0.08;
  loot.add(glow);

  // Floating pickup beacon.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff
    })
  );

  beacon.position.y = 0.65;
  loot.add(beacon);

  // y is the floor surface. Lift the weapon by half its body height.
  loot.position.set(
    x,
    y + 0.11,
    z
  );

  loot.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false;
      object.renderOrder = 50;
    }
  });

  scene.add(loot);

  const entry: WorldLoot = {
    object: loot,
    weapon,
    ammo: WEAPON_CONFIG[weapon].reserve,
    picked: false
  };

  worldLoot.push(entry);

  return entry;
}

function spawnHouseLoot() {
  // Remove old loot before rebuilding the match.
  for (const loot of worldLoot) {
    scene.remove(loot.object);
  }

  worldLoot.length = 0;

  if (!battleMap) return;

  // Loot is generated ONLY from actual house interiors
  // supplied by BattleMap.
  const weapons: LootWeapon[] = [
    "RIFLE",
    "SMG",
    "SHOTGUN",
    "PISTOL"
  ];

  console.log(
    `HOUSE LOOT SPAWNS: ${battleMap.houseLootSpawns.length}`
  );

  battleMap.houseLootSpawns.forEach((spawn, index) => {
    console.log(
      `LOOT ${index}: ${spawn.x.toFixed(1)}, ${spawn.y.toFixed(1)}, ${spawn.z.toFixed(1)}`
    );
    const weapon =
      weapons[index % weapons.length];

    createWeaponLoot(
      spawn.x,
      spawn.y,
      spawn.z,
      weapon
    );
  });
}

function pickupNearbyLoot() {
  if (!player) return;

  for (const loot of worldLoot) {
    if (loot.picked) continue;

    const distance =
      player.position.distanceTo(
        loot.object.position
      );

    if (distance > 2.4) continue;

    loot.picked = true;
    loot.object.visible = false;

    currentWeapon = loot.weapon;

    const config =
      WEAPON_CONFIG[currentWeapon];

    ammo = config.magazine;

    weaponName.textContent =
      currentWeapon;

    ammoValue.textContent =
      `${ammo} / ${config.reserve}`;

    console.log(
      `PICKED UP ${currentWeapon}`
    );
  }
}

function createEnemy(
  x: number,
  z: number
) {
  const enemy = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.0, 4, 8),
    new THREE.MeshStandardMaterial({
      color: 0x8b1e1e
    })
  );

  body.position.y = 1;
  body.castShadow = true;
  enemy.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x3b1111
    })
  );

  head.position.y = 1.8;
  head.castShadow = true;
  enemy.add(head);

  enemy.position.set(x, 0, z);
  enemy.userData.health = ENEMY_HEALTH;

  scene.add(enemy);
  enemies.push(enemy);

  return enemy;
}

function spawnEnemies() {
  if (enemies.length > 0) return;

  createEnemy(8, -12);
  createEnemy(-12, -20);
  createEnemy(18, -28);
  createEnemy(-20, -8);
  createEnemy(5, -35);
}

function shootEnemy() {
  if (!player) return;

  const raycaster = new THREE.Raycaster();

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  raycaster.set(
    camera.getWorldPosition(new THREE.Vector3()),
    direction
  );

  const targets: THREE.Object3D[] = [];

  for (const enemy of enemies) {
    enemy.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        targets.push(child);
      }
    });
  }

  const hits = raycaster.intersectObjects(
    targets,
    false
  );

  if (hits.length === 0) return;

  let enemy: THREE.Group | null = null;

  let object: THREE.Object3D | null =
    hits[0].object;

  while (object) {
    if (enemies.includes(object as THREE.Group)) {
      enemy = object as THREE.Group;
      break;
    }

    object = object.parent;
  }

  if (!enemy) return;

  enemy.userData.health -=
    getWeaponConfig()!.damage;

  console.log(
    `HIT — Enemy HP: ${enemy.userData.health}`
  );

  if (enemy.userData.health <= 0) {
    scene.remove(enemy);

    const index = enemies.indexOf(enemy);

    if (index !== -1) {
      enemies.splice(index, 1);
    }

    kills++;
    alivePlayers = Math.max(1, alivePlayers - 1);

    console.log(
      `ELIMINATED — Kills: ${kills}`
    );
  }
}

function createBullet() {
  if (!player) return;

  // Aim direction from the center crosshair.
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);

  const raycaster = new THREE.Raycaster();
  raycaster.set(camera.position, direction);

  // Find the point where the tracer should end.
  const rayTargets: THREE.Object3D[] = [];

  scene.traverse((object) => {
    if (
      object instanceof THREE.Mesh &&
      !object.userData.isTracer
    ) {
      rayTargets.push(object);
    }
  });

  const hits = raycaster.intersectObjects(
    rayTargets,
    true
  );

  let distance = 180;

  if (hits.length > 0) {
    distance = Math.min(
      hits[0].distance,
      180
    );
  }

  // Get actual rifle muzzle position.
  const start = camera.position.clone();

  if (fpsWeapon) {
    const muzzleLocal = new THREE.Vector3(
      0,
      0.02,
      -1.70
    );

    fpsWeapon.localToWorld(muzzleLocal);
    start.copy(muzzleLocal);
  } else {
    start.addScaledVector(
      direction,
      0.8
    );
  }

  const endPoint = start.clone()
    .addScaledVector(
      direction,
      distance
    );

  // Main bright tracer.
  const geometry =
    new THREE.BufferGeometry().setFromPoints([
      start,
      endPoint
    ]);

  const material =
    new THREE.LineBasicMaterial({
      color: 0xffd84a,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    });

  const tracer = new THREE.Line(
    geometry,
    material
  );

  tracer.name = "BULLET_TRACER";
  tracer.userData.isTracer = true;
  tracer.renderOrder = 10001;

  scene.add(tracer);

  // Bright tracer core.
  const coreGeometry =
    new THREE.BufferGeometry().setFromPoints([
      start,
      endPoint
    ]);

  const coreMaterial =
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false
    });

  const core = new THREE.Line(
    coreGeometry,
    coreMaterial
  );

  core.name = "BULLET_CORE";
  core.userData.isTracer = true;
  core.renderOrder = 10002;

  scene.add(core);

  // Muzzle flash.
  if (fpsWeapon) {
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.13,
        8,
        8
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffb300,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false
      })
    );

    flash.name = "MUZZLE_FLASH";
    flash.userData.isTracer = true;
    flash.renderOrder = 10003;

    const flashPosition =
      new THREE.Vector3(
        0,
        0.02,
        -1.82
      );

    fpsWeapon.localToWorld(
      flashPosition
    );

    flash.position.copy(
      flashPosition
    );

    scene.add(flash);

    window.setTimeout(() => {
      scene.remove(flash);

      flash.geometry.dispose();

      if (
        flash.material instanceof
        THREE.Material
      ) {
        flash.material.dispose();
      }
    }, 70);
  }

  // Remove tracer quickly for a fast professional
  // hitscan-style visual.
  window.setTimeout(() => {
    scene.remove(tracer);
    scene.remove(core);

    geometry.dispose();
    coreGeometry.dispose();

    material.dispose();
    coreMaterial.dispose();
  }, 90);
}

function updateBullets(delta: number) {
  // Tracers are instant visual effects.
  // Actual hit detection remains raycast based.
}



function shoot() {
  if (
    state !== "BATTLE" ||
    currentWeapon === "NONE" ||
    isReloading ||
    !player
  ) {
    return;
  }

  const now = performance.now();

  const weaponConfig =
    WEAPON_CONFIG[currentWeapon];

  if (
    now - lastShotTime <
    weaponConfig.fireRate
  ) {
    return;
  }

  if (ammo <= 0) {
    reload();
    return;
  }

  lastShotTime = now;
  ammo--;

  // -----------------------------
  // Weapon recoil
  // -----------------------------
  weaponRecoil = Math.min(
    weaponRecoil + 0.12,
    0.42
  );

  weaponRecoilSide +=
    (Math.random() - 0.5) * 0.07;

  muzzleFlashTime = 0.075;

  // -----------------------------
  // Actual hit detection
  // -----------------------------
  shootEnemy();

  // -----------------------------
  // Professional tracer
  // -----------------------------
  createBullet();

  // -----------------------------
  // Muzzle flash
  // -----------------------------
  if (fpsWeapon) {
    const muzzlePosition =
      new THREE.Vector3(
        0,
        0.02,
        -1.82
      );

    fpsWeapon.localToWorld(
      muzzlePosition
    );

    const flashGroup =
      new THREE.Group();

    flashGroup.position.copy(
      muzzlePosition
    );

    const flashMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xff9d00,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false
      });

    const flash = new THREE.Mesh(
      new THREE.ConeGeometry(
        0.20,
        0.55,
        8
      ),
      flashMaterial
    );

    flash.rotation.x =
      -Math.PI / 2;

    flash.scale.set(
      1.0,
      1.0,
      1.5
    );

    flashGroup.add(flash);

    // Inner white-hot flash
    const coreMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xffffdd,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false
      });

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.105,
        8,
        8
      ),
      coreMaterial
    );

    flashGroup.add(core);

    scene.add(flashGroup);

    flashGroup.traverse(
      (object) => {
        object.renderOrder = 10005;
      }
    );

    window.setTimeout(() => {
      scene.remove(flashGroup);

      flashGroup.traverse(
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
    }, 65);

    // -----------------------------
    // Muzzle light burst
    // -----------------------------
    const muzzleLight =
      new THREE.PointLight(
        0xffaa33,
        7,
        8
      );

    muzzleLight.position.copy(
      muzzlePosition
    );

    scene.add(muzzleLight);

    window.setTimeout(() => {
      scene.remove(muzzleLight);
    }, 55);

    // -----------------------------
    // Ejected shell casing
    // -----------------------------
    const casing = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.025,
        0.025,
        0.11,
        8
      ),
      new THREE.MeshBasicMaterial({
        color: 0xc79b3b
      })
    );

    const casingStart =
      new THREE.Vector3(
        0.20,
        -0.12,
        0.25
      );

    fpsWeapon.localToWorld(
      casingStart
    );

    casing.position.copy(
      casingStart
    );

    casing.rotation.set(
      Math.random() * 2,
      Math.random() * 2,
      Math.random() * 2
    );

    casing.userData.velocity =
      new THREE.Vector3(
        0.9 + Math.random() * 0.5,
        1.1 + Math.random() * 0.7,
        0.1 + Math.random() * 0.4
      );

    casing.userData.life = 0;

    scene.add(casing);

    const casingTimer =
      window.setInterval(() => {
        casing.userData.life += 0.016;

        const velocity =
          casing.userData.velocity as THREE.Vector3;

        velocity.y -= 4.5 * 0.016;

        casing.position.addScaledVector(
          velocity,
          0.016
        );

        casing.rotation.x += 0.25;
        casing.rotation.z += 0.18;

        if (
          casing.position.y <=
            player!.position.y + 0.05 ||
          casing.userData.life > 1.5
        ) {
          window.clearInterval(
            casingTimer
          );

          scene.remove(casing);
          casing.geometry.dispose();

          if (
            casing.material instanceof
            THREE.Material
          ) {
            casing.material.dispose();
          }
        }
      }, 16);
  }

  updateHUD();

  console.log(
    `FIRE — ${ammo}/${MAGAZINE_SIZE}`
  );
}


function getGLBWeaponModel(weapon: WeaponName): THREE.Group | null {
  if (weapon === "PISTOL") return pistolGLB;
  if (weapon === "RIFLE") return rifleGLB;
  return null;
}

function showEquippedGLBWeapon() {
  if (pistolGLB) pistolGLB.visible = false;
  if (rifleGLB) rifleGLB.visible = false;

  const model = getGLBWeaponModel(currentWeapon);

  if (!model) {
    if (fpsWeapon) fpsWeapon.visible = false;
    return;
  }

  if (fpsWeapon) fpsWeapon.visible = false;

  model.visible = true;
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.setScalar(
    currentWeapon === "PISTOL" ? 0.35 : 1.0
  );

  model.traverse((object) => {
    object.visible = true;

    if (object instanceof THREE.Mesh) {
      object.frustumCulled = false;
      object.renderOrder = 10000;

      if (object.material instanceof THREE.Material) {
        object.material.depthTest = false;
        object.material.depthWrite = false;
      }
    }
  });
}

function switchWeapon(weapon: WeaponName) {
  if (currentWeapon === weapon) return;

  currentWeapon = weapon;

  const config = getWeaponConfig();
  if (!config) return;

  ammo = config.magazine;
  isReloading = false;
  weaponRecoil = 0;
  weaponRecoilSide = 0;

  weaponName.textContent = currentWeapon;
  ammoValue.textContent =
    `${ammo} / ${config.reserve}`;

  const slotMap: Record<string, string> = {
    RIFLE: "weaponSlot1",
    SMG: "weaponSlot2",
    SHOTGUN: "weaponSlot3",
    PISTOL: "weaponSlot4"
  };

  document.querySelectorAll(".weaponSlot").forEach((slot) => {
    slot.classList.remove("active");
  });

  const activeSlot = document.getElementById(
    slotMap[currentWeapon]
  );

  activeSlot?.classList.add("active");

  const activeAmmo = document.getElementById(
    `slotAmmo${["RIFLE", "SMG", "SHOTGUN", "PISTOL"].indexOf(currentWeapon) + 1}`
  );

  if (activeAmmo) {
    activeAmmo.textContent = `${ammo}`;
  }

  console.log(`WEAPON: ${currentWeapon}`);
}

function reload() {
  if (
    state !== "BATTLE" ||
    isReloading ||
    ammo >= getWeaponConfig()!.magazine
  ) {
    return;
  }

  isReloading = true;

  console.log("RELOADING...");

  window.setTimeout(() => {
    ammo = getWeaponConfig()!.magazine;
    isReloading = false;

    console.log("RELOADED");

    updateHUD();
  }, RELOAD_TIME);
}

function updateWeaponSlots() {
  const weapons = ["RIFLE", "SMG", "SHOTGUN", "PISTOL"] as const;

  weapons.forEach((weapon, index) => {
    const slotAmmo = document.getElementById(
      `slotAmmo${index + 1}`
    );

    if (!slotAmmo) return;

    if (currentWeapon === weapon) {
      slotAmmo.textContent = `${ammo}`;
    } else {
      slotAmmo.textContent =
        `${WEAPON_CONFIG[weapon].magazine}`;
    }
  });

  document.querySelectorAll(".weaponSlot").forEach((slot) => {
    slot.classList.remove("active");
  });

  if (currentWeapon !== "NONE") {
    const slotMap: Record<string, string> = {
      RIFLE: "weaponSlot1",
      SMG: "weaponSlot2",
      SHOTGUN: "weaponSlot3",
      PISTOL: "weaponSlot4"
    };

    document
      .getElementById(slotMap[currentWeapon])
      ?.classList.add("active");
  }
}

function updateHUD() {
  // -----------------------------
  // PLAYER HEALTH / ARMOR
  // -----------------------------
  healthValue.textContent =
    Math.max(0, Math.round(playerHealth)).toString();

  healthFill.style.width =
    `${Math.max(0, Math.min(100, playerHealth))}%`;

  armorValue.textContent =
    Math.max(0, Math.round(playerArmor)).toString();

  // -----------------------------
  // WEAPON HUD
  // -----------------------------
  updateWeaponSlots();

  const config = getWeaponConfig();

  if (!config) {
    weaponName.textContent = currentWeapon;
    ammoValue.textContent = "0";
    return;
  }

  weaponName.textContent =
    currentWeapon;

  ammoValue.textContent =
    `${ammo} / ${config.reserve}`;
}


function updateFirstPersonCamera() {
  if (!player) return;

  // TRUE FIRST-PERSON
  // Hide the complete player body.
  player.visible = false;

  // Camera is located at the player's eyes.
  camera.position.x = player.position.x;
  camera.position.y = player.position.y + 2.35;
  camera.position.z = player.position.z;

  // FPS mouse look.
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.rotation.z = 0;
}

function forceFPP() {
  if (state !== "BATTLE" || !player) return;

  player.visible = false;

  camera.position.set(
    player.position.x,
    player.position.y + 2.35,
    player.position.z
  );

  camera.rotation.order = "YXZ";
  camera.rotation.x =
    pitch - weaponRecoil * 0.16;

  camera.rotation.y =
    yaw + weaponRecoilSide * 0.35;

  camera.rotation.z = 0;

  // Professional FPS ADS FOV.
  const targetFOV =
    isAiming ? 48 : 65;

  camera.fov = THREE.MathUtils.lerp(
    camera.fov,
    targetFOV,
    0.12
  );

  camera.updateProjectionMatrix();

  const glbWeapon = getGLBWeaponModel(currentWeapon);

  if (glbWeapon) {
    showEquippedGLBWeapon();
  } else {
    if (!fpsWeapon) {
      fpsWeapon = createPlayerWeapon();
      fpsWeapon.name = "FPS_PLACEHOLDER";
      scene.add(fpsWeapon);
    }

    if (fpsWeapon.parent !== scene) {
      if (fpsWeapon.parent) {
        fpsWeapon.parent.remove(fpsWeapon);
      }

      scene.add(fpsWeapon);
    }

    fpsWeapon.visible = true;
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  camera.getWorldDirection(forward);

  right.set(1, 0, 0)
    .applyQuaternion(camera.quaternion);

  up.set(0, 1, 0)
    .applyQuaternion(camera.quaternion);

  // Lower-right FPS weapon position.
  const gunPosition = camera.position.clone();

  gunPosition.addScaledVector(forward, 1.05);
  gunPosition.addScaledVector(right, 0.85);
  gunPosition.addScaledVector(up, -0.82);

  if (glbWeapon) {
    glbWeapon.position.copy(gunPosition);
    glbWeapon.quaternion.copy(camera.quaternion);

    glbWeapon.rotateX(-0.18);
    glbWeapon.rotateY(-0.16);
    glbWeapon.rotateZ(-0.08);
  } else if (fpsWeapon) {
    fpsWeapon.position.copy(gunPosition);
  }

  // Weapon follows aim.
  if (glbWeapon) {
    glbWeapon.quaternion.copy(camera.quaternion);

    // Natural FPS weapon angle.
    glbWeapon.rotateX(-0.18);
    glbWeapon.rotateY(-0.16);
    glbWeapon.rotateZ(-0.08);
  } else if (fpsWeapon) {
    fpsWeapon.quaternion.copy(camera.quaternion);

    // Natural FPS rifle angle.
    fpsWeapon.rotateX(-0.18);
    fpsWeapon.rotateY(-0.16);
    fpsWeapon.rotateZ(-0.08);

    fpsWeapon.scale.setScalar(1.45);

    fpsWeapon.traverse((object) => {
      object.visible = true;

      if (object instanceof THREE.Mesh) {
        object.frustumCulled = false;
        object.renderOrder = 10000;

        if (object.material instanceof THREE.Material) {
          object.material.depthTest = false;
          object.material.depthWrite = false;
        }
      }
    });
  }
}

function updateBattle(delta: number) {
  syncRemotePlayers();
  updateRemotePlayers(delta);

  sendNetworkState();

  if (!player) return;

  // -----------------------------
  // PLAYER MOVEMENT
  // -----------------------------
  const direction = new THREE.Vector3();

  if (keys.has("KeyW") || keys.has("ArrowUp")) {
    direction.z -= 1;
  }

  if (keys.has("KeyS") || keys.has("ArrowDown")) {
    direction.z += 1;
  }

  if (keys.has("KeyA") || keys.has("ArrowLeft")) {
    direction.x -= 1;
  }

  if (keys.has("KeyD") || keys.has("ArrowRight")) {
    direction.x += 1;
  }

  if (direction.lengthSq() > 0) {
    direction.normalize();

    direction.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw
    );

    const moveSpeed = keys.has("ShiftLeft") ||
      keys.has("ShiftRight")
      ? 9
      : 5.5;

    const nextPosition =
      player.position.clone();

    nextPosition.x +=
      direction.x * moveSpeed * delta;

    nextPosition.z +=
      direction.z * moveSpeed * delta;

    // Map bounds.
    nextPosition.x = THREE.MathUtils.clamp(
      nextPosition.x,
      -245,
      245
    );

    nextPosition.z = THREE.MathUtils.clamp(
      nextPosition.z,
      -245,
      245
    );

    // Simple player-radius collision.
    const playerRadius = 0.45;

    const blocked = battleMap?.colliders.some(
      (box) =>
        nextPosition.x > box.min.x - playerRadius &&
        nextPosition.x < box.max.x + playerRadius &&
        nextPosition.z > box.min.z - playerRadius &&
        nextPosition.z < box.max.z + playerRadius
    );

    if (!blocked) {
      player.position.x = nextPosition.x;
      player.position.z = nextPosition.z;
    }
  }

  // -----------------------------
  // JUMP + GRAVITY
  // -----------------------------
  let jumpVelocity =
    Number(player.userData.jumpVelocity ?? 0);

  let grounded =
    Boolean(player.userData.grounded ?? false);

  if (!grounded || jumpVelocity > 0) {
    jumpVelocity -= 20 * delta;

    player.position.y +=
      jumpVelocity * delta;
  }

  // -----------------------------
  // INTERIOR / STAIR FLOOR
  // -----------------------------
  const interiorFloor =
    battleMap?.getInteriorFloorY(
      player.position.x,
      player.position.z,
      player.position.y
    ) ?? null;

  const targetFloor =
    interiorFloor !== null
      ? interiorFloor
      : 0;

  if (
    player.position.y <= targetFloor &&
    jumpVelocity <= 0
  ) {
    player.position.y = targetFloor;
    jumpVelocity = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  player.userData.jumpVelocity =
    jumpVelocity;

  player.userData.grounded =
    grounded;

  // -----------------------------
  // ENEMY AI
  // -----------------------------
  const playerPosition =
    player.position.clone();

  for (const enemy of [...enemies]) {
    if (!enemy.parent) continue;

    const toPlayer =
      playerPosition
        .clone()
        .sub(enemy.position);

    toPlayer.y = 0;

    const distance =
      toPlayer.length();

    let cooldown =
      enemyAttackCooldown.get(enemy) ?? 0;

    cooldown -= delta * 1000;

    if (distance > enemyAttackRange) {
      if (distance > 0.1) {
        toPlayer.normalize();

        enemy.position.addScaledVector(
          toPlayer,
          enemyMoveSpeed * delta
        );

        enemy.rotation.y =
          Math.atan2(
            toPlayer.x,
            toPlayer.z
          );
      }
    } else {
      if (distance > 0.1) {
        enemy.rotation.y =
          Math.atan2(
            toPlayer.x,
            toPlayer.z
          );
      }

      if (cooldown <= 0) {
        const damageTaken =
          Math.min(
            playerHealth,
            enemyAttackDamage
          );

        playerHealth =
          Math.max(
            0,
            playerHealth -
              damageTaken
          );

        enemyAttackCooldown.set(
          enemy,
          enemyAttackRate
        );

        console.log(
          `ENEMY ATTACK — Player HP: ${playerHealth}`
        );

        updateHUD();

        if (playerHealth <= 0) {
          console.log(
            "PLAYER ELIMINATED"
          );

          openGameOverScreen();
          return;
        }
      }
    }

    enemyAttackCooldown.set(
      enemy,
      Math.max(0, cooldown)
    );
  }

  // -----------------------------
  // SAFE ZONE
  // -----------------------------
  if (safeZone) {
    safeZone.update(delta);

    const distanceFromCenter =
      Math.hypot(
        player.position.x,
        player.position.z
      );

    if (
      distanceFromCenter >
      safeZone.radius
    ) {
      playerHealth =
        Math.max(
          0,
          playerHealth -
            delta * 4
        );

      updateHUD();

      if (playerHealth <= 0) {
        console.log(
          "ELIMINATED BY ZONE"
        );

        openGameOverScreen();
        return;
      }
    }
  }

  updateBullets(delta);
  forceFPP();
}

function updateCamera() {
  if (!player) return;

  const offset = new THREE.Vector3(
    0,
    5,
    9
  );

  offset.applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    yaw
  );

  camera.position
    .copy(player.position)
    .add(offset);

  const lookAt = player.position.clone();

  lookAt.y += 1.2;

  camera.lookAt(lookAt);
}

/* =========================================================
   MOUSE LOOK
========================================================= */

window.addEventListener(
  "mousemove",
  (event) => {
    if (
      state !== "BATTLE" &&
      state !== "DEPLOYMENT"
    ) {
      return;
    }

    yaw -= event.movementX * 0.002;

    pitch -= event.movementY * 0.002;

    pitch = THREE.MathUtils.clamp(
      pitch,
      -1.2,
      1.0
    );
  }
);

/* =========================================================
   SHOOT
========================================================= */

window.addEventListener(
  "mousedown",
  (event) => {
    if (
      state !== "BATTLE" ||
      event.button !== 0
    ) {
      return;
    }

    if (ammo > 0) {
      ammo--;

      ammoValue.textContent =
        ammo.toString();
    }
  }
);

/* =========================================================
   RETURN TO LOBBY
========================================================= */

function openGameOverScreen() {
  if (state === "RESULTS") return;

  const placement =
    Math.max(
      1,
      Math.min(
        50,
        alivePlayers + kills
      )
    );

  const survivedSeconds =
    matchStartTime > 0
      ? Math.max(
          0,
          Math.floor(
            (performance.now() -
              matchStartTime) /
              1000
          )
        )
      : 0;

  const minutes =
    Math.floor(
      survivedSeconds / 60
    )
      .toString()
      .padStart(2, "0");

  const seconds =
    (survivedSeconds % 60)
      .toString()
      .padStart(2, "0");

  placementValue.textContent =
    placement.toString();

  resultKills.textContent =
    kills.toString();

  resultAlive.textContent =
    alivePlayers.toString();

  resultDamage.textContent =
    Math.round(matchDamage).toString();

  resultTime.textContent =
    `${minutes}:${seconds}`;

  resultWeapon.textContent =
    currentWeapon;

  // Release FPS mouse lock when the player dies.
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  document.body.style.cursor = "default";
  renderer.domElement.style.cursor = "default";

  setState("RESULTS");

  if (fpsWeapon) {
    fpsWeapon.visible = false;
  }

  if (player) {
    player.visible = false;
  }

  console.log(
    `GAME OVER — Rank #${placement} — Kills: ${kills}`
  );
}

returnButton.addEventListener(
  "click",
  () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    document.body.style.cursor = "default";
    renderer.domElement.style.cursor = "default";

    if (deployment) {
      deployment.dispose();
      deployment = null;
    }

    playerHealth = 100;
    playerArmor = 50;
    alivePlayers = 50;
    kills = 0;
    ammo = 0;
    medkits = 0;
    currentWeapon = "NONE";
    deploymentTime = 15;

    if (player) {
      player.position.set(
        0,
        1,
        0
      );
      player.visible = false;
    }

    battleMap = null;
    safeZone = null;

    setState("LOBBY");
  }
);

/* =========================================================
   INITIAL STATE
========================================================= */

player.visible = false;

setState("LOBBY");

/* =========================================================
   GAME LOOP
========================================================= */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta =
    Math.min(clock.getDelta(), 0.05);

  if (state === "DEPLOYMENT") {
    updateDeployment(delta);
  }

  if (state === "BATTLE") {
    updateBattle(delta);
    
    if (state === "BATTLE" && isShooting) {
      shoot();
    }
  }

  if (
    state === "DEPLOYMENT" ||
    state === "BATTLE"
  ) {
    updateCamera();
  }

  if (state === "BATTLE") {


    forceFPP();


  }



  if (state === "BATTLE") {
    forceFPP();
  }

  // FINAL FPS CAMERA + WEAPON UPDATE
  if (state === "BATTLE") {
    forceFPP();
  }

  renderer.render(scene, camera);
}

animate();

/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {
    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  }
);

/* =========================================================
   3D PUBG-STYLE LOBBY
========================================================= */

function setupLobbyCamera() {
  if (!player) return;

  player.visible = true;
  player.position.set(0, 1, 0);
  player.rotation.y = Math.PI;

  camera.position.set(
    0,
    3.8,
    15
  );

  camera.lookAt(
    0,
    1.35,
    0
  );
}

setupLobbyCamera();

