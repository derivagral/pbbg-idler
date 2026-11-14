# Hearthwild · PBBG Idler

A playable browser idle RPG vertical slice. One character, one map tile, four gathering skills and one endlessly respawning 1v1 enemy. TypeScript throughout; the Node server owns every tick, reward, combat hit and timestamp. Babylon is a lazy-loaded, optional viewer.

[View the working demonstration and verification results](docs/DEMO.md).

## Run

Requires **Node.js 24+** (uses built-in `node:sqlite`) and npm.

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3001**. Create an account, name your character, then select a gathering action or fight. No seeded accounts or external services are required. The server creates `data/game.sqlite`; keep that file to retain accounts, sessions and characters. Shut down with Ctrl+C and restart with the same command to resume progress.

For development, `npm run dev` starts the API on 3001 and Vite on **http://localhost:5173**. For a writable npm cache in sandboxed environments, use `npm ci --cache ./work/npm-cache`.

## Play the slice

1. Create an account with a unique username and a password of at least eight characters.
2. Create your single character and enter **The Hearthwild**.
3. Choose **Woodcutting**, **Mining**, **Fishing** or **Foraging**. Every two seconds the server rolls one reward and adds it to inventory.
4. Choose **Fight Bramble rat** for automatic 1v1 encounters, or **Rest** to recover health. Only one activity runs at a time.
5. Reload, log out, or close the browser. Progress persists. Log back in to inspect it.
6. Optionally open the **3D viewer**. It renders server snapshots; closing it or lacking WebGL has no effect on play.

| Reward tier | Chance | Items per gathering action |
| --- | ---: | ---: |
| T1 Common | 60% | 5 |
| T2 Uncommon | 25% | 4 |
| T3 Rare | 10% | 3 |
| T4 Epic | 4% | 2 |
| T5 Mythic | 1% | 1 |

All four skills use this table, with separate inventory stacks for every tier. Higher tiers are deliberately rarer and yield fewer items. Skills record actions and items gathered. Combat records victories and defeats; it grants no gathering items. There is no crafting, equipment, economy or quest system.

The player has 30 HP and deals 6 damage per tick. The rat has 18 HP and returns 3 damage if still alive. A new rat appears after a victory. Health carries between fights; defeat triggers recovery on the next combat tick. Rest heals 3 HP per tick.

## Authority and persistence

`packages/contracts` defines the API and snapshots. `apps/server` implements Fastify, the tick engine, salted scrypt passwords, opaque cookie sessions and SQLite storage. `apps/web` implements React and Vite; `src/viewer` is isolated Babylon rendering code. See [the implementation contracts](docs/CONTRACTS.md).

The client sends only login details, a character name or an activity choice. It cannot submit time, elapsed ticks, rewards, damage or inventory changes. Server validation rejects extra properties. The stored PRNG state, tick boundary and character snapshot commit together in SQLite transactions. Repeated state requests and process restarts cannot replay paid ticks. The same engine handles a two-second background loop and catch-up on requests.

Catch-up is limited to the most recent **24 hours per reconciliation** and keeps fractional tick time. If the server has been stopped longer, it records a visible cap notice. While the server remains running, ticks continue even with every browser closed. Switching activities settles the old one first and starts a new boundary; selecting the same activity does not reset progress.

The SQLite database is private server data and is gitignored. Sessions expire after seven days; logout revokes the active session. Cookies are HttpOnly and SameSite=Strict; foreign-origin mutations and excessive authentication attempts are rejected.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
# Or all four, in that order:
npm run check
```

Browser tests use Playwright and Chromium, with `/usr/bin/chromium` by default. Set `CHROMIUM_PATH` to another installed Chromium executable. Tests start an isolated production server with a separate database in `work/browser-test.sqlite`; stop other services on port 3001 first. On a system without Chromium, install Playwright Chromium with `npx playwright install chromium`, then rerun the suite; it falls back to Playwright’s installed browser when system Chromium is absent.

Integration tests cover authentication, account isolation, exact reward weights and yields, deterministic catch-up, activity boundaries, combat, restart persistence and invalid or forged input. Browser tests exercise the complete account flow, all four skills, inventory after reload, combat, returning login, idle progress without a page, a real Babylon canvas, WebGL fallback, and desktop/mobile widths. Playwright retains failure traces in `test-results/` and writes an HTML report to `playwright-report/`.

## Runtime configuration and limits

- `PORT`: API and production frontend port (default `3001`).
- `HOST`: bind address (default `0.0.0.0`).
- `DB_PATH`: SQLite file (default `<repo>/data/game.sqlite`).
- `COOKIE_SECURE=true`: mark session cookies Secure for an HTTPS environment (default off for local HTTP).

This proof of concept runs one Node process against one local SQLite database. It has no external hosting dependency. Keep the database on persistent storage. Multi-instance scheduling, production account recovery and database migrations are outside this vertical slice. Do not run multiple tick schedulers against the same database.
