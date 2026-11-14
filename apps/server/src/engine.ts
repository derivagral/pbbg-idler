import { randomBytes, randomUUID } from "node:crypto";
import {
  MAX_OFFLINE_TICKS,
  SKILLS,
  SKILL_INFO,
  TICK_MS,
  TIERS,
  type Activity,
  type Character,
  type GameEvent,
  type Skill,
} from "@idler/contracts";

/** Private persisted fields never appear on the wire. */
export interface StoredCharacter {
  character: Character;
  rng: number;
  eventSeq: number;
}
export function addEvent(
  state: StoredCharacter,
  at: number,
  kind: GameEvent["kind"],
  text: string,
) {
  state.character.events.push({ id: ++state.eventSeq, at, kind, text });
  if (state.character.events.length > 30) state.character.events.shift();
}
export function createCharacter(name: string, at: number): StoredCharacter {
  const state: StoredCharacter = {
    rng: randomBytes(4).readUInt32LE() || 1,
    eventSeq: 0,
    character: {
      id: randomUUID(),
      name,
      tileId: "hearthwild",
      activity: { kind: "idle" },
      hp: 30,
      maxHp: 30,
      skills: Object.fromEntries(
        SKILLS.map((skill) => [skill, { actions: 0, items: 0 }]),
      ) as Character["skills"],
      inventory: [],
      combat: {
        enemyName: "Bramble rat",
        enemyHp: 18,
        enemyMaxHp: 18,
        wins: 0,
        defeats: 0,
      },
      ticks: 0,
      lastTickAt: at,
      events: [],
    },
  };
  addEvent(state, at, "system", `${name} arrived in the Hearthwild.`);
  return state;
}
function random(state: StoredCharacter): number {
  let n = state.rng;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  state.rng = n >>> 0;
  return state.rng / 0x1_0000_0000;
}
/** Lower chance and smaller yields for higher tiers. No input from clients. */
function gather(state: StoredCharacter, skill: Skill, at: number) {
  let roll = random(state) * 100;
  const reward = TIERS.find((tier) => (roll -= tier.weight) < 0) ?? TIERS[4];
  const character = state.character;
  const stack = character.inventory.find(
    (item) => item.skill === skill && item.tier === reward.tier,
  );
  if (stack) stack.quantity += reward.quantity;
  else
    character.inventory.push({
      skill,
      tier: reward.tier,
      quantity: reward.quantity,
    });
  character.inventory.sort(
    (a, b) =>
      SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill) || a.tier - b.tier,
  );
  character.skills[skill].actions++;
  character.skills[skill].items += reward.quantity;
  addEvent(
    state,
    at,
    "gather",
    `Gathered ${reward.quantity} ${reward.label.toLowerCase()} ${SKILL_INFO[skill].resource.toLowerCase()} (T${reward.tier}).`,
  );
}
function fight(state: StoredCharacter, at: number) {
  const character = state.character;
  const combat = character.combat;
  if (character.hp <= 0) {
    character.hp = character.maxHp;
    combat.enemyHp = combat.enemyMaxHp;
    addEvent(
      state,
      at,
      "combat",
      "Recovered at the clearing. Ready for another encounter.",
    );
    return;
  }
  if (combat.enemyHp <= 0) combat.enemyHp = combat.enemyMaxHp;
  combat.enemyHp = Math.max(0, combat.enemyHp - 6);
  if (combat.enemyHp === 0) {
    combat.wins++;
    addEvent(
      state,
      at,
      "combat",
      "Defeated a Bramble rat. Another approaches the clearing.",
    );
    return;
  }
  character.hp = Math.max(0, character.hp - 3);
  if (character.hp === 0) {
    combat.defeats++;
    addEvent(state, at, "combat", "The Bramble rat won. Recovering next tick.");
  } else {
    addEvent(
      state,
      at,
      "combat",
      `Hit the Bramble rat for 6. It struck back for 3.`,
    );
  }
}
export function reconcile(
  state: StoredCharacter,
  now: number,
): { ticks: number; capped: boolean } {
  const character = state.character;
  const elapsedTicks = Math.max(
    0,
    Math.floor((now - character.lastTickAt) / TICK_MS),
  );
  const ticks = Math.min(elapsedTicks, MAX_OFFLINE_TICKS);
  const capped = elapsedTicks > ticks;
  // Drop older full ticks, retaining the remainder and processing the most recent day.
  if (capped) character.lastTickAt += (elapsedTicks - ticks) * TICK_MS;
  for (let i = 0; i < ticks; i++) {
    character.lastTickAt += TICK_MS;
    character.ticks++;
    if (character.activity.kind === "gather")
      gather(state, character.activity.skill, character.lastTickAt);
    else if (character.activity.kind === "combat")
      fight(state, character.lastTickAt);
    else character.hp = Math.min(character.maxHp, character.hp + 3);
  }
  if (capped)
    addEvent(
      state,
      now,
      "system",
      "Offline progress was limited to the most recent 24 hours.",
    );
  return { ticks, capped };
}
export function selectActivity(
  state: StoredCharacter,
  activity: Activity,
  now: number,
) {
  state.character.activity = activity;
  // Settle under the old action before calling this. No banked partial ticks on a switch.
  state.character.lastTickAt = Math.max(state.character.lastTickAt, now);
  const label =
    activity.kind === "gather"
      ? SKILL_INFO[activity.skill].name
      : activity.kind === "combat"
        ? "Auto-combat"
        : "Rest";
  addEvent(state, now, "system", `${label} selected.`);
}
