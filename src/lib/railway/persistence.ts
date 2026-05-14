import { browser } from '$app/environment';
import { grid, clearAll, resize, setPiece, setStation, setDecoration } from './grid.svelte';
import { sim, replaceLocos, clearAllLocos, type SavedLocoState } from './sim.svelte';
import {
	DECORATION_KINDS,
	isSwitch,
	type DecorationKind,
	type Piece,
	type PieceKind,
	type Rotation
} from './types';

export const SCHEMA_VERSION = 3 as const;
// Older save versions we can still read. Each one needs an explicit upgrade
// path in `parseLayout`.
const SUPPORTED_VERSIONS = new Set([1, 2, 3]);
export const STORAGE_PREFIX = 'minirail:save:';

export type SavedCell = {
	x: number;
	y: number;
	kind: PieceKind;
	rotation: Rotation;
	active?: 0 | 1;
};

export type SavedDecoration = { x: number; y: number; kind: DecorationKind };

export type SavedLayout = {
	version: typeof SCHEMA_VERSION;
	name: string;
	savedAt: number;
	grid: {
		width: number;
		height: number;
		cells: SavedCell[];
		stations: { x: number; y: number }[];
		decorations: SavedDecoration[];
	};
	locos: SavedLocoState[];
};

export function serializeLayout(name: string): SavedLayout {
	const cells: SavedCell[] = [];
	for (const [k, piece] of grid.cells) {
		const [x, y] = k.split(',').map(Number);
		const entry: SavedCell = { x, y, kind: piece.kind, rotation: piece.rotation };
		if (isSwitch(piece.kind)) entry.active = (piece.active ?? 0) as 0 | 1;
		cells.push(entry);
	}
	const stations: { x: number; y: number }[] = [];
	for (const k of grid.stations.keys()) {
		const [x, y] = k.split(',').map(Number);
		stations.push({ x, y });
	}
	const decorations: SavedDecoration[] = [];
	for (const [k, deco] of grid.decorations) {
		const [x, y] = k.split(',').map(Number);
		decorations.push({ x, y, kind: deco.kind });
	}
	// Groundovers (grass/stone) live in a separate map at runtime but share the
	// decorations array on disk — `setDecoration` routes by kind on apply.
	for (const [k, deco] of grid.groundOvers) {
		const [x, y] = k.split(',').map(Number);
		decorations.push({ x, y, kind: deco.kind });
	}
	const locos: SavedLocoState[] = sim.locos.map((l) => ({
		x: l.x,
		y: l.y,
		pathIdx: l.pathIdx,
		t: l.t,
		dir: l.dir,
		color: l.color,
		wagons: l.wagons.length
	}));
	return {
		version: SCHEMA_VERSION,
		name,
		savedAt: Date.now(),
		grid: { width: grid.width, height: grid.height, cells, stations, decorations },
		locos
	};
}

export function applyLayout(layout: SavedLayout) {
	clearAllLocos();
	clearAll();
	resize(layout.grid.width, layout.grid.height);
	for (const c of layout.grid.cells) {
		const piece: Piece = isSwitch(c.kind)
			? { kind: c.kind, rotation: c.rotation, active: (c.active ?? 0) as 0 | 1 }
			: { kind: c.kind, rotation: c.rotation };
		setPiece(c.x, c.y, piece);
	}
	for (const s of layout.grid.stations) setStation(s.x, s.y);
	for (const d of layout.grid.decorations) setDecoration(d.x, d.y, d.kind);
	replaceLocos(layout.locos);
}

const VALID_KINDS: PieceKind[] = ['straight', 'curve', 'switch-left', 'switch-right'];

// Throws on invalid input. The error messages are user-facing.
export function parseLayout(json: string): SavedLayout {
	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch {
		throw new Error('File is not valid JSON.');
	}
	if (!raw || typeof raw !== 'object') throw new Error('Save file is empty or malformed.');
	const r = raw as Record<string, unknown>;
	if (typeof r.version !== 'number' || !SUPPORTED_VERSIONS.has(r.version)) {
		throw new Error(`Unsupported save version: ${String(r.version)}.`);
	}
	const name = typeof r.name === 'string' ? r.name : 'Imported layout';
	const savedAt = typeof r.savedAt === 'number' ? r.savedAt : Date.now();
	const g = r.grid as Record<string, unknown> | undefined;
	if (!g || typeof g.width !== 'number' || typeof g.height !== 'number') {
		throw new Error('Save is missing grid dimensions.');
	}
	const rawCells = Array.isArray(g.cells) ? (g.cells as unknown[]) : [];
	const cells: SavedCell[] = rawCells.map((c, i) => {
		const cc = c as Record<string, unknown>;
		if (
			typeof cc.x !== 'number' ||
			typeof cc.y !== 'number' ||
			typeof cc.kind !== 'string' ||
			typeof cc.rotation !== 'number'
		) {
			throw new Error(`Cell ${i} is malformed.`);
		}
		if (!VALID_KINDS.includes(cc.kind as PieceKind)) {
			throw new Error(`Cell ${i} has unknown piece kind "${cc.kind}".`);
		}
		const rot = ((cc.rotation as number) % 4) as Rotation;
		const out: SavedCell = { x: cc.x, y: cc.y, kind: cc.kind as PieceKind, rotation: rot };
		if (cc.active === 0 || cc.active === 1) out.active = cc.active;
		return out;
	});
	const rawStations = Array.isArray(g.stations) ? (g.stations as unknown[]) : [];
	const stations = rawStations.map((s, i) => {
		const ss = s as Record<string, unknown>;
		if (typeof ss.x !== 'number' || typeof ss.y !== 'number') {
			throw new Error(`Station ${i} is malformed.`);
		}
		return { x: ss.x, y: ss.y };
	});
	const rawDecorations = Array.isArray(g.decorations) ? (g.decorations as unknown[]) : [];
	const decorations: SavedDecoration[] = rawDecorations.map((d, i) => {
		const dd = d as Record<string, unknown>;
		if (
			typeof dd.x !== 'number' ||
			typeof dd.y !== 'number' ||
			typeof dd.kind !== 'string' ||
			!DECORATION_KINDS.includes(dd.kind as DecorationKind)
		) {
			throw new Error(`Decoration ${i} is malformed.`);
		}
		return { x: dd.x, y: dd.y, kind: dd.kind as DecorationKind };
	});
	const rawLocos = Array.isArray(r.locos) ? (r.locos as unknown[]) : [];
	const locos: SavedLocoState[] = rawLocos.map((l, i) => {
		const ll = l as Record<string, unknown>;
		if (
			typeof ll.x !== 'number' ||
			typeof ll.y !== 'number' ||
			typeof ll.pathIdx !== 'number' ||
			typeof ll.t !== 'number' ||
			(ll.dir !== 1 && ll.dir !== -1) ||
			typeof ll.color !== 'string' ||
			typeof ll.wagons !== 'number'
		) {
			throw new Error(`Loco ${i} is malformed.`);
		}
		return {
			x: ll.x,
			y: ll.y,
			pathIdx: ll.pathIdx,
			t: ll.t,
			dir: ll.dir as 1 | -1,
			color: ll.color,
			wagons: Math.max(0, Math.floor(ll.wagons))
		};
	});
	return {
		version: SCHEMA_VERSION,
		name,
		savedAt,
		grid: { width: g.width, height: g.height, cells, stations, decorations },
		locos
	};
}

export type SavedEntry = { name: string; savedAt: number };

export function listLocalSaves(): SavedEntry[] {
	if (!browser) return [];
	const out: SavedEntry[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
		const raw = localStorage.getItem(k);
		if (!raw) continue;
		try {
			const parsed = JSON.parse(raw) as Partial<SavedLayout>;
			out.push({
				name: parsed.name ?? k.slice(STORAGE_PREFIX.length),
				savedAt: parsed.savedAt ?? 0
			});
		} catch {
			// Skip corrupt entries rather than crashing the listing.
		}
	}
	out.sort((a, b) => b.savedAt - a.savedAt);
	return out;
}

export function saveLocal(name: string): SavedLayout {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Name cannot be empty.');
	const layout = serializeLayout(trimmed);
	if (browser) {
		localStorage.setItem(STORAGE_PREFIX + trimmed, JSON.stringify(layout));
	}
	return layout;
}

export function loadLocal(name: string): SavedLayout | null {
	if (!browser) return null;
	const raw = localStorage.getItem(STORAGE_PREFIX + name);
	if (!raw) return null;
	return parseLayout(raw);
}

export function deleteLocal(name: string) {
	if (!browser) return;
	localStorage.removeItem(STORAGE_PREFIX + name);
}

// Triggers a browser download of the layout as a .json file. Filename is
// derived from the layout name with non-filesystem-safe chars stripped.
export function downloadLayout(layout: SavedLayout) {
	if (!browser) return;
	const json = JSON.stringify(layout, null, 2);
	const safe = layout.name.replace(/[^a-z0-9_\-]+/gi, '_').replace(/^_+|_+$/g, '') || 'layout';
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${safe}.minirail.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export function readLayoutFromFile(file: File): Promise<SavedLayout> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('Could not read file.'));
		reader.onload = () => {
			try {
				resolve(parseLayout(String(reader.result ?? '')));
			} catch (err) {
				reject(err);
			}
		};
		reader.readAsText(file);
	});
}

// Used by the UI's "copy JSON" affordance, which is the portable share path.
export function exportToJsonString(layout: SavedLayout): string {
	return JSON.stringify(layout, null, 2);
}
