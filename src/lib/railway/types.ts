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

// Station colours form a route line: a passenger boarded at a coloured station
// is only delivered at another station of the same colour. `gray` is the
// default and acts as a wildcard — it matches every colour, so a board made
// entirely of grey stations behaves like the original "any-to-any" system.
export type StationColor = 'gray' | 'red' | 'blue' | 'green' | 'yellow';

// Cycle order used by the shift-click affordance. Starts on gray so the first
// click moves you off the default.
export const STATION_COLOR_CYCLE: StationColor[] = ['gray', 'red', 'blue', 'green', 'yellow'];

export const STATION_PALETTE: Record<StationColor, { fill: string; stroke: string }> = {
	gray: { fill: '#94a3b8', stroke: '#475569' },
	red: { fill: '#dc2626', stroke: '#7f1d1d' },
	blue: { fill: '#2563eb', stroke: '#1e3a8a' },
	green: { fill: '#059669', stroke: '#064e3b' },
	yellow: { fill: '#d97706', stroke: '#78350f' }
};

export function nextStationColor(c: StationColor): StationColor {
	const i = STATION_COLOR_CYCLE.indexOf(c);
	return STATION_COLOR_CYCLE[(i + 1) % STATION_COLOR_CYCLE.length];
}

// Wildcard match: gray on either side matches anything.
export function stationColorsMatch(a: StationColor, b: StationColor): boolean {
	if (a === 'gray' || b === 'gray') return true;
	return a === b;
}

export type Station = {
	// Number of people currently waiting on the platform.
	peopleWaiting: number;
	// Seconds since the last person spawned at this station.
	spawnTimer: number;
	// Route line. Passengers boarded here only disembark at another station of
	// the same colour. `gray` is a wildcard (matches anything).
	color: StationColor;
};

export const cellKey = (x: number, y: number) => `${x},${y}`;
