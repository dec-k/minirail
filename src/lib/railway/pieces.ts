import {
	isSwitch,
	rotateDir,
	type Dir,
	type Piece,
	type PieceKind,
	type Rotation,
	type TilePath
} from './types';

// Path index 0 is the "straight" / through route on switches, index 1 is the diverging branch.
// Both branches share the same common port (W in the base orientation).
const BASE_PATHS: Record<PieceKind, TilePath[]> = {
	straight: [{ from: 3, to: 1 }], // W -> E
	curve: [{ from: 0, to: 1 }], // N -> E (NE bend)
	'switch-left': [
		{ from: 3, to: 1 }, // W -> E (through)
		{ from: 3, to: 0 } // W -> N (diverges up/left)
	],
	'switch-right': [
		{ from: 3, to: 1 }, // W -> E (through)
		{ from: 3, to: 2 } // W -> S (diverges down/right)
	]
};

function rotatePaths(kind: PieceKind, rotation: Rotation): TilePath[] {
	return BASE_PATHS[kind].map((p) => ({
		from: rotateDir(p.from, rotation),
		to: rotateDir(p.to, rotation)
	}));
}

const samePath = (a: TilePath, b: TilePath) =>
	(a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from);

// Resolve a single {from, to} into a straight or curve piece (kind + rotation).
// Returns null when from === to (zero-length) — straight has from opposite to,
// curve has from adjacent to to.
export function resolveSinglePathPiece(
	from: Dir,
	to: Dir
): { kind: PieceKind; rotation: Rotation } | null {
	if (from === to) return null;
	const target: TilePath = { from, to };
	for (const kind of ['straight', 'curve'] as const) {
		for (let r = 0; r < 4; r++) {
			const [p] = rotatePaths(kind, r as Rotation);
			if (samePath(p, target)) return { kind, rotation: r as Rotation };
		}
	}
	return null;
}

// Find a switch (kind + rotation) whose two paths cover both `existing` and
// `incoming`. Used when drawing a new path through a cell that already holds
// a single straight or curve, so the user can build switches by drawing.
export function resolveSwitchForPaths(
	existing: TilePath,
	incoming: TilePath
): { kind: PieceKind; rotation: Rotation } | null {
	for (const kind of ['switch-left', 'switch-right'] as const) {
		for (let r = 0; r < 4; r++) {
			const paths = rotatePaths(kind, r as Rotation);
			const covers = (t: TilePath) => paths.some((p) => samePath(p, t));
			if (covers(existing) && covers(incoming)) {
				return { kind, rotation: r as Rotation };
			}
		}
	}
	return null;
}

export function pathsOf(piece: Piece): TilePath[] {
	return BASE_PATHS[piece.kind].map((p) => ({
		from: rotateDir(p.from, piece.rotation),
		to: rotateDir(p.to, piece.rotation)
	}));
}

export function newPiece(kind: PieceKind, rotation: Rotation = 0): Piece {
	return isSwitch(kind) ? { kind, rotation, active: 0 } : { kind, rotation };
}

export function rotatePiece(piece: Piece): Piece {
	return { ...piece, rotation: ((piece.rotation + 1) % 4) as Rotation };
}

export function toggleSwitch(piece: Piece): Piece {
	if (!isSwitch(piece.kind)) return piece;
	return { ...piece, active: piece.active === 1 ? 0 : 1 };
}
