# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev         # Vite dev server (auto-picks free port; commonly 5173+)
npm run build       # Production build (Vercel adapter)
npm run preview     # Preview the production build
npm run check       # svelte-kit sync + svelte-check (type + a11y)
npm run check:watch # same, watching
npm run lint        # prettier --check + eslint
npm run format      # prettier --write
```

There are no tests in this repo yet.

## Stack

SvelteKit 2 + **Svelte 5 runes** + TypeScript + Tailwind 4 (`@tailwindcss/vite`, imported in [src/routes/layout.css](src/routes/layout.css)). Vercel adapter is configured but the app is fully client-rendered after hydration. shadcn-style primitives live under [src/lib/components/ui/](src/lib/components/ui/) — they're checked in, not a dependency.

## Architecture: the railway domain

The interesting code lives under [src/lib/railway/](src/lib/railway/). It is organised so that adding a new track piece type (crossing, double-slip, etc.) only requires editing one table.

### Track-piece model — port-based, declarative

A tile is a unit square. Each edge has a midpoint (a _port_) numbered N=0, E=1, S=2, W=3. A `TilePath` is just `{ from: Dir, to: Dir }` — the two ports it connects. Pieces are declared by listing their base paths, then rotated at runtime:

- [pieces.ts](src/lib/railway/pieces.ts) — `BASE_PATHS` maps each `PieceKind` to its rotation-0 paths. `pathsOf(piece)` rotates the ports via `rotateDir`. **To add a new piece type: add a row to `BASE_PATHS` and extend the `PieceKind` union in [types.ts](src/lib/railway/types.ts).** Geometry, rendering, and routing all flow from this table — no other code changes needed unless the piece needs new switch-like state. `resolveSinglePathPiece` and `resolveSwitchForPaths` derive the right kind+rotation from a desired `{from, to}` — this is what powers the drag-to-draw-track tool.
- [geometry.ts](src/lib/railway/geometry.ts) — `sample(path, t)` returns `{x, y, heading}` in tile-local 0..1 space. A path is a straight line iff `from` and `to` are opposite (`(from + 2) % 4 === to`); otherwise it's a quarter-circle whose centre is the corner shared by the two adjacent ports. `pathLength(path)` is `1` for straights, `π/4` for curves — distance, not `t`, is the right currency for movement. `svgPathD` produces SVG `d` attributes for rendering. Heading uses screen-space convention (y-down).

### Switches

Switches are pieces with **two paths sharing one common port** (W in base orientation). `Piece.active: 0|1` selects which branch a vehicle takes at the facing-point (entering via the common port); entries from the other ports unambiguously match a single path and ignore `active`. Trailing-point joins are handled by the routing trail (see below).

### Reactive state — `.svelte.ts` modules

Module-level `$state` is used for all world and simulation state. Four independent stores:

- [grid.svelte.ts](src/lib/railway/grid.svelte.ts) — exports `grid` with `width`, `height`, and four `SvelteMap`s keyed by `"x,y"`:
  - `cells: Piece` — track pieces
  - `stations: Station` — platforms (only meaningful on cells that also hold track)
  - `decorations: Decoration` — tree/building/water; **mutually exclusive with track at the same cell**
  - `groundOvers: Decoration` — grass/stone; render *under* track and may coexist with anything

  Mutators: `placePiece`, `setPiece`, `rotateAt`, `toggleAt`, `removeAt`, `drawPath`, `toggleStationAt`, `placeDecoration`, `setDecoration`, `clearAll`, `resize`. **Use `SvelteMap` (not plain `Map`) so mutations stay reactive.** Edits call `markDirty()` from `doc.svelte.ts` so the UI can show an "unsaved" indicator; bulk-restore paths (`setPiece`, `setDecoration`) deliberately skip `markDirty` because they're driven by `applyLayout`.

- [sim.svelte.ts](src/lib/railway/sim.svelte.ts) — exports `sim = { locos: Loco[] }` plus all loco/wagon lifecycle. A `requestAnimationFrame` driver reads `grid` read-only and **self-cancels** via `shouldAnimate()` (true when any loco is moving, any train is boarding, any station has spawn capacity, or any particle is alive). After mutating world state that should wake animation (e.g. placing a station), call `kickSimulation()`.

- [doc.svelte.ts](src/lib/railway/doc.svelte.ts) — exports `doc = { key, name, dirty }`. `key` is the localStorage suffix (after `STORAGE_PREFIX`) of the currently-loaded save, or `null` for fresh/imported canvases. Grid and sim mutators call `markDirty()`; bulk loads call `setLoaded` / `clearLoaded`, which reset the flag **after** the mutators fire so they override the intermediate dirty marks.

- [particles.svelte.ts](src/lib/railway/particles.svelte.ts) — ephemeral steam puffs in grid-tile coordinates. Spawned by moving locos, ticked from the sim loop, kept separate so particle-only renders don't re-derive loco state.

The stores are intentionally split: grid is the editable world, sim is the running simulation, doc is the save-metadata layer. Editing the world while a loco is running cannot corrupt mid-step state because `step()` reads `grid` snapshot-style each frame.

### Persistence

[persistence.ts](src/lib/railway/persistence.ts) owns save/load. `SCHEMA_VERSION` is currently `3` and `SUPPORTED_VERSIONS` lists older schemas `parseLayout` can upgrade from — when changing the on-disk shape, bump `SCHEMA_VERSION` and extend the parser, don't drop older versions silently. Saves live in `localStorage` under `STORAGE_PREFIX + name`; the doc binds to that key once saved. File import (`readLayoutFromFile`) and JSON export (`downloadLayout` / `exportToJsonString`) share the same `SavedLayout` shape.

Groundovers and decorations serialise into a single on-disk `decorations` array; `setDecoration` routes by kind back into the right map on load.

### Locomotives, wagons, and physics

A `Loco` is a `Vehicle` (`{x, y, pathIdx, t, dir, stopped, routingCursor}`) plus throttle/reverser, a `wagons: Vehicle[]` array, a `passengers: string[]` array (each entry is the cellKey of the boarding station), boarding-state fields, and two behaviour flags (`autoReverse`, `switchLine`). Many locos can exist on one layout; each draws a colour from `LOCO_COLORS`.

Movement is **physics-based**, not constant-velocity:

- Per-loco `speed` ramps toward `throttle` (when powered) or `0` (braking) at `ACCELERATION` / `DECELERATION` rates — brakes are deliberately stronger than accel so stops feel snappy.
- Each frame, three independent lookaheads scan the route from the leading vehicle: `distanceToNextStop` (next station that would actually do something — drop off a foreign passenger or board a new one), `distanceToNextVehicle` (collision with another train: same tile *and* same pathIdx), `distanceToDeadEnd`. The min is the obstacle distance; within `APPROACH_DIST` the throttle target attenuates linearly so the train arrives at zero speed.
- `step(vehicle, distance, motionSign, trail, siblings)` walks one vehicle by a distance, carrying remainder across tile boundaries in a `while` loop (high speed / dropped frames don't skip tiles). It's used for the loco, each wagon, and the wagon-placement probe.
- When reversing (`reverser = -1`), the **rearmost wagon is the leader** for obstacle lookups.
- At a dead end (within `DEAD_END_SNAP` of the wall), `resolveDeadEnd` either flips the reverser (`autoReverse` on) or drops it to neutral (off).

### Routing across switches — the trail

The naive rule ("at a facing-point, pick `paths[active]`") would derail wagons when a user throws a switch mid-train, because each car would consult the switch independently. To keep a train coherent:

- Each loco owns a `routingTrail: RoutingDecision[]` of `{tileKey, entryPort, pathIdx}` entries — the chain of choices made at facing-points.
- When a vehicle hits a facing-point (multiple candidates), it scans the trail from its own `routingCursor`. **Match found** → reuse that pathIdx (follow the train). **No match but a sibling sits on the destination tile** → adopt the sibling's pathIdx (covers reverse re-entries via the common port, where the original forward entry has a different entryPort). **Neither** → act as leader: pick `paths[active]`, append to the trail, advance the cursor.
- `pruneTrail` trims entries every car has passed.
- `switchLine` mode: on tile exit, toggle any switch the loco just left — turns the loco into a sequencer that alternates a switch on every pass.

### Stations and passengers

Stations only exist on cells that already contain track. Each station has `peopleWaiting` and a `spawnTimer` ticking at `STATION_SPAWN_INTERVAL` up to `STATION_CAPACITY`. Stations actively being boarded freeze their spawn timer.

`shouldStopAt(loco, key)` returns true only when stopping would *do something* — drop off a foreign-origin passenger (one whose recorded boarding key isn't this station) or board a new one with wagon capacity to spare. Boarding ticks at `BOARDING_INTERVAL`: phase 1 dismounts one foreign passenger, phase 2 boards one waiting person. `lastBoardedAt` suppresses re-triggering on the same tile until the loco physically leaves. Passengers per loco are capped by `wagons.length`.

### Coordinate spaces — three of them

1. **Tile-local 0..1**: returned by `geometry.sample` and `svgPathD`. y goes down.
2. **Grid-integer**: `loco.x`, `loco.y`, and `cellKey(x, y)` keys.
3. **Screen pixels**: `TILE` constant in [Board.svelte](src/lib/components/Board.svelte) (currently 56). Board multiplies tile-local coords by `TILE` when rendering.

### UI

- [Board.svelte](src/lib/components/Board.svelte) — single SVG (~1000 lines, candidate for splitting). Click handler resolves grid coordinates via `getScreenCTM().inverse()` (stays correct under CSS transforms). The `tool` prop drives click behaviour: `draw` is the drag-to-lay-track mode (uses `drawPath`); `straight` / `curve` / `switch-*` stamp pieces; `loco` / `station` / `decorate` / `erase` / `pan` are self-explanatory. **Shift+click on a switch toggles `active` regardless of selected tool**, including while a loco is running. Inactive switch branches render dimmer. `placementFx.suppressIntro` is flipped during bulk loads so the per-tile snap-in animation does not fire dozens of times at once.
- [ToolPalette.svelte](src/lib/components/ToolPalette.svelte) — owns `tool` and `decorationKind` selection (both `bind:`-ed from the page).
- [LocoPanel.svelte](src/lib/components/LocoPanel.svelte) — per-loco controls (throttle, reverser, wagons, autoReverse, switchLine).
- [MainMenu.svelte](src/lib/components/MainMenu.svelte) — save/load/new/import/export dialogs. Drives `doc.svelte.ts` state.
- [LandingScreen.svelte](src/lib/components/LandingScreen.svelte) — pre-canvas intro screen.
- [+page.svelte](src/routes/+page.svelte) — composes them; gates the canvas behind the landing screen via a `started` flag.

## Conventions

- State modules use the `.svelte.ts` extension so the Svelte compiler processes their `$state`/`$derived`. Plain `.ts` files cannot use runes.
- The graphics are intentionally placeholder (SVG primitives, deterministic hash-jittered decoration sprites via [decorations.ts](src/lib/railway/decorations.ts)). Don't introduce a sprite/asset pipeline without checking with the user.
- Decoration positions are hash-keyed on `(x, y, salt)` so they stay stable across renders, view switches, and reloads.
- `.claude/settings.local.json` is gitignored; project-level `.claude/settings.json` (if added later) would be trackable.
