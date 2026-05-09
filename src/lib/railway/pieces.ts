import { rotateDir, type Piece, type PieceKind, type Rotation, type TilePath } from './types';

const BASE_PATHS: Record<PieceKind, TilePath[]> = {
	straight: [{ from: 3, to: 1 }], // W -> E
	curve: [{ from: 0, to: 1 }] // N -> E (NE bend)
};

export function pathsOf(piece: Piece): TilePath[] {
	return BASE_PATHS[piece.kind].map((p) => ({
		from: rotateDir(p.from, piece.rotation),
		to: rotateDir(p.to, piece.rotation)
	}));
}

export function newPiece(kind: PieceKind, rotation: Rotation = 0): Piece {
	return { kind, rotation };
}

export function rotatePiece(piece: Piece): Piece {
	return { ...piece, rotation: ((piece.rotation + 1) % 4) as Rotation };
}
