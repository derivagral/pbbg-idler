/** Wire contract v1. Inputs are intentions; only the server advances state. */
export const SKILLS = ["woodcutting", "mining", "fishing", "foraging"] as const;
export type Skill = (typeof SKILLS)[number];
export type Tier = 1 | 2 | 3 | 4 | 5;
export const TICK_MS = 2_000;
export const MAX_OFFLINE_TICKS = 43_200; // 24 hours per reconciliation
export const TIERS = [
  { tier: 1, weight: 60, quantity: 5, label: "Common" },
  { tier: 2, weight: 25, quantity: 4, label: "Uncommon" },
  { tier: 3, weight: 10, quantity: 3, label: "Rare" },
  { tier: 4, weight: 4, quantity: 2, label: "Epic" },
  { tier: 5, weight: 1, quantity: 1, label: "Mythic" },
] as const;
export const SKILL_INFO: Record<
  Skill,
  { name: string; resource: string; description: string }
> = {
  woodcutting: {
    name: "Woodcutting",
    resource: "Timber",
    description: "Work the old-growth grove.",
  },
  mining: {
    name: "Mining",
    resource: "Ore",
    description: "Follow the copper seam.",
  },
  fishing: {
    name: "Fishing",
    resource: "Fish",
    description: "Cast into the quiet stream.",
  },
  foraging: {
    name: "Foraging",
    resource: "Herbs",
    description: "Search the meadow undergrowth.",
  },
};
export type Activity =
  | { kind: "idle" }
  | { kind: "gather"; skill: Skill }
  | { kind: "combat" };
export interface Account {
  id: string;
  username: string;
}
export interface InventoryStack {
  skill: Skill;
  tier: Tier;
  quantity: number;
}
export interface GameEvent {
  id: number;
  at: number;
  kind: "gather" | "combat" | "system";
  text: string;
}
export interface Character {
  id: string;
  name: string;
  tileId: "hearthwild";
  activity: Activity;
  hp: number;
  maxHp: number;
  skills: Record<Skill, { actions: number; items: number }>;
  inventory: InventoryStack[];
  combat: {
    enemyName: "Bramble rat";
    enemyHp: number;
    enemyMaxHp: number;
    wins: number;
    defeats: number;
  };
  ticks: number;
  lastTickAt: number;
  events: GameEvent[];
}
export interface Snapshot {
  account: Account;
  character: Character | null;
  serverTime: number;
  tickMs: number;
  tile: { id: "hearthwild"; name: "The Hearthwild"; description: string };
  catchup: { ticks: number; capped: boolean };
}
export interface Credentials {
  username: string;
  password: string;
}
export interface ApiError {
  error: string;
}
/** API (same-origin cookies): POST /api/auth/register or /login -> Snapshot;
 * POST /api/auth/logout -> {ok:true}; GET /api/state -> Snapshot;
 * POST /api/character {name} -> Snapshot; POST /api/activity Activity -> Snapshot.
 * Username: 3–24 ASCII letters/digits/underscore. Password: 8–128 chars.
 * Character: 2–24 trimmed letters/digits/spaces/apostrophe/hyphen.
 * JSON mutations reject unknown properties, including client clocks/rewards/health.
 * 400 invalid input, 401 unauthenticated, 409 duplicate account/character.
 */
