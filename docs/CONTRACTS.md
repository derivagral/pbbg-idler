# Vertical slice contract v1

Shared wire types and game constants are frozen in `packages/contracts/src/index.ts` before parallel implementation. Root owns contract and dependency changes.

- Backend agent owns `apps/server/src/**` and `apps/server/test/**`.
- Frontend agent owns `apps/web/**`, excluding `apps/web/src/viewer/**` and package.json.
- Babylon agent owns only `apps/web/src/viewer/**`.
- Root owns root setup, shared contracts, docs, browser tests and integration fixes.

Backend exports async `buildApp({dbPath?, now?, startTicker?, serveWeb?})` returning a Fastify instance. `now` is an injectable trusted server clock for tests, never HTTP input. Default database is `data/game.sqlite` resolved from repo root. API runs on PORT (default 3001). Production serves built frontend, dev Vite proxies /api. SQLite commits authoritative timestamps, RNG state, session and full character atomically. Sessions use opaque random tokens (only hashes stored), HttpOnly SameSite cookies. Passwords use salted scrypt. Rate-limit auth. Reject foreign Origin mutations.

Tick every 2000ms, one selected activity. Gather chooses weights 60/25/10/4/1, grants 5/4/3/2/1 items. Every skill has all five tiers. No crafting, quests, equipment, trading or extra systems. Skills track actions/items, no invented progression. Fight one Bramble rat at a time: 18 HP, player 30 HP, player attack 6, rat attack 3 only if alive. Next tick spawns new rat and may attack. On player defeat increment defeats; next tick recovers full HP, then resumes. Rest recovers HP by 3 per tick. Switching activity reconciles old action first and resets tick boundary to avoid partial action exploits. Combat carries HP between rounds. Combat rewards are win counts only. Events retain last 30. Catch-up processes at most the last 24h per reconciliation, discloses cap, preserves sub-tick remainder and does not re-award ticks on repeated reads or restart. Background ticker and lazy catch-up use the same engine. Gathering continues without any viewer/browser connection.

Frontend uses credentials same-origin fetch, polls /api/state each second, no local game state mutation or client ticks. Register/login, create one character, map, gather/fight/rest, inventory tiers, activity/events. Responsive dark forest field-journal interface. Optional viewer mounted only by a user toggle via dynamic import.

Viewer exports default React `StateViewer({character}: {character: Character})`. Pure read-only Babylon canvas. Use local geometry, show single map tile, player/enemy, gathering nodes. Render state; no API calls, rewards, clocks, or simulation. Graceful message for missing WebGL, dispose all engine resources, support reduced motion. Viewer closed by default and not necessary to play.
