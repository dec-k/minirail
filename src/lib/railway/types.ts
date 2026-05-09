export type Dir = 0 | 1 | 2 | 3;
export const N: Dir = 0;
export const E: Dir = 1;
export const S: Dir = 2;
export const W: Dir = 3;

export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const rotateDir = (d: Dir, r: Rotation): Dir => ((d + r) % 4) as Dir;

export const dx: Record<Dir, number> = { 0: 0, 1: 1, 2: 0, 3: -1 };
export const dy: Record<Dir, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };

export type Rotation = 0 | 1 | 2 | 3;
export type PieceKind = 'straight' | 'curve' | 'switch-left' | 'switch-right';

export type TilePath = { from: Dir; to: Dir };
export type Piece = { kind: PieceKind; rotation: Rotation; active?: 0 | 1 };

export const isSwitch = (kind: PieceKind) => kind === 'switch-left' || kind === 'switch-right';

export type Reverser = -1 | 0 | 1;

export const LOCO_COLORS = [
	'#dc2626',
	'#2563eb',
	'#059669',
	'#d97706',
	'#7c3aed',
	'#0891b2',
	'#db2777',
	'#65a30d'
];

export type Loco = {
	id: number;
	color: string;
	x: number;
	y: number;
	pathIdx: number;
	t: number;
	dir: 1 | -1;
	stopped: boolean;
	reverser: Reverser;
	throttle: number;
	lastNonzeroReverser: 1 | -1;
};

export const cellKey = (x: number, y: number) => `${x},${y}`;
