import { WebSocketServer, WebSocket } from "ws";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";

const PORT = Number(process.env.PORT ?? 3001);
const MAX_PLAYERS = 50;
const ACCOUNTS_FILE = "server/accounts.json";
const SESSIONS_FILE = "server/sessions.json";

type Account = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  createdAt: string;
  sessionToken?: string;
};

const accounts = new Map<string, Account>();
const sessions = new Map<string, string>();

function loadSessions() {
  if (!existsSync(SESSIONS_FILE)) return;

  try {
    const data = JSON.parse(
      readFileSync(SESSIONS_FILE, "utf8")
    ) as Record<string, string>;

    sessions.clear();

    for (const [token, accountId] of Object.entries(data)) {
      if (typeof token === "string" && typeof accountId === "string") {
        sessions.set(token, accountId);
      }
    }

    console.log(
      `SESSIONS LOADED: ${sessions.size}`
    );
  } catch (error) {
    console.error(
      "FAILED TO LOAD SESSIONS:",
      error
    );
  }
}

function saveSessions() {
  try {
    const data = Object.fromEntries(sessions);

    writeFileSync(
      SESSIONS_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error(
      "FAILED TO SAVE SESSIONS:",
      error
    );
  }
}

function loadAccounts() {
  if (!existsSync(ACCOUNTS_FILE)) return;

  try {
    const data = JSON.parse(
      readFileSync(ACCOUNTS_FILE, "utf8")
    ) as Account[];

    for (const account of data) {
      if (account?.id && account?.username) {
        accounts.set(
          account.username.toLowerCase(),
          account
        );
      }
    }

    console.log(`ACCOUNTS LOADED: ${accounts.size}`);
  } catch (error) {
    console.error("ACCOUNT LOAD ERROR:", error);
  }
}

function saveAccounts() {
  writeFileSync(
    ACCOUNTS_FILE,
    JSON.stringify(
      Array.from(accounts.values()),
      null,
      2
    )
  );
}

function hashPassword(password: string, salt: string) {
  return scryptSync(
    password,
    salt,
    64
  ).toString("hex");
}

function createPassword(password: string) {
  const salt = randomBytes(16).toString("hex");

  return {
    salt,
    hash: hashPassword(password, salt)
  };
}

function verifyPassword(
  password: string,
  account: Account
) {
  const hash = Buffer.from(
    hashPassword(password, account.passwordSalt),
    "hex"
  );

  const stored = Buffer.from(
    account.passwordHash,
    "hex"
  );

  return (
    hash.length === stored.length &&
    timingSafeEqual(hash, stored)
  );
}

function validUsername(username: string) {
  return /^[A-Za-z0-9_]{3,16}$/.test(username);
}

function validPassword(password: string) {
  return password.length >= 6 && password.length <= 72;
}

loadAccounts();
loadSessions();

type Player = {
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

type ClientMessage =
  | {
      type: "auth_register";
      username: string;
      password: string;
    }
  | {
      type: "auth_login";
      username: string;
      password: string;
    }
  | {
      type: "auth_session";
      token: string;
    }
  | {
      type: "logout";
    }
  | {
      type: "join";
      name?: string;
    }
  | {
      type: "state";
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      deploymentState?: "PLANE" | "FALLING" | "PARACHUTE" | "LANDED";
    };

type ServerMessage =
  | {
      type: "auth_required";
    }
  | {
      type: "auth_success";
      token: string;
      account: {
        id: string;
        username: string;
        level: number;
        xp: number;
        coins: number;
        gems: number;
      };
    }
  | {
      type: "auth_error";
      message: string;
    }
  | {
      type: "welcome";
      playerId: string;
      players: Player[];
    }
  | {
      type: "player_joined";
      player: Player;
    }
  | {
      type: "player_left";
      playerId: string;
    }
  | {
      type: "players";
      players: Player[];
    }
  | {
      type: "error";
      message: string;
    };

const wss = new WebSocketServer({ port: PORT });

const clients = new Map<WebSocket, Player>();
const players = new Map<string, Player>();
const authenticatedSockets = new Map<WebSocket, Account>();

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
}

function broadcast(message: ServerMessage, except?: WebSocket) {
  const data = JSON.stringify(message);

  for (const ws of clients.keys()) {
    if (ws === except) continue;
    if (ws.readyState !== WebSocket.OPEN) continue;

    ws.send(data);
  }
}

function createPlayer(name = "PLAYER"): Player {
  const spawnIndex = players.size;
  const spawnAngle = spawnIndex * 1.2;
  const spawnRadius = 8;

  return {
    id: randomUUID(),
    name: name.slice(0, 16) || "PLAYER",
    x: Math.cos(spawnAngle) * spawnRadius,
    y: 0,
    z: Math.sin(spawnAngle) * spawnRadius,
    yaw: -spawnAngle,
    pitch: 0,
    health: 100,
    armor: 50,
    kills: 0
  };
}

wss.on("connection", (ws) => {
  console.log("CLIENT CONNECTED");

  ws.on("message", (raw) => {
    let message: ClientMessage;

    try {
      message = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      send(ws, {
        type: "error",
        message: "Invalid JSON message."
      });
      return;
    }

    if (message.type === "auth_register") {
      const username = String(message.username ?? "").trim();
      const password = String(message.password ?? "");

      if (!validUsername(username)) {
        send(ws, {
          type: "auth_error",
          message: "USERNAME MUST BE 3-16 CHARACTERS: A-Z, 0-9 OR _"
        });
        return;
      }

      if (!validPassword(password)) {
        send(ws, {
          type: "auth_error",
          message: "PASSWORD MUST BE 6-72 CHARACTERS"
        });
        return;
      }

      const key = username.toLowerCase();

      if (accounts.has(key)) {
        send(ws, {
          type: "auth_error",
          message: "USERNAME ALREADY EXISTS"
        });
        return;
      }

      const passwordData = createPassword(password);

      const account: Account = {
        id: randomUUID(),
        username,
        passwordHash: passwordData.hash,
        passwordSalt: passwordData.salt,
        level: 1,
        xp: 0,
        coins: 2450,
        gems: 120,
        createdAt: new Date().toISOString()
      };

      accounts.set(key, account);
      saveAccounts();

      const token = randomUUID();

      account.sessionToken = token;
      accounts.set(key, account);

      sessions.set(token, account.id);
      saveSessions();
      saveAccounts();

      authenticatedSockets.set(ws, account);

      send(ws, {
        type: "auth_success",
        token,
        account: {
          id: account.id,
          username: account.username,
          level: account.level,
          xp: account.xp,
          coins: account.coins,
          gems: account.gems
        }
      });

      console.log(`ACCOUNT CREATED: ${account.username}`);
      return;
    }

    if (message.type === "auth_login") {
      const username = String(message.username ?? "").trim();
      const password = String(message.password ?? "");

      const account = accounts.get(
        username.toLowerCase()
      );

      if (!account || !verifyPassword(password, account)) {
        send(ws, {
          type: "auth_error",
          message: "INVALID USERNAME OR PASSWORD"
        });
        return;
      }

      const token = randomUUID();

      account.sessionToken = token;
      accounts.set(
        account.username.toLowerCase(),
        account
      );

      sessions.set(token, account.id);
      saveSessions();
      saveAccounts();

      authenticatedSockets.set(ws, account);

      send(ws, {
        type: "auth_success",
        token,
        account: {
          id: account.id,
          username: account.username,
          level: account.level,
          xp: account.xp,
          coins: account.coins,
          gems: account.gems
        }
      });

      console.log(`ACCOUNT LOGIN: ${account.username}`);
      return;
    }

    if (message.type === "auth_session") {
      const token = String(message.token ?? "");

      let account = Array.from(accounts.values()).find(
        (item) => item.sessionToken === token
      );

      if (!account) {
        const accountId = sessions.get(token);

        if (accountId) {
          account = Array.from(accounts.values()).find(
            (item) => item.id === accountId
          );
        }
      }

      if (!account) {
        send(ws, {
          type: "auth_error",
          message: "SESSION EXPIRED"
        });
        return;
      }

      if (!account) {
        sessions.delete(token);
        saveSessions();

        send(ws, {
          type: "auth_error",
          message: "ACCOUNT NOT FOUND"
        });
        return;
      }

      authenticatedSockets.set(ws, account);

      send(ws, {
        type: "auth_success",
        token,
        account: {
          id: account.id,
          username: account.username,
          level: account.level,
          xp: account.xp,
          coins: account.coins,
          gems: account.gems
        }
      });

      return;
    }

    if (message.type === "logout") {
      const account = authenticatedSockets.get(ws);

      if (account?.sessionToken) {
        sessions.delete(account.sessionToken);
        account.sessionToken = undefined;

        accounts.set(
          account.username.toLowerCase(),
          account
        );

        saveAccounts();
        saveSessions();
      }

      authenticatedSockets.delete(ws);
      return;
    }

    if (message.type === "join") {
      if (!authenticatedSockets.has(ws)) {
        send(ws, {
          type: "auth_error",
          message: "LOGIN REQUIRED"
        });
        return;
      }

      if (clients.has(ws)) return;

      if (players.size >= MAX_PLAYERS) {
        send(ws, {
          type: "error",
          message: "MATCH FULL"
        });
        ws.close();
        return;
      }

      const account = authenticatedSockets.get(ws);

      const player = createPlayer(
        account?.username ?? message.name ?? "PLAYER"
      );

      clients.set(ws, player);
      players.set(player.id, player);

      send(ws, {
        type: "welcome",
        playerId: player.id,
        players: Array.from(players.values())
      });

      broadcast(
        {
          type: "player_joined",
          player
        },
        ws
      );

      console.log(
        `PLAYER JOINED: ${player.name} (${player.id}) — ${players.size}/${MAX_PLAYERS}`
      );

      return;
    }

    const player = clients.get(ws);

    if (!player) {
      send(ws, {
        type: "error",
        message: "JOIN THE MATCH FIRST."
      });
      return;
    }

    if (message.type === "state") {
      player.x = Number.isFinite(message.x) ? message.x : player.x;
      player.y = Number.isFinite(message.y) ? message.y : player.y;
      player.z = Number.isFinite(message.z) ? message.z : player.z;
      player.yaw = Number.isFinite(message.yaw) ? message.yaw : player.yaw;
      player.pitch = Number.isFinite(message.pitch)
        ? message.pitch
        : player.pitch;

      if (
        message.deploymentState === "PLANE" ||
        message.deploymentState === "FALLING" ||
        message.deploymentState === "PARACHUTE" ||
        message.deploymentState === "LANDED"
      ) {
        player.deploymentState = message.deploymentState;
      }

      broadcast(
        {
          type: "players",
          players: Array.from(players.values())
        }
      );
    }
  });

  ws.on("close", () => {
    const player = clients.get(ws);

    if (!player) return;

    clients.delete(ws);
    players.delete(player.id);
    authenticatedSockets.delete(ws);

    broadcast({
      type: "player_left",
      playerId: player.id
    });

    console.log(
      `PLAYER LEFT: ${player.name} — ${players.size}/${MAX_PLAYERS}`
    );
  });

  ws.on("error", (error) => {
    console.error("WEBSOCKET ERROR:", error);
  });
});

setInterval(() => {
  if (players.size === 0) return;

  broadcast({
    type: "players",
    players: Array.from(players.values())
  });
}, 100);

console.log(`NEXUS MULTIPLAYER SERVER`);
console.log(`WebSocket: ws://localhost:${PORT}`);
console.log(`MAX PLAYERS: ${MAX_PLAYERS}`);
