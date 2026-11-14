import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import { DatabaseSync } from "node:sqlite";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SKILLS,
  TICK_MS,
  type Account,
  type Activity,
  type Credentials,
  type Snapshot,
} from "@idler/contracts";
import {
  createCharacter,
  reconcile,
  selectActivity,
  type StoredCharacter,
} from "./engine.ts";

interface AccountRow extends Account {
  salt: string;
  password_hash: string;
}
interface CharacterRow {
  account_id: string;
  state: string;
}
export interface AppOptions {
  dbPath?: string;
  now?: () => number;
  startTicker?: boolean;
  serveWeb?: boolean;
}
const SESSION_NAME = "idler_session";
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const publicAccount = (row: AccountRow): Account => ({
  id: row.id,
  username: row.username,
});
const credentialPattern = /^[A-Za-z0-9_]{3,24}$/;
function object(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}
function exact(body: Record<string, unknown>, keys: string[]) {
  return (
    Object.keys(body).length === keys.length &&
    keys.every((key) => Object.hasOwn(body, key))
  );
}
function credentials(body: unknown): Credentials | null {
  if (!object(body) || !exact(body, ["username", "password"])) return null;
  if (
    typeof body.username !== "string" ||
    !credentialPattern.test(body.username) ||
    typeof body.password !== "string" ||
    body.password.length < 8 ||
    body.password.length > 128
  )
    return null;
  return { username: body.username.toLowerCase(), password: body.password };
}
function activity(body: unknown): Activity | null {
  if (!object(body)) return null;
  if (
    body.kind === "gather" &&
    exact(body, ["kind", "skill"]) &&
    SKILLS.includes(body.skill as (typeof SKILLS)[number])
  )
    return { kind: "gather", skill: body.skill as (typeof SKILLS)[number] };
  if ((body.kind === "idle" || body.kind === "combat") && exact(body, ["kind"]))
    return { kind: body.kind };
  return null;
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ bodyLimit: 4096, logger: false });
  const now = options.now ?? Date.now;
  const dbPath =
    options.dbPath ??
    fileURLToPath(new URL("../../../data/game.sqlite", import.meta.url));
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS characters(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,state TEXT NOT NULL);`);
  await app.register(cookie);
  const accountByName = db.prepare("SELECT * FROM accounts WHERE username=?");
  const characterByAccount = db.prepare(
    "SELECT * FROM characters WHERE account_id=?",
  );
  const saveCharacter = db.prepare(
    "UPDATE characters SET state=? WHERE account_id=?",
  );
  const sessionAccount = db.prepare(
    "SELECT a.* FROM accounts a JOIN sessions s ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?",
  );
  const limits = new Map<string, { count: number; until: number }>();
  let limiterSweepAt = 0;
  const deny = (reply: FastifyReply, status: number, error: string) =>
    reply.code(status).send({ error });
  function authenticated(
    request: FastifyRequest,
    reply: FastifyReply,
  ): AccountRow | null {
    const token = request.cookies[SESSION_NAME];
    const row =
      token && token.length <= 128
        ? (sessionAccount.get(tokenHash(token), now()) as
            | AccountRow
            | undefined)
        : undefined;
    if (!row) {
      deny(reply, 401, "Please log in.");
      return null;
    }
    return row;
  }
  function setSession(
    accountId: string,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const token = randomBytes(32).toString("hex");
    const oldToken = request.cookies[SESSION_NAME];
    if (oldToken)
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
        tokenHash(oldToken),
      );
    db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now());
    db.prepare(
      "INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)",
    ).run(tokenHash(token), accountId, now() + SESSION_AGE);
    reply.setCookie(SESSION_NAME, token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure:
        request.protocol === "https" || process.env.COOKIE_SECURE === "true",
      maxAge: SESSION_AGE / 1000,
    });
  }
  function snapshot(account: AccountRow): Snapshot {
    const time = now();
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = characterByAccount.get(account.id) as
        | CharacterRow
        | undefined;
      const state = row ? (JSON.parse(row.state) as StoredCharacter) : null;
      const catchup = state
        ? reconcile(state, time)
        : { ticks: 0, capped: false };
      if (state && (catchup.ticks || catchup.capped))
        saveCharacter.run(JSON.stringify(state), account.id);
      db.exec("COMMIT");
      return {
        account: publicAccount(account),
        character: state?.character ?? null,
        serverTime: time,
        tickMs: TICK_MS,
        tile: {
          id: "hearthwild",
          name: "The Hearthwild",
          description:
            "A quiet frontier clearing: ancient trees, copper seams, a stream and wild herbs.",
        },
        catchup,
      };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    reply.header("Cache-Control", "no-store");
    if (request.method !== "GET" && request.method !== "HEAD") {
      const origin = request.headers.origin;
      if (origin) {
        let parsed: URL;
        try {
          parsed = new URL(origin);
        } catch {
          return deny(reply, 403, "Invalid request origin.");
        }
        const expectedOrigin = new URL(
          `${request.protocol}://${request.headers.host}`,
        ).origin;
        if (parsed.origin !== expectedOrigin || parsed.origin === "null")
          return deny(reply, 403, "Requests must come from this site.");
      }
      if (request.headers["sec-fetch-site"] === "cross-site")
        return deny(reply, 403, "Requests must come from this site.");
    }
    const routePath = request.url.split("?")[0];
    if (routePath === "/api/auth/register" || routePath === "/api/auth/login") {
      const time = now();
      if (time >= limiterSweepAt) {
        for (const [key, bucket] of limits)
          if (bucket.until <= time) limits.delete(key);
        limiterSweepAt = time + 60_000;
      }
      const key = request.ip;
      const bucket = limits.get(key);
      if (!bucket || bucket.until <= time)
        limits.set(key, { count: 1, until: time + 60_000 });
      else if (++bucket.count > 10) {
        reply.header(
          "Retry-After",
          Math.max(1, Math.ceil((bucket.until - time) / 1000)),
        );
        return deny(
          reply,
          429,
          "Too many sign-in attempts. Try again in a minute.",
        );
      }
    }
  });
  app.setErrorHandler((error, request, reply) => {
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500)
      return deny(
        reply,
        status,
        status === 413 ? "Request is too large." : "Invalid JSON request.",
      );
    request.log.error(error);
    return deny(reply, 500, "Something went wrong. Please try again.");
  });
  app.post("/api/auth/register", async (request, reply) => {
    const input = credentials(request.body);
    if (!input)
      return deny(
        reply,
        400,
        "Use a 3–24 character username (letters, digits, underscore) and an 8–128 character password.",
      );
    if (accountByName.get(input.username))
      return deny(reply, 409, "That username is already taken.");
    const salt = randomBytes(16).toString("hex");
    const account: AccountRow = {
      id: randomUUID(),
      username: input.username,
      salt,
      password_hash: scryptSync(input.password, salt, 64).toString("hex"),
    };
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "INSERT INTO accounts(id,username,salt,password_hash) VALUES(?,?,?,?)",
      ).run(account.id, account.username, salt, account.password_hash);
      setSession(account.id, request, reply);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return reply.code(201).send(snapshot(account));
  });
  app.post("/api/auth/login", async (request, reply) => {
    const input = credentials(request.body);
    if (!input) return deny(reply, 400, "Enter a valid username and password.");
    const account = accountByName.get(input.username) as AccountRow | undefined;
    // Perform the same expensive password work for unknown usernames.
    const actual = scryptSync(
      input.password,
      account?.salt ?? "unknown-account-salt",
      64,
    );
    const expected = account
      ? Buffer.from(account.password_hash, "hex")
      : Buffer.alloc(64);
    if (!account || !timingSafeEqual(actual, expected))
      return deny(reply, 401, "Username or password is incorrect.");
    setSession(account.id, request, reply);
    return snapshot(account);
  });
  app.post("/api/auth/logout", async (request, reply) => {
    if (
      request.body !== undefined &&
      (!object(request.body) || Object.keys(request.body).length !== 0)
    )
      return deny(reply, 400, "Logout takes no fields.");
    const token = request.cookies[SESSION_NAME];
    if (token)
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
        tokenHash(token),
      );
    reply.clearCookie(SESSION_NAME, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
    });
    return { ok: true };
  });
  app.get("/api/state", async (request, reply) => {
    const account = authenticated(request, reply);
    if (!account) return;
    return snapshot(account);
  });
  app.post("/api/character", async (request, reply) => {
    const account = authenticated(request, reply);
    if (!account) return;
    if (
      !object(request.body) ||
      !exact(request.body, ["name"]) ||
      typeof request.body.name !== "string" ||
      request.body.name.length > 100
    )
      return deny(reply, 400, "Enter a character name.");
    const name = request.body.name.trim();
    if (!/^[A-Za-z0-9 '\-]{2,24}$/.test(name) || !/[A-Za-z0-9]/.test(name))
      return deny(
        reply,
        400,
        "Use 2–24 letters, digits, spaces, apostrophes or hyphens.",
      );
    if (characterByAccount.get(account.id))
      return deny(reply, 409, "This account already has a character.");
    const state = createCharacter(name, now());
    db.prepare("INSERT INTO characters(account_id,state) VALUES(?,?)").run(
      account.id,
      JSON.stringify(state),
    );
    return reply.code(201).send(snapshot(account));
  });
  app.post("/api/activity", async (request, reply) => {
    const account = authenticated(request, reply);
    if (!account) return;
    const input = activity(request.body);
    if (!input)
      return deny(
        reply,
        400,
        "Choose rest, combat or one of the four gathering skills.",
      );
    const time = now();
    let catchup = { ticks: 0, capped: false };
    db.exec("BEGIN IMMEDIATE");
    try {
      const row = characterByAccount.get(account.id) as
        | CharacterRow
        | undefined;
      if (!row) {
        db.exec("ROLLBACK");
        return deny(reply, 409, "Create a character first.");
      }
      const state = JSON.parse(row.state) as StoredCharacter;
      catchup = reconcile(state, time);
      // Repeated selection cannot reset progress; an actual switch starts a new boundary.
      if (JSON.stringify(state.character.activity) !== JSON.stringify(input))
        selectActivity(state, input, time);
      saveCharacter.run(JSON.stringify(state), account.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    const result = snapshot(account);
    result.catchup = catchup;
    return result;
  });
  app.get("/api/health", async () => ({ ok: true }));
  let ticker: ReturnType<typeof setInterval> | undefined;
  if (options.startTicker !== false) {
    ticker = setInterval(() => {
      const time = now();
      db.exec("BEGIN IMMEDIATE");
      try {
        const rows = db
          .prepare("SELECT account_id,state FROM characters")
          .all() as unknown as CharacterRow[];
        for (const row of rows) {
          const state = JSON.parse(row.state) as StoredCharacter;
          const result = reconcile(state, time);
          if (result.ticks || result.capped)
            saveCharacter.run(JSON.stringify(state), row.account_id);
        }
        db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(time);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        app.log.error(error);
      }
    }, TICK_MS);
    ticker.unref();
  }
  app.addHook("onClose", async () => {
    if (ticker) clearInterval(ticker);
    db.close();
  });
  if (options.serveWeb !== false) {
    const webRoot = fileURLToPath(new URL("../../web/dist/", import.meta.url));
    if (existsSync(webRoot)) {
      await app.register(staticFiles, { root: webRoot });
      app.setNotFoundHandler((request, reply) =>
        request.url.startsWith("/api/")
          ? deny(reply, 404, "API route not found.")
          : reply.sendFile("index.html"),
      );
    }
  }
  return app;
}
