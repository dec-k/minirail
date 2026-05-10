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

SvelteKit 2 + **Svelte 5 runes** + TypeScript + Tailwind 4 (`@tailwindcss/vite`, imported in [src/routes/layout.css](src/routes/layout.css)). Vercel adapter is configured but the app is fully client-rendered after hydration.

## Architecture: the railway domain

The interesting code lives under [src/lib/railway/](src/lib/railway/). It is organised so that adding a new track piece type (crossing, double-slip, etc.) only requires editing one table.

### Track-piece model — port-based, declarative

A tile is a unit square. Each edge has a midpoint (a _port_) numbered N=0, E=1, S=2, W=3. A `TilePath` is just `{ from: Dir, to: Dir }` — the two ports it connects. Pieces are declared by listing their base paths, then rotated at runtime:

- [pieces.ts](src/lib/railway/pieces.ts) — `BASE_PATHS` maps each `PieceKind` to its rotation-0 paths. `pathsOf(piece)` rotates the ports via `rotateDir`. **To add a new piece type: add a row to `BASE_PATHS` and extend the `PieceKind` union in [types.ts](src/lib/railway/types.ts).** Geometry, rendering, and routing all flow from this table — no other code changes needed unless the piece needs new switch-like state.
- [geometry.ts](src/lib/railway/geometry.ts) — `sample(path, t)` returns `{x, y, heading}` in tile-local 0..1 space. A path is a straight line iff `from` and `to` are opposite (`(from + 2) % 4 === to`); otherwise it's a quarter-circle whose centre is the corner shared by the two adjacent ports. `svgPathD` produces SVG `d` attributes for rendering. Heading uses screen-space convention (y-down).

### Switches

Switches are pieces with **two paths sharing one common port** (W in base orientation). `Piece.active: 0|1` selects which branch is routed when the loco enters via the common port; entries from the other ports unambiguously match a single path and ignore `active`.

### Reactive state — `.svelte.ts` modules

Module-level `$state` is used for the world and the simulation:

- [grid.svelte.ts](src/lib/railway/grid.svelte.ts) — exports `grid` (`SvelteMap<"x,y", Piece>` plus `width`/`height`) and mutators `placePiece`, `rotateAt`, `toggleAt`, `removeAt`, `clearAll`, `resize`. **Use `SvelteMap` (not plain `Map`) so mutations stay reactive.** Grid size is mutable for future resize UI.
- [sim.svelte.ts](src/lib/railway/sim.svelte.ts) — exports `sim` (loco + running flag + speed) and `play` / `pause` / `placeLoco` / `setSpeed`. The loop is a `requestAnimationFrame` driver that reads `grid` read-only.

The two state modules are intentionally separate so that editing the world while the loco is running cannot corrupt mid-step state.

### Movement algorithm

`step(loco, distance)` in [sim.svelte.ts](src/lib/railway/sim.svelte.ts) advances the loco by a distance in tile units, carrying remainder across tile boundaries in a `while` loop (so high speed / dropped frames don't skip tiles). Path lengths differ — straight = 1, curve = π/4 — so distance is the right currency, not `t`. The loco state `{x, y, pathIdx, t, dir}` is enough to fully specify position.

At a tile boundary the algorithm:

1. Computes the exit port from the current path + direction.
2. Steps to the neighbour tile via `dx`/`dy` lookup tables; the entry port is the opposite.
3. Collects all candidate paths in the neighbour whose `from` or `to` equals the entry port. **Zero candidates → derail (`stopped = true`); multiple candidates → it's a switch facing-point, pick `paths[active]`.**
4. Sets new `pathIdx`, `dir` (+1 if entered via `from`, −1 if entered via `to`), and `t` (0 or 1).

### Coordinate spaces — three of them

1. **Tile-local 0..1**: returned by `geometry.sample` and `svgPathD`. y goes down.
2. **Grid-integer**: `loco.x`, `loco.y`, and `cellKey(x, y)` keys.
3. **Screen pixels**: `TILE` constant in [Board.svelte](src/lib/components/Board.svelte) (currently 40). The Board multiplies tile-local coords by `TILE` when rendering.

### UI

- [Board.svelte](src/lib/components/Board.svelte) — single SVG. Click handler resolves grid coordinates via `getScreenCTM().inverse()` (so it stays correct under CSS transforms). **Shift+click on a switch toggles `active` regardless of selected tool**, including while the loco is running. Inactive switch branches render dimmer.
- [Toolbar.svelte](src/lib/components/Toolbar.svelte) — owns the `tool` selection (`bind:tool` from the page).
- [+page.svelte](src/routes/+page.svelte) — composes them.

## Conventions

- State modules use the `.svelte.ts` extension so the Svelte compiler processes their `$state`/`$derived`. Plain `.ts` files cannot use runes.
- The graphics are intentionally placeholder (rectangles, basic SVG strokes). Don't introduce a sprite/asset pipeline without checking with the user.
- `.claude/settings.local.json` is gitignored; project-level `.claude/settings.json` (if added later) would be trackable.
