import { SvelteMap } from 'svelte/reactivity';
import {
	cellKey,
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
	width: 20,
	height: 15,
	cells: new SvelteMap<string, Piece>(),
	stations: new SvelteMap<string, Station>()
});

export function getPiece(x: number, y: number): Piece | undefined {
	return grid.cells.get(cellKey(x, y));
}

export function placePiece(x: number, y: number, kind: PieceKind, rotation: Rotation = 0) {
	grid.cells.set(cellKey(x, y), newPiece(kind, rotation));
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
	grid.cells.delete(cellKey(x, y));
	grid.stations.delete(cellKey(x, y));
}

export function clearAll() {
	grid.cells.clear();
	grid.stations.clear();
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
		grid.cells.set(cellKey(x, y), newPiece(single.kind, single.rotation));
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
}
