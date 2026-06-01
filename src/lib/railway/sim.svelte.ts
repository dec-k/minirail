import {
	dx,
	dy,
	opposite,
	cellKey,
	isSwitch,
	LOCO_COLORS,
	type Dir,
	type Loco,
	type Piece,
	type Reverser,
	type RoutingDecision,
	type Vehicle
} from './types';
import { pathsOf } from './pieces';
import { pathLength, sample } from './geometry';
import { getPiece, grid, toggleAt } from './grid.svelte';
import { hasActiveParticles, spawnSteam, tickParticles } from './particles.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { markDirty } from './doc.svelte';

export type { Reverser };

export const sim = $state({
	locos: [] as Loco[]
});

export const MAX_THROTTLE = 8;
// The three throttle notches exposed in the UI (slow / medium / fast). The
// loco panel renders these as >, >>, >>> — there is no zero notch; stopping is
// owned by the reverser's neutral position. DEFAULT_THROTTLE is the notch a
// freshly placed loco starts on so it moves as soon as the reverser engages.
export const THROTTLE_LEVELS = [1, 3, 5] as const;
export const DEFAULT_THROTTLE = 1;
export const WAGON_LENGTH = 0.6;
// People stop at the centre of the station tile; at this distance the loco
// begins decelerating to arrive at zero speed.
export const APPROACH_DIST = 1.8;
// Rate at which a loco's actual speed ramps toward its throttle (and back to 0
// when braking). Asymmetric — brakes are stronger than accel so deliberate
// stops feel snappy while departures stay gentle.
export const ACCELERATION = 4;
export const DECELERATION = 8;
// Seconds between (de)boarding events while the loco is paused at a station.
export const BOARDING_INTERVAL = 0.35;
// Seconds between new-passenger spawns at each station.
export const STATION_SPAWN_INTERVAL = 2;
// Cap on people waiting at one station.
export const STATION_CAPACITY = 10;

let rafHandle = 0;
let lastTime = 0;
let nextLocoId = 1;

// Seconds between steam puffs from a moving loco. Per-loco accumulator carried
// in steamTimers so multiple locos don't share phase.
const STEAM_INTERVAL = 0.09;
const steamTimers = new SvelteMap<number, number>();

function maybeSpawnSteam(l: Loco, dt: number) {
	if (!locoIsMoving(l)) {
		steamTimers.delete(l.id);
		return;
	}
	const timer = (steamTimers.get(l.id) ?? 0) + dt;
	if (timer < STEAM_INTERVAL) {
		steamTimers.set(l.id, timer);
		return;
	}
	steamTimers.set(l.id, timer - STEAM_INTERVAL);
	const piece = getPiece(l.x, l.y);
	if (!piece) return;
	const path = pathsOf(piece)[l.pathIdx];
	if (!path) return;
	const s = sample(path, l.t);
	const heading = s.heading + (l.dir === -1 ? Math.PI : 0);
	const cosH = Math.cos(heading);
	const sinH = Math.sin(heading);
	// Chimney sits ~0.18 tile-units forward of the loco centre. Steam drifts
	// rearward with a perpendicular jitter so consecutive puffs don't line up.
	const chX = l.x + s.x + cosH * 0.18;
	const chY = l.y + s.y + sinH * 0.18;
	const drift = 0.25;
	const jitter = (Math.random() - 0.5) * 0.35;
	spawnSteam(chX, chY, -cosH * drift + -sinH * jitter, -sinH * drift + cosH * jitter);
}

function findLoco(id: number): Loco | undefined {
	return sim.locos.find((l) => l.id === id);
}

function pickColor(): string {
	const used = new Set(sim.locos.map((l) => l.color));
	for (const c of LOCO_COLORS) if (!used.has(c)) return c;
	return LOCO_COLORS[sim.locos.length % LOCO_COLORS.length];
}

export function placeLoco(x: number, y: number) {
	const piece = getPiece(x, y);
	if (!piece) return;
	if (sim.locos.some((l) => l.x === x && l.y === y)) return;
	sim.locos.push({
		id: nextLocoId++,
		color: pickColor(),
		name: '',
		x,
		y,
		pathIdx: 0,
		t: 0.5,
		dir: 1,
		stopped: false,
		reverser: 0,
		throttle: DEFAULT_THROTTLE,
		speed: 0,
		routingCursor: 0,
		wagons: [],
		routingTrail: [],
		passengers: [],
		boardingAt: null,
		boardingTimer: 0,
		lastBoardedAt: null,
		autoReverse: false,
		switchLine: false
	});
	markDirty();
}

export function removeLoco(id: number) {
	const idx = sim.locos.findIndex((l) => l.id === id);
	if (idx >= 0) {
		sim.locos.splice(idx, 1);
		markDirty();
	}
	steamTimers.delete(id);
	// loop() self-cancels via shouldAnimate() — don't tear down here in case
	// stations still need spawn ticks.
}

export function clearAllLocos() {
	const had = sim.locos.length > 0;
	sim.locos.length = 0;
	steamTimers.clear();
	nextLocoId = 1;
	if (had) markDirty();
	// loop() self-cancels via shouldAnimate().
}

export type SavedLocoState = {
	x: number;
	y: number;
	pathIdx: number;
	t: number;
	dir: 1 | -1;
	color: string;
	name?: string;
	wagons: number;
	reverser?: Reverser;
	throttle?: number;
	autoReverse?: boolean;
	switchLine?: boolean;
};

// Replace the entire loco list with the given saved states. Used by the
// save/load system. Wagons are recreated via the normal addWagon walk so they
// land in physically valid positions for the current track.
export function replaceLocos(saved: SavedLocoState[]) {
	sim.locos.length = 0;
	nextLocoId = 1;
	for (const s of saved) {
		const piece = getPiece(s.x, s.y);
		if (!piece) continue;
		const paths = pathsOf(piece);
		if (s.pathIdx < 0 || s.pathIdx >= paths.length) continue;
		const loco: Loco = {
			id: nextLocoId++,
			color: s.color,
			name: s.name ?? '',
			x: s.x,
			y: s.y,
			pathIdx: s.pathIdx,
			t: s.t,
			dir: s.dir,
			stopped: false,
			reverser: s.reverser ?? 0,
			throttle: s.throttle ?? DEFAULT_THROTTLE,
			speed: 0,
			routingCursor: 0,
			wagons: [],
			routingTrail: [],
			passengers: [],
			boardingAt: null,
			boardingTimer: 0,
			lastBoardedAt: null,
			autoReverse: s.autoReverse ?? false,
			switchLine: s.switchLine ?? false
		};
		sim.locos.push(loco);
		for (let i = 0; i < s.wagons; i++) addWagon(loco.id);
	}
	startLoopIfNeeded();
}

// Walk a vehicle along the track by `distance`, advancing in v.dir * motionSign.
// motionSign +1 = head-first (forward), -1 = rear-first (reverse).
//
// At a switch facing-point, the vehicle scans the shared `trail` from its own
// `routingCursor`. If a matching (tileKey, entryPort) entry is found, it reuses
// the recorded pathIdx — keeping the chain consistent with whichever vehicle
// led through this crossing. Otherwise, if a same-train sibling is already on
// the destination tile, adopt its pathIdx: the chain is physically continuous
// so the entering vehicle must be on the same path. Only if both fail does the
// vehicle act as leader, picking based on the switch's current `active` and
// appending to the trail. The sibling fallback fixes reverse re-entries via
// the common port, where the original forward trail entry has a different
// entryPort and the user may have thrown the switch in between.
function step(
	v: Vehicle,
	distance: number,
	motionSign: 1 | -1,
	trail: RoutingDecision[],
	siblings: readonly Vehicle[],
	onLeaveTile?: (x: number, y: number) => void
) {
	let remaining = distance;
	let safety = 1000;
	while (remaining > 1e-9 && !v.stopped && safety-- > 0) {
		const piece = getPiece(v.x, v.y);
		if (!piece) {
			v.stopped = true;
			break;
		}
		const paths = pathsOf(piece);
		const path = paths[v.pathIdx];
		const pl = pathLength(path);
		const effDir = (v.dir * motionSign) as 1 | -1;
		const remainingT = effDir === 1 ? 1 - v.t : v.t;
		const remainingDist = remainingT * pl;
		if (remaining <= remainingDist) {
			v.t += effDir * (remaining / pl);
			return;
		}
		remaining -= remainingDist;
		const exitDir = effDir === 1 ? path.to : path.from;
		const nx = v.x + dx[exitDir];
		const ny = v.y + dy[exitDir];
		const entryDir = opposite(exitDir);
		const nextPiece = getPiece(nx, ny);
		if (!nextPiece) {
			v.stopped = true;
			v.t = effDir === 1 ? 1 : 0;
			break;
		}
		const nextPaths = pathsOf(nextPiece);
		const candidates: { idx: number; entry: 'from' | 'to' }[] = [];
		for (let i = 0; i < nextPaths.length; i++) {
			if (nextPaths[i].from === entryDir) candidates.push({ idx: i, entry: 'from' });
			else if (nextPaths[i].to === entryDir) candidates.push({ idx: i, entry: 'to' });
		}
		if (candidates.length === 0) {
			v.stopped = true;
			v.t = effDir === 1 ? 1 : 0;
			break;
		}
		let chosen = candidates[0];
		if (candidates.length > 1) {
			const tk = cellKey(nx, ny);
			let matched: { idx: number; entry: 'from' | 'to' } | null = null;
			for (let k = v.routingCursor; k < trail.length; k++) {
				const r = trail[k];
				if (r.tileKey === tk && r.entryPort === entryDir) {
					const c = candidates.find((cn) => cn.idx === r.pathIdx);
					if (c) {
						matched = c;
						v.routingCursor = k + 1;
						break;
					}
				}
			}
			if (!matched) {
				for (const sib of siblings) {
					if (sib === v || sib.x !== nx || sib.y !== ny) continue;
					const c = candidates.find((cn) => cn.idx === sib.pathIdx);
					if (c) {
						matched = c;
						break;
					}
				}
			}
			if (matched) {
				chosen = matched;
			} else {
				const active = nextPiece.active ?? 0;
				chosen = candidates.find((c) => c.idx === active) ?? candidates[0];
				trail.push({ tileKey: tk, entryPort: entryDir, pathIdx: chosen.idx });
				v.routingCursor = trail.length;
			}
		}
		const leftX = v.x;
		const leftY = v.y;
		v.x = nx;
		v.y = ny;
		v.pathIdx = chosen.idx;
		const newEff = (chosen.entry === 'from' ? 1 : -1) as 1 | -1;
		v.dir = (newEff * motionSign) as 1 | -1;
		v.t = chosen.entry === 'from' ? 0 : 1;
		onLeaveTile?.(leftX, leftY);
	}
}

function pruneTrail(loco: Loco) {
	if (loco.routingTrail.length === 0) return;
	let min = loco.routingCursor;
	for (const w of loco.wagons) min = Math.min(min, w.routingCursor);
	if (min > 0) {
		loco.routingTrail.splice(0, min);
		loco.routingCursor -= min;
		for (const w of loco.wagons) w.routingCursor -= min;
	}
}

function locoIsMoving(l: Loco): boolean {
	if (l.stopped) return false;
	// Either physically rolling (speed bleeding off) or actively powered.
	return l.speed > 1e-6 || (l.reverser !== 0 && l.throttle > 0);
}

function anyMoving(): boolean {
	return sim.locos.some(locoIsMoving);
}

function anyBoarding(): boolean {
	return sim.locos.some((l) => l.boardingAt !== null);
}

function anyStationBacklog(): boolean {
	for (const s of grid.stations.values()) {
		if (s.peopleWaiting < STATION_CAPACITY) return true;
	}
	return false;
}

function shouldAnimate(): boolean {
	return anyMoving() || anyBoarding() || anyStationBacklog() || hasActiveParticles();
}

type Candidate = { idx: number; entry: 'from' | 'to' };

// All paths in `piece` that connect at `entryDir`, tagged by which end of the
// path that port is. Used at boundary crossings to discover where a vehicle
// can route into the next tile.
function candidatesAtEntry(piece: Piece, entryDir: Dir): Candidate[] {
	const paths = pathsOf(piece);
	const out: Candidate[] = [];
	for (let i = 0; i < paths.length; i++) {
		if (paths[i].from === entryDir) out.push({ idx: i, entry: 'from' });
		else if (paths[i].to === entryDir) out.push({ idx: i, entry: 'to' });
	}
	return out;
}

// Scan `trail` from `cursor` for the first entry that matches (tileKey,
// entryDir) AND points at one of `candidates`. Returns the matched candidate
// and the cursor position just past it, or null when nothing matches.
function trailMatch(
	trail: readonly RoutingDecision[],
	cursor: number,
	tileKey: string,
	entryDir: Dir,
	candidates: readonly Candidate[]
): { chosen: Candidate; nextCursor: number } | null {
	for (let k = cursor; k < trail.length; k++) {
		const r = trail[k];
		if (r.tileKey !== tileKey || r.entryPort !== entryDir) continue;
		const c = candidates.find((cn) => cn.idx === r.pathIdx);
		if (c) return { chosen: c, nextCursor: k + 1 };
	}
	return null;
}

type WalkTile = {
	x: number;
	y: number;
	pathIdx: number;
	t: number;
	dir: 1 | -1;
	effDir: 1 | -1;
	pl: number;
	distAtStart: number;
	first: boolean;
};

type WalkEnd = { kind: 'deadEnd'; distance: number } | { kind: 'tooFar' };

// Read-only walk along a vehicle's intended route, yielding one entry per tile
// visited. `distAtStart` is the cumulative distance from `start` to the entry-
// side of the current tile; callers add intra-tile offsets to it when they
// report distances. `first` is true on the starting tile only — useful for
// guards like "ignore the tile we just departed".
//
// At facing-point switches, mirrors step()'s routing decisions via the trail +
// active fallback. The trail is read-only here — only step() pushes new
// entries — and the sibling fallback step() uses is omitted: it only matters
// for real vehicles, and walkRoute deliberately doesn't mutate any.
//
// Terminates by returning a `WalkEnd`:
//   - `deadEnd { distance }` when the route runs out (current tile gone, no
//     next piece, or no candidates at the entry port). `distance` is the
//     accumulated distance up to that point — distance-to-wall for the
//     boundary cases, 0 if the leader itself sits on a missing tile.
//   - `tooFar` when accumulated distance exceeds `maxDist`, or the safety
//     counter trips.
function* walkRoute(
	start: {
		x: number;
		y: number;
		pathIdx: number;
		t: number;
		dir: 1 | -1;
		routingCursor: number;
	},
	motionSign: 1 | -1,
	trail: readonly RoutingDecision[],
	maxDist: number
): Generator<WalkTile, WalkEnd, void> {
	let x = start.x;
	let y = start.y;
	let pathIdx = start.pathIdx;
	let t = start.t;
	let dir = start.dir;
	let cursor = start.routingCursor;
	let dist = 0;
	let first = true;
	let safety = 64;
	while (dist <= maxDist && safety-- > 0) {
		const piece = getPiece(x, y);
		if (!piece) return { kind: 'deadEnd', distance: dist };
		const paths = pathsOf(piece);
		const path = paths[pathIdx];
		if (!path) return { kind: 'deadEnd', distance: dist };
		const pl = pathLength(path);
		const effDir = (dir * motionSign) as 1 | -1;
		const remainingT = effDir === 1 ? 1 - t : t;
		const remainingDist = remainingT * pl;
		yield { x, y, pathIdx, t, dir, effDir, pl, distAtStart: dist, first };
		dist += remainingDist;
		if (dist > maxDist) return { kind: 'tooFar' };
		const exitDir = effDir === 1 ? path.to : path.from;
		const nx = x + dx[exitDir];
		const ny = y + dy[exitDir];
		const entryDir = opposite(exitDir);
		const nextPiece = getPiece(nx, ny);
		if (!nextPiece) return { kind: 'deadEnd', distance: dist };
		const candidates = candidatesAtEntry(nextPiece, entryDir);
		if (candidates.length === 0) return { kind: 'deadEnd', distance: dist };
		let chosen: Candidate = candidates[0];
		if (candidates.length > 1) {
			const tk = cellKey(nx, ny);
			const m = trailMatch(trail, cursor, tk, entryDir, candidates);
			if (m) {
				chosen = m.chosen;
				cursor = m.nextCursor;
			} else {
				const active = nextPiece.active ?? 0;
				chosen = candidates.find((c) => c.idx === active) ?? candidates[0];
			}
		}
		x = nx;
		y = ny;
		pathIdx = chosen.idx;
		const newEff = (chosen.entry === 'from' ? 1 : -1) as 1 | -1;
		dir = (newEff * motionSign) as 1 | -1;
		t = chosen.entry === 'from' ? 0 : 1;
		first = false;
	}
	return { kind: 'tooFar' };
}

function walkStart(v: Vehicle) {
	return {
		x: v.x,
		y: v.y,
		pathIdx: v.pathIdx,
		t: v.t,
		dir: v.dir,
		routingCursor: v.routingCursor
	};
}

// Distance until the loco reaches the centre of the next station tile where
// it must stop, or +Infinity if no such station is within `maxDist` (or the
// loco can't usefully stop — no wagons or no reverser).
function distanceToNextStop(loco: Loco, maxDist: number): number {
	if (loco.reverser === 0) return Infinity;
	if (loco.wagons.length === 0) return Infinity;
	const motionSign = loco.reverser as 1 | -1;
	const walker = walkRoute(walkStart(loco), motionSign, loco.routingTrail, maxDist);
	while (true) {
		const r = walker.next();
		if (r.done) return Infinity;
		const tile = r.value;
		// Stop at this tile iff something useful would happen — either we'd let
		// a foreign-origin passenger off, or board a fresh one with capacity to
		// spare. Skip the loco's current tile if it just finished boarding here,
		// so the lookahead doesn't immediately re-trigger on the same tile.
		const tk = cellKey(tile.x, tile.y);
		const justLeftHere = tile.first && loco.lastBoardedAt === tk;
		if (!justLeftHere && shouldStopAt(loco, tk)) {
			const targetT = 0.5;
			const distToCentre =
				tile.effDir === 1 ? (targetT - tile.t) * tile.pl : (tile.t - targetT) * tile.pl;
			if (distToCentre >= -1e-6) return tile.distAtStart + Math.max(0, distToCentre);
		}
	}
}

// Distance until the leader (loco forward, rear wagon when reversing) would
// reach a dead end (no next piece, or no path connects at the entry port), or
// +Infinity if no dead end within `maxDist`. Folded into the obstacle distance
// so the train decelerates to rest at the wall — without this, reversing into
// a stub track lets the loco step past stopped wagons and crush the chain.
function distanceToDeadEnd(loco: Loco, maxDist: number): number {
	if (loco.reverser === 0) return Infinity;
	const motionSign = loco.reverser as 1 | -1;
	const leader: Vehicle =
		motionSign === -1 && loco.wagons.length > 0 ? loco.wagons[loco.wagons.length - 1] : loco;
	const walker = walkRoute(walkStart(leader), motionSign, loco.routingTrail, maxDist);
	while (true) {
		const r = walker.next();
		if (r.done) return r.value.kind === 'deadEnd' ? r.value.distance : Infinity;
	}
}

// Distance below which the leader is considered "at" a dead end. The braking
// target shrinks linearly with distance to obstacle, so the train decelerates
// geometrically as it approaches a wall — it never quite reaches t=1. Snapping
// within this radius lets auto-reverse flip promptly instead of crawling for
// seconds; at 0.05 of a tile (2px at the default zoom) the gap is invisible.
const DEAD_END_SNAP = 0.05;

// Distance from this train's leading vehicle (loco when going forward, rear
// wagon when reversing) to the nearest point occupied by some other train's
// loco or wagon, or +Infinity if none within `maxDist`.
//
// Two vehicles count as colliding when they share the same tile AND the same
// pathIdx; vehicles on a different pathIdx of the same switch tile are on a
// physically separate branch and don't block.
function distanceToNextVehicle(loco: Loco, maxDist: number): number {
	if (loco.reverser === 0) return Infinity;
	const motionSign = loco.reverser as 1 | -1;
	// When reversing, the loco pushes the wagons — the rearmost wagon leads.
	const leader: Vehicle =
		motionSign === -1 && loco.wagons.length > 0 ? loco.wagons[loco.wagons.length - 1] : loco;
	const own = new Set<Vehicle>([loco, ...loco.wagons]);
	const walker = walkRoute(walkStart(leader), motionSign, loco.routingTrail, maxDist);
	while (true) {
		const r = walker.next();
		if (r.done) return Infinity;
		const tile = r.value;
		let nearest = Infinity;
		for (const other of sim.locos) {
			const vs: Vehicle[] = [other, ...other.wagons];
			for (const v of vs) {
				if (own.has(v)) continue;
				if (v.x !== tile.x || v.y !== tile.y || v.pathIdx !== tile.pathIdx) continue;
				let segDist: number;
				if (tile.effDir === 1) {
					if (v.t < tile.t - 1e-9) continue;
					segDist = (v.t - tile.t) * tile.pl;
				} else {
					if (v.t > tile.t + 1e-9) continue;
					segDist = (tile.t - v.t) * tile.pl;
				}
				if (segDist < nearest) nearest = segDist;
			}
		}
		if (nearest < Infinity) return tile.distAtStart + nearest;
	}
}

// True if stopping the loco at `stationKey` would actually do something —
// either let a passenger off (one whose origin is somewhere else) or board a
// new person (station has people AND the train has free wagon capacity).
function shouldStopAt(loco: Loco, stationKey: string): boolean {
	if (loco.wagons.length === 0) return false;
	const station = grid.stations.get(stationKey);
	if (!station) return false;
	if (station.peopleWaiting > 0 && loco.passengers.length < loco.wagons.length) return true;
	for (const origin of loco.passengers) if (origin !== stationKey) return true;
	return false;
}

function maybeStartBoarding(l: Loco) {
	if (l.boardingAt) return;
	const k = cellKey(l.x, l.y);
	// Don't immediately re-board the station the loco just departed from.
	if (l.lastBoardedAt === k) return;
	if (!shouldStopAt(l, k)) return;
	if (Math.abs(l.t - 0.5) > 0.05) return;
	l.boardingAt = k;
	l.boardingTimer = 0;
}

function releaseBoarding(l: Loco) {
	l.lastBoardedAt = l.boardingAt;
	l.boardingAt = null;
	l.boardingTimer = 0;
}

function tickBoarding(l: Loco, dt: number) {
	if (!l.boardingAt) return;
	l.boardingTimer += dt;
	while (l.boardingTimer >= BOARDING_INTERVAL) {
		l.boardingTimer -= BOARDING_INTERVAL;
		const stationKey = l.boardingAt;
		const station = grid.stations.get(stationKey);
		if (!station) {
			releaseBoarding(l);
			return;
		}
		// Phase 1: dismount one passenger whose origin is not this station.
		const foreignIdx = l.passengers.findIndex((origin) => origin !== stationKey);
		if (foreignIdx >= 0) {
			l.passengers.splice(foreignIdx, 1);
			continue;
		}
		// Phase 2: board a waiting person if there's wagon capacity.
		if (station.peopleWaiting > 0 && l.passengers.length < l.wagons.length) {
			station.peopleWaiting -= 1;
			l.passengers.push(stationKey);
			if (station.peopleWaiting === 0 || l.passengers.length >= l.wagons.length) {
				releaseBoarding(l);
				return;
			}
			continue;
		}
		// No foreign passengers to drop off and no boarding possible — done.
		releaseBoarding(l);
		return;
	}
}

function tickStations(dt: number) {
	// Stations actively servicing a train don't accumulate new arrivals — their
	// spawn timer freezes for the duration of (un)loading and resumes on depart.
	const beingBoarded: Record<string, true> = {};
	for (const l of sim.locos) {
		if (l.boardingAt) beingBoarded[l.boardingAt] = true;
	}
	for (const [k, station] of grid.stations) {
		if (beingBoarded[k]) continue;
		if (station.peopleWaiting >= STATION_CAPACITY) {
			station.spawnTimer = 0;
			continue;
		}
		station.spawnTimer += dt;
		while (
			station.spawnTimer >= STATION_SPAWN_INTERVAL &&
			station.peopleWaiting < STATION_CAPACITY
		) {
			station.spawnTimer -= STATION_SPAWN_INTERVAL;
			station.peopleWaiting += 1;
		}
		if (station.peopleWaiting >= STATION_CAPACITY) station.spawnTimer = 0;
	}
}

function makeSwitchLineCallback(): (x: number, y: number) => void {
	return (x, y) => {
		const piece = getPiece(x, y);
		if (piece && isSwitch(piece.kind)) toggleAt(x, y);
	};
}

// Resolve any dead-end / derailed state for `l` for this frame. Returns true
// if the loco was neutralised or auto-reversed and the caller should skip
// motion for this frame. Covers two cases:
//   1. The leader is within DEAD_END_SNAP of the wall (via lookahead).
//   2. step() set the stopped flag on some car after the track was removed
//      under the train.
// With auto-reverse on, the train flips and continues; otherwise the reverser
// drops to neutral so the train doesn't sit pushing against a wall.
function resolveDeadEnd(l: Loco, distToDeadEnd: number): boolean {
	if (l.reverser === 0) return false;
	const someStopped = l.stopped || l.wagons.some((w) => w.stopped);
	if (!someStopped && distToDeadEnd > DEAD_END_SNAP) return false;
	const sign = l.reverser as 1 | -1;
	l.stopped = false;
	for (const w of l.wagons) w.stopped = false;
	l.speed = 0;
	if (l.autoReverse) {
		l.reverser = -sign as Reverser;
	} else {
		l.reverser = 0;
	}
	return true;
}

function loop() {
	const now = performance.now();
	const dt = Math.min((now - lastTime) / 1000, 0.1);
	lastTime = now;

	tickStations(dt);
	tickParticles(dt);

	for (const l of sim.locos) {
		maybeSpawnSteam(l, dt);
		if (l.boardingAt) {
			l.speed = 0;
			tickBoarding(l, dt);
			continue;
		}

		// Look ahead far enough to drive both the braking target (within
		// APPROACH_DIST) and the hard overshoot cap on this frame's motion.
		const frameDist = l.speed * dt;
		const lookahead = Math.max(APPROACH_DIST, frameDist);
		const distToStop = distanceToNextStop(l, lookahead);
		const distToVehicleRaw = distanceToNextVehicle(l, lookahead + WAGON_LENGTH);
		const distToVehicle =
			distToVehicleRaw === Infinity ? Infinity : Math.max(0, distToVehicleRaw - WAGON_LENGTH);
		const distToDeadEnd = distanceToDeadEnd(l, lookahead);

		if (resolveDeadEnd(l, distToDeadEnd)) continue;

		const distToObstacle = Math.min(distToStop, distToVehicle, distToDeadEnd);

		// Target speed: throttle when powered, attenuated linearly as we close
		// on an obstacle so the loco arrives with zero speed.
		let target = 0;
		if (!l.stopped && l.reverser !== 0 && l.throttle > 0) {
			target = l.throttle;
			if (distToObstacle < APPROACH_DIST) {
				target = Math.min(target, l.throttle * Math.max(0, distToObstacle / APPROACH_DIST));
			}
		}

		if (l.speed < target) l.speed = Math.min(target, l.speed + ACCELERATION * dt);
		else if (l.speed > target) l.speed = Math.max(target, l.speed - DECELERATION * dt);

		if (l.speed > 1e-6 && l.reverser !== 0) {
			let dist = l.speed * dt;
			if (distToObstacle < Infinity) dist = Math.min(dist, distToObstacle);
			if (dist > 1e-9) {
				const sign = l.reverser as 1 | -1;
				const prevKey = cellKey(l.x, l.y);
				const onLeaveTile = l.switchLine ? makeSwitchLineCallback() : undefined;
				step(l, dist, sign, l.routingTrail, l.wagons, onLeaveTile);
				for (const w of l.wagons) {
					if (!w.stopped) step(w, dist, sign, l.routingTrail, [l, ...l.wagons]);
				}
				pruneTrail(l);
				if (l.lastBoardedAt && cellKey(l.x, l.y) !== prevKey) {
					l.lastBoardedAt = null;
				}
			}
		}
		maybeStartBoarding(l);
	}

	if (shouldAnimate()) {
		rafHandle = requestAnimationFrame(loop);
	} else {
		rafHandle = 0;
	}
}

function startLoopIfNeeded() {
	if (rafHandle !== 0 || !shouldAnimate()) return;
	lastTime = performance.now();
	rafHandle = requestAnimationFrame(loop);
}

// Public hook for callers that mutate world state (e.g., placing a station)
// and need the rAF loop to wake up so spawn timers tick.
export function kickSimulation() {
	startLoopIfNeeded();
}

export function setReverser(id: number, r: Reverser) {
	const loco = findLoco(id);
	if (!loco) return;
	if (r === loco.reverser) return;
	// Flipping direction while rolling would push the train backward at full
	// speed; force a fresh start in the new direction.
	if (loco.reverser !== 0 && r !== 0) loco.speed = 0;
	loco.reverser = r;
	if (r !== 0) {
		if (loco.stopped) loco.stopped = false;
		for (const w of loco.wagons) if (w.stopped) w.stopped = false;
	}
	markDirty();
	startLoopIfNeeded();
}

export function setAutoReverse(id: number, on: boolean) {
	const loco = findLoco(id);
	if (!loco) return;
	if (loco.autoReverse === on) return;
	loco.autoReverse = on;
	markDirty();
	startLoopIfNeeded();
}

export function setSwitchLine(id: number, on: boolean) {
	const loco = findLoco(id);
	if (!loco) return;
	if (loco.switchLine === on) return;
	loco.switchLine = on;
	markDirty();
}

export function setLocoName(id: number, name: string) {
	const loco = findLoco(id);
	if (!loco) return;
	// Cap length so a runaway paste can't blow out the header / chip layout.
	const next = name.slice(0, 40);
	if (next === loco.name) return;
	loco.name = next;
	markDirty();
}

// Only colours from the shared palette are accepted, so saves stay within the
// known set and every loco keeps a theme-safe, contrast-checked colour.
export function setLocoColor(id: number, color: string) {
	const loco = findLoco(id);
	if (!loco) return;
	if (!LOCO_COLORS.includes(color)) return;
	if (color === loco.color) return;
	loco.color = color;
	markDirty();
}

export function setThrottle(id: number, t: number) {
	const loco = findLoco(id);
	if (!loco) return;
	const clamped = Math.max(0, Math.min(MAX_THROTTLE, t));
	if (clamped === loco.throttle) return;
	loco.throttle = clamped;
	if (clamped > 0 && loco.reverser !== 0) {
		if (loco.stopped) loco.stopped = false;
		for (const w of loco.wagons) if (w.stopped) w.stopped = false;
	}
	markDirty();
	startLoopIfNeeded();
}

export function addWagon(id: number) {
	const loco = findLoco(id);
	if (!loco) return;
	const last: Vehicle = loco.wagons.length > 0 ? loco.wagons[loco.wagons.length - 1] : loco;
	const probe: Vehicle = {
		x: last.x,
		y: last.y,
		pathIdx: last.pathIdx,
		t: last.t,
		dir: last.dir,
		stopped: false,
		routingCursor: 0
	};
	// Probe is exploratory; pass a throwaway trail so its decisions don't
	// pollute the train's shared trail. Existing cars are siblings so the probe
	// follows the chain through any switches it crosses.
	step(probe, WAGON_LENGTH, -1, [], [loco, ...loco.wagons]);
	if (probe.stopped) return;
	loco.wagons.push({
		x: probe.x,
		y: probe.y,
		pathIdx: probe.pathIdx,
		t: probe.t,
		dir: probe.dir,
		stopped: false,
		routingCursor: last.routingCursor
	});
	markDirty();
}

export function removeWagon(id: number) {
	const loco = findLoco(id);
	if (!loco) return;
	if (loco.wagons.length === 0) return;
	loco.wagons.pop();
	pruneTrail(loco);
	markDirty();
}
