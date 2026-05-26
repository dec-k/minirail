import { SvelteMap } from 'svelte/reactivity';
import {
	cellKey,
	isGroundOverKind,
	type Decoration,
	type DecorationKind,
	type Dir,
	type Piece,
	type PieceKind,
	type Rotation,
	type Station
} from './types';
import {
	newPiece,
	pathsOf,
	resolveSinglePathPiece,
	resolveSwitchForPaths,
	rotatePiece,
	toggleSwitch
} from './pieces';

export const grid = $state({
	width: 40,
	height: 30,
	cells: new SvelteMap<string, Piece>(),
	stations: new SvelteMap<string, Station>(),
	// Decorations that occupy empty cells exclusively (tree, building, water).
	// Mutually exclusive with track at the same cell.
	decorations: new SvelteMap<string, Decoration>(),
	// Groundcover (grass, stone) that renders underneath track. May coexist with
	// any cell contents.
	groundOvers: new SvelteMap<string, Decoration>()
});

// Bulk loaders (save/restore, templates) flip `suppressIntro` so the per-tile
// snap-in transition does not fire dozens of times when a whole layout drops in
// at once.
export const placementFx = $state({ suppressIntro: false });

export function getPiece(x: number, y: number): Piece | undefined {
	return grid.cells.get(cellKey(x, y));
}

export function placePiece(x: number, y: number, kind: PieceKind, rotation: Rotation = 0) {
	const k = cellKey(x, y);
	grid.decorations.delete(k);
	grid.cells.set(k, newPiece(kind, rotation));
}

// Restore a fully-formed piece (preserves switch `active` state). Used by the
// save/load system when applying a saved layout.
export function setPiece(x: number, y: number, piece: Piece) {
	grid.cells.set(cellKey(x, y), { ...piece });
}

// Restore a station at a cell that already contains track. No-op if the cell
// is empty. Used when applying a saved layout.
export function setStation(x: number, y: number) {
	const k = cellKey(x, y);
	if (!grid.cells.has(k)) return;
	const station: Station = $state({ peopleWaiting: 0, spawnTimer: 0 });
	grid.stations.set(k, station);
}

export function rotateAt(x: number, y: number) {
	const p = grid.cells.get(cellKey(x, y));
	if (p) grid.cells.set(cellKey(x, y), rotatePiece(p));
}

export function toggleAt(x: number, y: number) {
	const p = grid.cells.get(cellKey(x, y));
	if (p) grid.cells.set(cellKey(x, y), toggleSwitch(p));
}

export function removeAt(x: number, y: number) {
	const k = cellKey(x, y);
	grid.cells.delete(k);
	grid.stations.delete(k);
	grid.decorations.delete(k);
	grid.groundOvers.delete(k);
}

export function clearAll() {
	grid.cells.clear();
	grid.stations.clear();
	grid.decorations.clear();
	grid.groundOvers.clear();
}

export function getDecoration(x: number, y: number): Decoration | undefined {
	return grid.decorations.get(cellKey(x, y));
}

export function getGroundOver(x: number, y: number): Decoration | undefined {
	return grid.groundOvers.get(cellKey(x, y));
}

// Place a decoration at (x, y). Tree/building/water can only live on cells
// without track; grass/stone are groundovers that render under track and may
// coexist with any cell contents. The two layers are independent — placing
// grass on a tree-decorated cell adds grass under the tree.
//
// Toggle semantics apply within a layer: clicking the same kind that's already
// in that layer removes it; a different kind in the same layer replaces it.
export function placeDecoration(x: number, y: number, kind: DecorationKind) {
	const k = cellKey(x, y);
	if (isGroundOverKind(kind)) {
		const existing = grid.groundOvers.get(k);
		if (existing && existing.kind === kind) {
			grid.groundOvers.delete(k);
			return;
		}
		grid.groundOvers.set(k, { kind });
		return;
	}
	if (grid.cells.has(k)) return;
	const existing = grid.decorations.get(k);
	if (existing && existing.kind === kind) {
		grid.decorations.delete(k);
		return;
	}
	grid.decorations.set(k, { kind });
}

// Restore a decoration unconditionally. Used by the save/load system; routes
// to the correct layer based on kind.
export function setDecoration(x: number, y: number, kind: DecorationKind) {
	const k = cellKey(x, y);
	if (isGroundOverKind(kind)) {
		grid.groundOvers.set(k, { kind });
		return;
	}
	if (grid.cells.has(k)) return;
	grid.decorations.set(k, { kind });
}

export function removeDecorationAt(x: number, y: number) {
	const k = cellKey(x, y);
	grid.decorations.delete(k);
	grid.groundOvers.delete(k);
}

export function getStation(x: number, y: number): Station | undefined {
	return grid.stations.get(cellKey(x, y));
}

// Add or remove a station at (x, y). A station only exists alongside a track
// piece — placing on an empty cell is a no-op.
//
// The value is wrapped in $state(...) so that field mutations
// (peopleWaiting, spawnTimer) trigger reactive updates. SvelteMap itself only
// tracks add/delete/clear, not deep mutations on stored values.
export function toggleStationAt(x: number, y: number) {
	const k = cellKey(x, y);
	if (grid.stations.has(k)) {
		grid.stations.delete(k);
		return;
	}
	if (!grid.cells.has(k)) return;
	const station: Station = $state({ peopleWaiting: 0, spawnTimer: 0 });
	grid.stations.set(k, station);
}

// Place a piece that carries the path {from, to} through (x, y). If the cell
// already contains a single-path piece and the new path is different, try to
// upgrade to a switch instead of replacing. If the existing piece already
// covers this path, leave it alone.
export function drawPath(x: number, y: number, from: Dir, to: Dir) {
	if (from === to) return;
	const existing = grid.cells.get(cellKey(x, y));
	if (existing) {
		const existingPaths = pathsOf(existing);
		const alreadyCovers = existingPaths.some(
			(p) => (p.from === from && p.to === to) || (p.from === to && p.to === from)
		);
		if (alreadyCovers) return;
		if (existingPaths.length === 1) {
			const sw = resolveSwitchForPaths(existingPaths[0], { from, to });
			if (sw) {
				grid.cells.set(cellKey(x, y), newPiece(sw.kind, sw.rotation));
				return;
			}
		} else {
			// Multi-path piece (a switch) whose branches don't include this draw —
			// preserve it rather than silently destroying the user's switch.
			return;
		}
	}
	const single = resolveSinglePathPiece(from, to);
	if (single) {
		const k = cellKey(x, y);
		grid.decorations.delete(k);
		grid.cells.set(k, newPiece(single.kind, single.rotation));
	}
}

export function resize(width: number, height: number) {
	grid.width = width;
	grid.height = height;
	for (const k of grid.cells.keys()) {
		const [x, y] = k.split(',').map(Number);
		if (x < 0 || x >= width || y < 0 || y >= height) {
			grid.cells.delete(k);
			grid.stations.delete(k);
		}
	}
	for (const k of grid.decorations.keys()) {
		const [x, y] = k.split(',').map(Number);
		if (x < 0 || x >= width || y < 0 || y >= height) {
			grid.decorations.delete(k);
		}
	}
	for (const k of grid.groundOvers.keys()) {
		const [x, y] = k.split(',').map(Number);
		if (x < 0 || x >= width || y < 0 || y >= height) {
			grid.groundOvers.delete(k);
		}
	}
}
