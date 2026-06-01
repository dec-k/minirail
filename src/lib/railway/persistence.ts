import { browser } from '$app/environment';
import {
	grid,
	clearAll,
	resize,
	setPiece,
	setStation,
	setDecoration,
	placementFx
} from './grid.svelte';
import { sim, replaceLocos, clearAllLocos, MAX_THROTTLE, type SavedLocoState } from './sim.svelte';
import {
	DECORATION_KINDS,
	isSwitch,
	type DecorationKind,
	type Piece,
	type PieceKind,
	type Rotation
} from './types';
import { setLoaded, markClean, clearLoaded } from './doc.svelte';

export const SCHEMA_VERSION = 5 as const;
// Older save versions we can still read. Each one needs an explicit upgrade
// path in `parseLayout`. v4 added per-loco reverser + throttle; v5 added the
// per-loco name. Earlier saves omit these and load with the neutral /
// default-throttle / unnamed fallbacks.
const SUPPORTED_VERSIONS = new Set([1, 2, 3, 4, 5]);
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
	const locos: SavedLocoState[] = sim.locos.map((l) => {
		const out: SavedLocoState = {
			x: l.x,
			y: l.y,
			pathIdx: l.pathIdx,
			t: l.t,
			dir: l.dir,
			color: l.color,
			wagons: l.wagons.length,
			reverser: l.reverser,
			throttle: l.throttle
		};
		if (l.name.trim()) out.name = l.name;
		if (l.autoReverse) out.autoReverse = true;
		if (l.switchLine) out.switchLine = true;
		return out;
	});
	return {
		version: SCHEMA_VERSION,
		name,
		savedAt: Date.now(),
		grid: { width: grid.width, height: grid.height, cells, stations, decorations },
		locos
	};
}

// Bulk-restore a layout onto the canvas. `key` is the localStorage suffix when
// loading from a saved entry; pass null for file/paste imports (the doc has a
// name but no persisted key yet — first Save will prompt for one).
export function applyLayout(layout: SavedLayout, key: string | null = null) {
	// Suppress the per-tile snap-in transition while bulk-restoring; a freshly
	// loaded layout otherwise plays the placement animation dozens of times at
	// once. Re-enabled after the current render flush.
	placementFx.suppressIntro = true;
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
	// Mutations above flip the dirty flag; reset it now that the load is the
	// authoritative state, then bind the doc to its key + name.
	setLoaded(key, layout.name);
	if (browser) {
		requestAnimationFrame(() => {
			placementFx.suppressIntro = false;
		});
	} else {
		placementFx.suppressIntro = false;
	}
}

// Wipe the canvas and reset the document state. Used by the "New" action.
export function newDocument() {
	placementFx.suppressIntro = true;
	clearAllLocos();
	clearAll();
	clearLoaded();
	if (browser) {
		requestAnimationFrame(() => {
			placementFx.suppressIntro = false;
		});
	} else {
		placementFx.suppressIntro = false;
	}
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
		const out: SavedLocoState = {
			x: ll.x,
			y: ll.y,
			pathIdx: ll.pathIdx,
			t: ll.t,
			dir: ll.dir as 1 | -1,
			color: ll.color,
			wagons: Math.max(0, Math.floor(ll.wagons))
		};
		if (typeof ll.name === 'string' && ll.name.trim()) out.name = ll.name.slice(0, 40);
		// reverser/throttle were added in schema v4; older saves omit them and
		// replaceLocos falls back to neutral / default throttle.
		if (ll.reverser === -1 || ll.reverser === 0 || ll.reverser === 1) {
			out.reverser = ll.reverser;
		}
		if (typeof ll.throttle === 'number' && Number.isFinite(ll.throttle)) {
			out.throttle = Math.max(0, Math.min(MAX_THROTTLE, ll.throttle));
		}
		if (ll.autoReverse === true) out.autoReverse = true;
		if (ll.switchLine === true) out.switchLine = true;
		return out;
	});
	return {
		version: SCHEMA_VERSION,
		name,
		savedAt,
		grid: { width: g.width, height: g.height, cells, stations, decorations },
		locos
	};
}

// `key` is the localStorage key suffix (the part after STORAGE_PREFIX) — the
// only stable identifier for a saved entry. `name` is the human label from the
// JSON body and may collide across entries (older saves, manual edits).
export type SavedEntry = { key: string; name: string; savedAt: number };

export function listLocalSaves(): SavedEntry[] {
	if (!browser) return [];
	// Dedupe defensively by storage key. localStorage already enforces unique
	// keys, but the each-block consumer crashes hard on key collisions, so
	// guarantee uniqueness at the source.
	const seen = new Map<string, SavedEntry>();
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
		const raw = localStorage.getItem(k);
		if (!raw) continue;
		const suffix = k.slice(STORAGE_PREFIX.length);
		try {
			const parsed = JSON.parse(raw) as Partial<SavedLayout>;
			seen.set(suffix, {
				key: suffix,
				name: parsed.name ?? suffix,
				savedAt: parsed.savedAt ?? 0
			});
		} catch {
			// Skip corrupt entries rather than crashing the listing.
		}
	}
	const out = [...seen.values()];
	out.sort((a, b) => b.savedAt - a.savedAt);
	return out;
}

// Persist the canvas as a new entry under `name`. The storage key is derived
// from the (trimmed) name — collisions overwrite, so the UI is responsible for
// warning the user before calling this with an existing name. After saving,
// the doc becomes the loaded document at this key.
export function saveAs(name: string): SavedLayout {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Name cannot be empty.');
	const layout = serializeLayout(trimmed);
	if (browser) {
		localStorage.setItem(STORAGE_PREFIX + trimmed, JSON.stringify(layout));
	}
	setLoaded(trimmed, trimmed);
	return layout;
}

// Persist the canvas back to its currently-loaded localStorage key. The name
// in the saved JSON is whatever the doc's display name is — typically the same
// as the key, but kept independent so future rename support is possible.
export function saveCurrent(key: string, name: string): SavedLayout {
	const trimmedName = name.trim() || key;
	const layout = serializeLayout(trimmedName);
	if (browser) {
		localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(layout));
	}
	markClean();
	return layout;
}

export function localSaveExists(key: string): boolean {
	if (!browser) return false;
	return localStorage.getItem(STORAGE_PREFIX + key.trim()) !== null;
}

export function loadLocalByKey(key: string): SavedLayout | null {
	if (!browser) return null;
	const raw = localStorage.getItem(STORAGE_PREFIX + key);
	if (!raw) return null;
	return parseLayout(raw);
}

export function deleteLocalByKey(key: string) {
	if (!browser) return;
	localStorage.removeItem(STORAGE_PREFIX + key);
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
