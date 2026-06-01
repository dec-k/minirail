import type { DecorationKind } from './types';

// 32-bit integer mixer producing a value in [0, 1). Deterministic per (x, y,
// salt) so positions stay stable across renders, view switches, and reloads.
function hash2(x: number, y: number, salt: number): number {
	let h =
		(Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt, 1274126177)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h = (h ^ (h >>> 16)) >>> 0;
	return h / 4294967296;
}

// Eight tree positions per tile. The fixed base layout gives a consistent
// "cluster" silhouette; the hash jitter prevents adjacent tiles looking
// stamped from a single template, and varies trunk/foliage size.
const TREE_SEEDS: { px: number; py: number; r: number; salt: number }[] = [
	{ px: 0.16, py: 0.2, r: 0.2, salt: 1 },
	{ px: 0.5, py: 0.12, r: 0.21, salt: 2 },
	{ px: 0.84, py: 0.22, r: 0.19, salt: 3 },
	{ px: 0.28, py: 0.5, r: 0.22, salt: 4 },
	{ px: 0.72, py: 0.5, r: 0.22, salt: 5 },
	{ px: 0.18, py: 0.82, r: 0.2, salt: 6 },
	{ px: 0.55, py: 0.86, r: 0.21, salt: 7 },
	{ px: 0.86, py: 0.78, r: 0.19, salt: 8 }
];

export type TreeSpot = { cx: number; cy: number; r: number; tone: number };

// Deterministic tree positions in tile-local 0..1 coordinates. Positions are
// jittered around the fixed seed layout via hash2 so adjacent tiles don't
// look uniform but stay stable across renders.
export function treeSpots(x: number, y: number): TreeSpot[] {
	return TREE_SEEDS.map((s) => {
		const jx = (hash2(x, y, s.salt) - 0.5) * 0.06;
		const jy = (hash2(x, y, s.salt + 100) - 0.5) * 0.06;
		const rr = s.r * (0.9 + hash2(x, y, s.salt + 200) * 0.25);
		const tone = hash2(x, y, s.salt + 300);
		return { cx: s.px + jx, cy: s.py + jy, r: rr, tone };
	});
}

// Twelve stone positions per tile for the 'stone' groundover texture. Smaller
// pebbles scattered across the tile; same hash-based deterministic positioning
// as trees.
const STONE_SEEDS: { px: number; py: number; salt: number }[] = [
	{ px: 0.15, py: 0.18, salt: 11 },
	{ px: 0.42, py: 0.12, salt: 12 },
	{ px: 0.72, py: 0.2, salt: 13 },
	{ px: 0.88, py: 0.42, salt: 14 },
	{ px: 0.2, py: 0.4, salt: 15 },
	{ px: 0.5, py: 0.45, salt: 16 },
	{ px: 0.78, py: 0.6, salt: 17 },
	{ px: 0.12, py: 0.65, salt: 18 },
	{ px: 0.36, py: 0.72, salt: 19 },
	{ px: 0.6, py: 0.78, salt: 20 },
	{ px: 0.88, py: 0.82, salt: 21 },
	{ px: 0.28, py: 0.9, salt: 22 }
];

export type StoneSpot = { cx: number; cy: number; r: number; tone: number };

export function stoneSpots(x: number, y: number): StoneSpot[] {
	return STONE_SEEDS.map((s) => {
		const jx = (hash2(x, y, s.salt) - 0.5) * 0.05;
		const jy = (hash2(x, y, s.salt + 100) - 0.5) * 0.05;
		const r = 0.05 + hash2(x, y, s.salt + 200) * 0.05;
		const tone = hash2(x, y, s.salt + 300);
		return { cx: s.px + jx, cy: s.py + jy, r, tone };
	});
}

// Four mini-house positions per tile. Each tile of "building" decoration
// renders as a small cluster (village) rather than one large structure. Jitter
// keeps adjacent tiles from looking stamped; tone/roofTone drive per-house
// colour variation.
const BUILDING_SEEDS: { px: number; py: number; size: number; salt: number }[] = [
	{ px: 0.27, py: 0.4, size: 0.26, salt: 41 },
	{ px: 0.66, py: 0.32, size: 0.28, salt: 42 },
	{ px: 0.3, py: 0.74, size: 0.24, salt: 43 },
	{ px: 0.7, py: 0.7, size: 0.28, salt: 44 }
];

export type BuildingSpot = {
	cx: number;
	cy: number;
	size: number;
	tone: number;
	roofTone: number;
};

export function buildingSpots(x: number, y: number): BuildingSpot[] {
	return BUILDING_SEEDS.map((s) => {
		const jx = (hash2(x, y, s.salt) - 0.5) * 0.06;
		const jy = (hash2(x, y, s.salt + 100) - 0.5) * 0.06;
		const sz = s.size * (0.85 + hash2(x, y, s.salt + 200) * 0.3);
		const tone = hash2(x, y, s.salt + 300);
		const roofTone = hash2(x, y, s.salt + 400);
		return { cx: s.px + jx, cy: s.py + jy, size: sz, tone, roofTone };
	});
}

// Three wave-glint positions per water tile. Short pale horizontal segments
// scattered across the surface for a subtle ripple texture.
const WAVE_SEEDS: { px: number; py: number; salt: number }[] = [
	{ px: 0.3, py: 0.32, salt: 51 },
	{ px: 0.62, py: 0.55, salt: 52 },
	{ px: 0.42, py: 0.78, salt: 53 }
];

export type WaveGlint = { cx: number; cy: number; len: number };

export function waveGlints(x: number, y: number): WaveGlint[] {
	return WAVE_SEEDS.map((s) => {
		const jx = (hash2(x, y, s.salt) - 0.5) * 0.1;
		const jy = (hash2(x, y, s.salt + 100) - 0.5) * 0.08;
		const len = 0.08 + hash2(x, y, s.salt + 200) * 0.07;
		return { cx: s.px + jx, cy: s.py + jy, len };
	});
}

// Six tufts per tile for the 'grass' groundover texture in 2D. Small darker
// blades on top of the flat green base.
const GRASS_SEEDS: { px: number; py: number; salt: number }[] = [
	{ px: 0.2, py: 0.25, salt: 31 },
	{ px: 0.55, py: 0.18, salt: 32 },
	{ px: 0.82, py: 0.32, salt: 33 },
	{ px: 0.35, py: 0.6, salt: 34 },
	{ px: 0.7, py: 0.65, salt: 35 },
	{ px: 0.25, py: 0.85, salt: 36 },
	{ px: 0.8, py: 0.88, salt: 37 }
];

export type GrassTuft = { cx: number; cy: number; tone: number };

export function grassTufts(x: number, y: number): GrassTuft[] {
	return GRASS_SEEDS.map((s) => {
		const jx = (hash2(x, y, s.salt) - 0.5) * 0.06;
		const jy = (hash2(x, y, s.salt + 100) - 0.5) * 0.06;
		const tone = hash2(x, y, s.salt + 200);
		return { cx: s.px + jx, cy: s.py + jy, tone };
	});
}

// ---------------------------------------------------------------------------
// Neighbour-aware organic terrain borders
// ---------------------------------------------------------------------------

// Base fill colour of each rectangular-fill terrain. Centralised here so the
// tile components and the water-encroachment band stay in sync.
export const TERRAIN_COLORS: Record<DecorationKind, string> = {
	grass: '#9dd07a',
	stone: '#d4d4d8',
	water: '#3a8fc7',
	tree: '#3f6e2e',
	building: '#e0cfae'
};

// Which orthogonal neighbours share this tile's terrain. An edge that is
// `true` bleeds straight over the boundary; a `false` edge is pulled in and
// drawn organically.
export type EdgeNeighbours = { n: boolean; e: boolean; s: boolean; w: boolean };

type Pt = { x: number; y: number };

const f = (n: number): string => n.toFixed(2);
const p = (q: Pt): string => `${f(q.x)} ${f(q.y)}`;

// Outward overshoot on shared edges so neighbouring tiles overlap and the grid
// pattern can't show through the seam (mirrors the old water `0.6px` rect trick).
const OVERSHOOT = 0.6;

/**
 * Closed organic outline for a terrain tile plus the open sub-path of its
 * exposed edges (for a shoreline/edge highlight).
 *
 * Shared edges run along the tile boundary (with a hair of overshoot) so
 * contiguous regions tessellate seamlessly; exposed edges are inset and given
 * a gentle hash-jittered wave, and convex corners (two exposed edges meeting)
 * are rounded. All deterministic per (x, y) so the contour is stable across
 * renders and reloads.
 */
export function terrainBlob(
	x: number,
	y: number,
	same: EdgeNeighbours,
	tile: number
): { fill: string; shore: string } {
	const inset = tile * 0.06;
	const amp = tile * 0.04;
	const radius = tile * 0.16;

	// Edge positions: shared edges overshoot outward, exposed edges pull inward.
	const top = same.n ? -OVERSHOOT : inset;
	const bottom = same.s ? tile + OVERSHOOT : tile - inset;
	const left = same.w ? -OVERSHOOT : inset;
	const right = same.e ? tile + OVERSHOOT : tile - inset;

	const NW: Pt = { x: left, y: top };
	const NE: Pt = { x: right, y: top };
	const SE: Pt = { x: right, y: bottom };
	const SW: Pt = { x: left, y: bottom };

	// A corner is rounded only when both edges meeting there are exposed.
	const roundNW = !same.w && !same.n;
	const roundNE = !same.n && !same.e;
	const roundSE = !same.e && !same.s;
	const roundSW = !same.s && !same.w;

	// Clockwise edges (screen space, y-down). Each carries its exposure, the
	// inward normal used for the wave, and whether its endpoints are rounded.
	const edges = [
		{ a: NW, b: NE, exposed: !same.n, nx: 0, ny: 1, roundA: roundNW, roundB: roundNE, salt: 60 },
		{ a: NE, b: SE, exposed: !same.e, nx: -1, ny: 0, roundA: roundNE, roundB: roundSE, salt: 62 },
		{ a: SE, b: SW, exposed: !same.s, nx: 0, ny: -1, roundA: roundSE, roundB: roundSW, salt: 64 },
		{ a: SW, b: NW, exposed: !same.w, nx: 1, ny: 0, roundA: roundSW, roundB: roundNW, salt: 66 }
	];

	// Pull endpoints back from rounded corners and precompute control points.
	const segs = edges.map((e) => {
		const dx = e.b.x - e.a.x;
		const dy = e.b.y - e.a.y;
		const len = Math.hypot(dx, dy) || 1;
		const ux = dx / len;
		const uy = dy / len;
		const r = Math.min(radius, len * 0.4);
		const start: Pt = e.roundA ? { x: e.a.x + ux * r, y: e.a.y + uy * r } : e.a;
		const end: Pt = e.roundB ? { x: e.b.x - ux * r, y: e.b.y - uy * r } : e.b;
		const segLen = Math.hypot(end.x - start.x, end.y - start.y) || 1;
		// Wave: nudge the two cubic control points along the inward normal.
		const a1 = (hash2(x, y, e.salt) - 0.5) * 2 * amp;
		const a2 = (hash2(x, y, e.salt + 1) - 0.5) * 2 * amp;
		const c1: Pt = {
			x: start.x + ux * (segLen / 3) + e.nx * a1,
			y: start.y + uy * (segLen / 3) + e.ny * a1
		};
		const c2: Pt = {
			x: start.x + ux * (segLen * (2 / 3)) + e.nx * a2,
			y: start.y + uy * (segLen * (2 / 3)) + e.ny * a2
		};
		return { ...e, start, end, c1, c2 };
	});

	let fill = `M ${p(segs[0].start)} `;
	let shore = '';
	for (let i = 0; i < 4; i++) {
		const s = segs[i];
		fill += s.exposed ? `C ${p(s.c1)} ${p(s.c2)} ${p(s.end)} ` : `L ${p(s.end)} `;
		if (s.exposed) shore += `M ${p(s.start)} C ${p(s.c1)} ${p(s.c2)} ${p(s.end)} `;
		const next = segs[(i + 1) % 4];
		// Rounded corner: curve through the raw corner to the next start point.
		// Otherwise the two points coincide and the lineTo is zero-length.
		fill += s.roundB ? `Q ${p(s.b)} ${p(next.start)} ` : `L ${p(next.start)} `;
	}
	fill += 'Z';
	return { fill, shore };
}

const EDGE_BANDS: Record<'N' | 'E' | 'S' | 'W', { a: Pt; b: Pt; nx: number; ny: number }> = {
	N: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, nx: 0, ny: 1 },
	E: { a: { x: 1, y: 0 }, b: { x: 1, y: 1 }, nx: -1, ny: 0 },
	S: { a: { x: 1, y: 1 }, b: { x: 0, y: 1 }, nx: 0, ny: -1 },
	W: { a: { x: 0, y: 1 }, b: { x: 0, y: 0 }, nx: 1, ny: 0 }
};

/**
 * A band of a neighbour terrain encroaching into this tile along one edge: it
 * runs the full edge at the boundary and curves back along a hash-wavy inner
 * border. Used to bleed an adjacent grass/stone tile into a water tile so the
 * shoreline looks organic rather than a hard grid line.
 */
export function terrainEncroachBand(
	x: number,
	y: number,
	edge: 'N' | 'E' | 'S' | 'W',
	tile: number
): string {
	const cfg = EDGE_BANDS[edge];
	const depth = tile * 0.22;
	const amp = tile * 0.05;

	// Outer corners on the shared boundary, nudged out so no seam shows.
	const o0: Pt = { x: cfg.a.x * tile - cfg.nx * OVERSHOOT, y: cfg.a.y * tile - cfg.ny * OVERSHOOT };
	const o1: Pt = { x: cfg.b.x * tile - cfg.nx * OVERSHOOT, y: cfg.b.y * tile - cfg.ny * OVERSHOOT };
	// Inner corners, depth into the tile along the inward normal.
	const i0: Pt = { x: cfg.a.x * tile + cfg.nx * depth, y: cfg.a.y * tile + cfg.ny * depth };
	const i1: Pt = { x: cfg.b.x * tile + cfg.nx * depth, y: cfg.b.y * tile + cfg.ny * depth };

	// Wavy inner border from i1 back to i0, displaced along the inward normal.
	const tx = i0.x - i1.x;
	const ty = i0.y - i1.y;
	const len = Math.hypot(tx, ty) || 1;
	const ux = tx / len;
	const uy = ty / len;
	const a1 = (hash2(x, y, 70 + edge.charCodeAt(0)) - 0.5) * 2 * amp;
	const a2 = (hash2(x, y, 80 + edge.charCodeAt(0)) - 0.5) * 2 * amp;
	const c1: Pt = { x: i1.x + ux * (len / 3) + cfg.nx * a1, y: i1.y + uy * (len / 3) + cfg.ny * a1 };
	const c2: Pt = {
		x: i1.x + ux * (len * (2 / 3)) + cfg.nx * a2,
		y: i1.y + uy * (len * (2 / 3)) + cfg.ny * a2
	};
	return `M ${p(o0)} L ${p(o1)} L ${p(i1)} C ${p(c1)} ${p(c2)} ${p(i0)} Z`;
}
