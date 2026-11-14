import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildApp } from "../src/app.ts";
import { createCharacter, reconcile } from "../src/engine.ts";
import {
  MAX_OFFLINE_TICKS,
  SKILLS,
  TICK_MS,
  TIERS,
  type Snapshot,
  type Activity,
} from "@idler/contracts";

const password = "test-strong-password";
const cookieOf = (response: { cookies: { name: string; value: string }[] }) =>
  response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "idler-test-"));
  const dbPath = join(directory, "game.sqlite");
  let clock = 1_000_000;
  const app = await buildApp({
    dbPath,
    now: () => clock,
    startTicker: false,
    serveWeb: false,
  });
  const register = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { username: "explorer", password },
  });
  assert.equal(register.statusCode, 201);
  const cookie = cookieOf(register);
  const character = await app.inject({
    method: "POST",
    url: "/api/character",
    headers: { cookie },
    payload: { name: "Ash Walker" },
  });
  assert.equal(character.statusCode, 201);
  const state = async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/state",
      headers: { cookie },
    });
    assert.equal(response.statusCode, 200);
    return response.json<Snapshot>();
  };
  const select = async (payload: Activity) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/activity",
      headers: { cookie },
      payload,
    });
    assert.equal(response.statusCode, 200);
    return response.json<Snapshot>();
  };
  return {
    app,
    cookie,
    dbPath,
    state,
    select,
    get now() {
      return clock;
    },
    advance: (ms: number) => {
      clock += ms;
    },
    close: async () => {
      await app.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("register, create, logout and log back in using a private session cookie", async () => {
  const app = await buildApp({
    dbPath: ":memory:",
    startTicker: false,
    serveWeb: false,
  });
  try {
    assert.equal((await app.inject("/api/state")).statusCode, 401);
    assert.equal((await app.inject("/api/health")).statusCode, 200);
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "New_Player", password },
    });
    assert.equal(register.statusCode, 201);
    assert.equal(register.json<Snapshot>().account.username, "new_player");
    assert.equal(register.json<Snapshot>().character, null);
    const setCookie = String(register.headers["set-cookie"]);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    const cookie = cookieOf(register);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/character",
          headers: { cookie },
          payload: { name: "Moss" },
        })
      ).statusCode,
      201,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/character",
          headers: { cookie },
          payload: { name: "Second" },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { cookie },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: "/api/state", headers: { cookie } })).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { username: "new_player", password: "incorrect-password" },
        })
      ).statusCode,
      401,
    );
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "NEW_PLAYER", password },
    });
    assert.equal(login.statusCode, 200);
    assert.equal(login.json<Snapshot>().character?.name, "Moss");
    assert.notEqual(cookieOf(login), cookie);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { username: "new_player", password },
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("all four skills gather five weighted tiers, with descending productivity", async () => {
  const f = await fixture();
  try {
    const db = new DatabaseSync(f.dbPath);
    const row = db.prepare("SELECT state FROM characters").get() as {
      state: string;
    };
    const seeded = JSON.parse(row.state);
    seeded.rng = 123456789;
    db.prepare("UPDATE characters SET state=?").run(JSON.stringify(seeded));
    db.close();
    for (const skill of SKILLS) {
      await f.select({ kind: "gather", skill });
      f.advance(10_000 * TICK_MS);
      const snapshot = await f.state();
      const character = snapshot.character!;
      assert.equal(character.skills[skill].actions, 10_000);
      const stacks = character.inventory.filter(
        (stack) => stack.skill === skill,
      );
      assert.equal(stacks.length, 5);
      const observed = TIERS.map(
        (tier) =>
          stacks.find((stack) => stack.tier === tier.tier)!.quantity /
          tier.quantity,
      );
      assert.equal(
        observed.reduce((a, b) => a + b, 0),
        10_000,
      );
      for (const [index, tier] of TIERS.entries()) {
        assert.ok(
          Math.abs(observed[index] - tier.weight * 100) <= 200,
          `${skill} T${tier.tier}: expected approximately ${tier.weight}%, observed ${observed[index] / 100}%`,
        );
      }
      for (let i = 1; i < observed.length; i++)
        assert.ok(observed[i - 1] > observed[i], `${skill}: ${observed}`);
      assert.equal(
        character.skills[skill].items,
        stacks.reduce((total, item) => total + item.quantity, 0),
      );
      assert.ok(character.events.length <= 30);
      assert.equal((await f.state()).catchup.ticks, 0);
    }
  } finally {
    await f.close();
  }
});

test("switch settles old activity, does not double award, and keeps partial boundaries honest", async () => {
  const f = await fixture();
  try {
    await f.select({ kind: "gather", skill: "mining" });
    f.advance(TICK_MS + 1000);
    const first = await f.state();
    assert.equal(first.character!.skills.mining.actions, 1);
    const switched = await f.select({ kind: "gather", skill: "fishing" });
    assert.equal(switched.character!.lastTickAt, f.now);
    f.advance(1000);
    assert.equal((await f.state()).character!.skills.fishing.actions, 0);
    f.advance(1000);
    assert.equal((await f.state()).character!.skills.fishing.actions, 1);
    f.advance(1000);
    await f.select({ kind: "gather", skill: "fishing" });
    f.advance(1000);
    assert.equal(
      (await f.state()).character!.skills.fishing.actions,
      2,
      "repeated same activity must not postpone ticks",
    );
  } finally {
    await f.close();
  }
});

test("persisted offline progress, RNG, sessions and remainder survive database reopen", async () => {
  const f = await fixture();
  try {
    await f.select({ kind: "gather", skill: "foraging" });
    f.advance(TICK_MS + 123);
    const first = await f.state();
    const db = new DatabaseSync(f.dbPath);
    const raw = db.prepare("SELECT state FROM characters").get() as {
      state: string;
    };
    const projected = JSON.parse(raw.state);
    db.close();
    await f.app.close();
    f.advance(9 * TICK_MS);
    reconcile(projected, f.now);
    const restarted = await buildApp({
      dbPath: f.dbPath,
      now: () => f.now,
      startTicker: false,
      serveWeb: false,
    });
    try {
      const response = await restarted.inject({
        url: "/api/state",
        headers: { cookie: f.cookie },
      });
      assert.equal(response.statusCode, 200);
      const result = response.json<Snapshot>();
      assert.equal(result.catchup.ticks, 9);
      assert.equal(result.character!.skills.foraging.actions, 10);
      assert.equal(f.now - result.character!.lastTickAt, 123);
      assert.deepEqual(
        result.character!.inventory,
        projected.character.inventory,
        "restarted RNG must match uninterrupted simulation",
      );
      const repeated = await restarted.inject({
        url: "/api/state",
        headers: { cookie: f.cookie },
      });
      assert.deepEqual(repeated.json<Snapshot>().character, result.character);
      assert.equal(first.character!.skills.foraging.actions, 1);
    } finally {
      await restarted.close();
    }
  } finally {
    await f.close();
  }
});

test("offline cap processes only the most recent day exactly once, retaining remainder", async () => {
  const f = await fixture();
  try {
    await f.select({ kind: "gather", skill: "woodcutting" });
    f.advance((MAX_OFFLINE_TICKS + 100) * TICK_MS + 999);
    const result = await f.state();
    assert.deepEqual(result.catchup, {
      ticks: MAX_OFFLINE_TICKS,
      capped: true,
    });
    assert.equal(
      result.character!.skills.woodcutting.actions,
      MAX_OFFLINE_TICKS,
    );
    assert.equal(f.now - result.character!.lastTickAt, 999);
    assert.deepEqual((await f.state()).catchup, { ticks: 0, capped: false });
    f.advance(1001);
    assert.equal(
      (await f.state()).character!.skills.woodcutting.actions,
      MAX_OFFLINE_TICKS + 1,
    );
  } finally {
    await f.close();
  }
});

test("combat is one target, awards wins only on kills, handles defeat/recovery and rest", async () => {
  const f = await fixture();
  try {
    await f.select({ kind: "combat" });
    f.advance(TICK_MS);
    let c = (await f.state()).character!;
    assert.equal(c.hp, 27);
    assert.equal(c.combat.enemyHp, 12);
    assert.equal(c.combat.wins, 0);
    f.advance(2 * TICK_MS);
    c = (await f.state()).character!;
    assert.equal(c.hp, 24);
    assert.equal(c.combat.enemyHp, 0);
    assert.equal(c.combat.wins, 1);
    f.advance(TICK_MS);
    c = (await f.state()).character!;
    assert.equal(c.combat.enemyHp, 12);
    assert.equal(c.hp, 21);
    f.advance(10 * TICK_MS);
    c = (await f.state()).character!;
    assert.equal(c.hp, 0);
    assert.equal(c.combat.defeats, 1);
    assert.equal(c.combat.wins, 4);
    f.advance(TICK_MS);
    c = (await f.state()).character!;
    assert.equal(c.hp, 30);
    assert.equal(c.combat.enemyHp, 18);
    assert.equal(c.combat.defeats, 1);
    f.advance(TICK_MS);
    assert.equal((await f.state()).character!.hp, 27);
    await f.select({ kind: "idle" });
    f.advance(TICK_MS);
    c = (await f.state()).character!;
    assert.equal(c.hp, 30);
    assert.equal(c.inventory.length, 0);
  } finally {
    await f.close();
  }
});

test("strict API rejects injected rewards/clocks and foreign origins; account data remains isolated", async () => {
  const f = await fixture();
  try {
    for (const payload of [
      { kind: "gather", skill: "mining", now: 999999999 },
      { kind: "combat", hp: 999 },
      { kind: "gather", skill: "hacking" },
      { kind: "idle", inventory: [] },
      [],
      null,
    ]) {
      const response = await f.app.inject({
        method: "POST",
        url: "/api/activity",
        headers: { cookie: f.cookie, "content-type": "application/json" },
        payload: JSON.stringify(payload),
      });
      assert.equal(response.statusCode, 400);
    }
    assert.equal((await f.state()).character!.ticks, 0);
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/activity",
          headers: { cookie: f.cookie, origin: "https://evil.example" },
          payload: { kind: "combat" },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/activity",
          headers: { cookie: f.cookie, origin: "http://127.0.0.1:9999" },
          payload: { kind: "combat" },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/activity",
          headers: {
            cookie: f.cookie,
            origin: "http://localhost:80",
            host: "localhost:80",
          },
          payload: { kind: "idle" },
        })
      ).statusCode,
      200,
    );
    const other = await f.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "another", password },
    });
    const otherCookie = cookieOf(other);
    assert.equal(other.json<Snapshot>().character, null);
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/activity",
          headers: { cookie: otherCookie },
          payload: { kind: "combat" },
        })
      ).statusCode,
      409,
    );
    const unauthorized = await f.app.inject({
      method: "POST",
      url: "/api/activity",
      headers: { cookie: "idler_session=forged" },
      payload: { kind: "combat" },
    });
    assert.equal(unauthorized.statusCode, 401);
    const db = new DatabaseSync(f.dbPath);
    const storedAccounts = db.prepare("SELECT * FROM accounts").all();
    const storedSessions = db.prepare("SELECT * FROM sessions").all();
    assert.ok(
      storedAccounts.every((row) => !JSON.stringify(row).includes(password)),
    );
    assert.ok(
      storedSessions.every(
        (row) => !JSON.stringify(row).includes(f.cookie.split("=")[1]),
      ),
    );
    db.close();
  } finally {
    await f.close();
  }
});

test("auth endpoint limits repeated password attempts and expires sessions", async () => {
  let clock = 5_000_000;
  const app = await buildApp({
    dbPath: ":memory:",
    now: () => clock,
    startTicker: false,
    serveWeb: false,
  });
  try {
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "limited", password },
    });
    const cookie = cookieOf(register);
    for (let i = 0; i < 9; i++)
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: { username: "limited", password: "incorrect" },
          })
        ).statusCode,
        401,
      );
    const limited = await app.inject({
      method: "POST",
      url: "/api/auth/login?ignored=1",
      payload: { username: "limited", password },
    });
    assert.equal(limited.statusCode, 429);
    assert.ok(limited.headers["retry-after"]);
    clock += 60_001;
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { cookie },
      payload: { username: "limited", password },
    });
    assert.equal(login.statusCode, 200);
    const activeCookie = cookieOf(login);
    assert.equal(
      (
        await app.inject({
          url: "/api/state",
          headers: { cookie: activeCookie },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: "/api/state", headers: { cookie } })).statusCode,
      401,
      "login rotates the prior token",
    );
    clock += 8 * 24 * 60 * 60 * 1000;
    assert.equal(
      (
        await app.inject({
          url: "/api/state",
          headers: { cookie: activeCookie },
        })
      ).statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});

test("background ticker persists progress without an HTTP client connection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "idler-background-"));
  const dbPath = join(directory, "game.sqlite");
  let clock = 10_000;
  const app = await buildApp({ dbPath, now: () => clock, serveWeb: false });
  try {
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "background", password },
    });
    const cookie = cookieOf(register);
    await app.inject({
      method: "POST",
      url: "/api/character",
      headers: { cookie },
      payload: { name: "Idle Wanderer" },
    });
    await app.inject({
      method: "POST",
      url: "/api/activity",
      headers: { cookie },
      payload: { kind: "gather", skill: "fishing" },
    });
    clock += 5 * TICK_MS;
    await new Promise((resolve) => setTimeout(resolve, TICK_MS + 150));
    const db = new DatabaseSync(dbPath);
    const row = db.prepare("SELECT state FROM characters").get() as {
      state: string;
    };
    assert.equal(JSON.parse(row.state).character.skills.fishing.actions, 5);
    db.close();
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("server clock moving backward cannot mint negative ticks or duplicate rewards", () => {
  const state = createCharacter("Clock Warden", 100_000);
  state.character.activity = { kind: "gather", skill: "mining" };
  assert.deepEqual(reconcile(state, 90_000), { ticks: 0, capped: false });
  assert.equal(state.character.lastTickAt, 100_000);
  assert.deepEqual(reconcile(state, 102_000), { ticks: 1, capped: false });
  assert.deepEqual(reconcile(state, 101_000), { ticks: 0, capped: false });
  assert.equal(state.character.skills.mining.actions, 1);
});
