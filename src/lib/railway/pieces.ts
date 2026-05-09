import { isSwitch, rotateDir, type Piece, type PieceKind, type Rotation, type TilePath } from './types';

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
