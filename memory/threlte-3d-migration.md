---
name: threlte-3d-migration
description: Ongoing migration of the board renderer to a real 3D (Threlte/three.js) diorama view
metadata:
  type: project
---

The board is gaining a genuine 3D "pop-up book / diorama" renderer alongside the SVG one, chosen over a CSS-3D-tilt hack because only real 3D breaks the depth/occlusion/lighting/edit-while-tilted ceiling. Feasible because the domain layer (`pieces`, `geometry`, `grid`, `sim`) is renderer-agnostic — it's a view-layer swap.

Stack: `three` + `@threlte/core` (Threlte 8) + `@threlte/extras`. New code under [src/lib/components/board3d/](src/lib/components/board3d/) and `Board3D.svelte`. Mapping: ground = XZ plane, Y up; tile-local `sample()` y → world Z. Pointer→cell uses raycasting onto the ground plane (replaces `getScreenCTM`), so editing works at any camera angle.

The diorama toggle (`view.tilted` in [view.svelte.ts](src/lib/railway/view.svelte.ts)) now swaps SVG `Board` ↔ `Board3D` in [+page.svelte](src/routes/+page.svelte). The earlier SVG CSS-tilt + `.standee` pop-up code is now dormant (only ran when SVG was tilted, which no longer happens) — decide its fate at Stage 5.

Staged plan: **0+1 DONE** (deps, ground+grid+track meshes, perspective camera w/ OrbitControls, raycast place/erase/rotate/station/loco/decorate; `draw` tool stubs a straight on click). **2 DONE** (trees=trunk+2 cones, buildings=box+pyramid-cone roof, water plane, grass/stone groundovers, stations=platform+shelter+people; all cast/receive shadows; reuses the same `decorations.ts` spot helpers as SVG). **3 DONE** (locos=chassis+boiler+cab+chimney+lamp, wagons w/ passenger nub, steam particles as rising unlit spheres; poses `$derived` from `sim.locos` each frame via the same `sample()` the SVG uses, `rotation.y = -heading`). **4** parity (drag-draw, loco passenger badges, dark-mode lighting, camera pan) + perf (instancing for dense decoration — currently ~24 meshes per tree tile). **5** decide default vs toggle, and whether to remove the dormant SVG tilt code.

Constraint from [CLAUDE.md](CLAUDE.md): no sprite/asset pipeline without asking — 3D work stays primitives-only (built-in geometries, no textures/GLTF) until the user okays otherwise. See [[pseudo-3d-aesthetic-direction]].
