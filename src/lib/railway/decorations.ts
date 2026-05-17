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
