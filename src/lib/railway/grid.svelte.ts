import { SvelteMap } from 'svelte/reactivity';
import { cellKey, type Piece, type PieceKind, type Rotation } from './types';
import { newPiece, rotatePiece, toggleSwitch } from './pieces';

export const grid = $state({
	width: 20,
	height: 15,
	cells: new SvelteMap<string, Piece>()
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
}

export function clearAll() {
	grid.cells.clear();
}

export function resize(width: number, height: number) {
	grid.width = width;
	grid.height = height;
	for (const k of grid.cells.keys()) {
		const [x, y] = k.split(',').map(Number);
		if (x < 0 || x >= width || y < 0 || y >= height) grid.cells.delete(k);
	}
}
