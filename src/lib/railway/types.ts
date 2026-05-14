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

export type RoutingDecision = { tileKey: string; entryPort: Dir; pathIdx: number };

export type Vehicle = {
	x: number;
	y: number;
	pathIdx: number;
	t: number;
	// Path-local head-facing direction. Invariant under reverser changes; only
	// updates at tile-boundary crossings as the path parametrization rotates.
	dir: 1 | -1;
	stopped: boolean;
	// Index into the loco's routingTrail at which this vehicle should resume
	// scanning for matching facing-point decisions. The vehicle that finds no
	// match acts as the leader for that crossing and appends a new entry.
	routingCursor: number;
};

export type Wagon = Vehicle;

export type Loco = Vehicle & {
	id: number;
	color: string;
	reverser: Reverser;
	throttle: number;
	wagons: Wagon[];
	routingTrail: RoutingDecision[];
	// One entry per onboard passenger; the value is the cellKey of the station
	// where that passenger boarded. Passengers only dismount at a station whose
	// key differs from their own — so they don't immediately get off where they
	// just got on.
	passengers: string[];
	// cellKey of the station the loco is currently boarding at, or null.
	boardingAt: string | null;
	// Seconds since the last boarding tick fired.
	boardingTimer: number;
	// cellKey of the station the loco most recently finished boarding at, or
	// null. Suppresses re-triggering boarding on the same tile while the loco
	// hasn't physically moved off it; cleared when the loco enters a new cell.
	lastBoardedAt: string | null;
};

export type Station = {
	// Number of people currently waiting on the platform.
	peopleWaiting: number;
	// Seconds since the last person spawned at this station.
	spawnTimer: number;
};

export type DecorationKind = 'tree' | 'building' | 'water' | 'grass' | 'stone';
export const DECORATION_KINDS: DecorationKind[] = ['tree', 'building', 'water', 'grass', 'stone'];
// Groundover kinds can sit on cells that already contain track (they render
// underneath); other decoration kinds require empty cells.
export const isGroundOverKind = (k: DecorationKind): boolean => k === 'grass' || k === 'stone';
export type Decoration = { kind: DecorationKind };

export const cellKey = (x: number, y: number) => `${x},${y}`;
