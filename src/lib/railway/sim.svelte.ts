import {
	dx,
	dy,
	opposite,
	cellKey,
	LOCO_COLORS,
	stationColorsMatch,
	type Loco,
	type Reverser,
	type RoutingDecision,
	type Vehicle
} from './types';
import { pathsOf } from './pieces';
import { pathLength } from './geometry';
import { getPiece, grid } from './grid.svelte';

export type { Reverser };

export const sim = $state({
	locos: [] as Loco[]
});

export const MAX_THROTTLE = 8;
export const WAGON_LENGTH = 0.6;
// People stop at the centre of the station tile; at this distance the loco
// begins decelerating to arrive at zero speed.
export const APPROACH_DIST = 1.8;
// Seconds between (de)boarding events while the loco is paused at a station.
export const BOARDING_INTERVAL = 0.35;
// Seconds between new-passenger spawns at each station.
export const STATION_SPAWN_INTERVAL = 2;
// Cap on people waiting at one station.
export const STATION_CAPACITY = 10;

let rafHandle = 0;
let lastTime = 0;
let nextLocoId = 1;

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
		x,
		y,
		pathIdx: 0,
		t: 0.5,
		dir: 1,
		stopped: false,
		reverser: 0,
		throttle: 0,
		routingCursor: 0,
		wagons: [],
		routingTrail: [],
		passengers: [],
		boardingAt: null,
		boardingTimer: 0,
		lastBoardedAt: null
	});
}

export function removeLoco(id: number) {
	const idx = sim.locos.findIndex((l) => l.id === id);
	if (idx >= 0) sim.locos.splice(idx, 1);
	// loop() self-cancels via shouldAnimate() — don't tear down here in case
	// stations still need spawn ticks.
}

export function clearAllLocos() {
	sim.locos.length = 0;
	nextLocoId = 1;
	// loop() self-cancels via shouldAnimate().
}

export type SavedLocoState = {
	x: number;
	y: number;
	pathIdx: number;
	t: number;
	dir: 1 | -1;
	color: string;
	wagons: number;
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
			x: s.x,
			y: s.y,
			pathIdx: s.pathIdx,
			t: s.t,
			dir: s.dir,
			stopped: false,
			reverser: 0,
			throttle: 0,
			routingCursor: 0,
			wagons: [],
			routingTrail: [],
			passengers: [],
			boardingAt: null,
			boardingTimer: 0,
			lastBoardedAt: null
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
// led through this crossing. If no match is found, the vehicle is acting as
// leader: it picks based on the switch's current `active` state and appends.
function step(v: Vehicle, distance: number, motionSign: 1 | -1, trail: RoutingDecision[]) {
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
			if (matched) {
				chosen = matched;
			} else {
				const active = nextPiece.active ?? 0;
				chosen = candidates.find((c) => c.idx === active) ?? candidates[0];
				trail.push({ tileKey: tk, entryPort: entryDir, pathIdx: chosen.idx });
				v.routingCursor = trail.length;
			}
		}
		v.x = nx;
		v.y = ny;
		v.pathIdx = chosen.idx;
		const newEff = (chosen.entry === 'from' ? 1 : -1) as 1 | -1;
		v.dir = (newEff * motionSign) as 1 | -1;
		v.t = chosen.entry === 'from' ? 0 : 1;
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
	return !l.stopped && l.reverser !== 0 && l.throttle > 0;
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
	return anyMoving() || anyBoarding() || anyStationBacklog();
}

// Read-only walk forward along the loco's intended route. Returns the distance
// (in tile units) until the loco reaches the centre of the next station tile
// where it must stop, or +Infinity if no such station is within `maxDist` (or
// the loco can't usefully stop — no wagons or no reverser).
//
// Mirrors `step`'s routing decisions exactly so the deceleration aim point
// stays consistent with what the loco will actually do at switches.
function distanceToNextStop(loco: Loco, maxDist: number): number {
	if (loco.reverser === 0) return Infinity;
	if (loco.wagons.length === 0) return Infinity;
	const motionSign = loco.reverser as 1 | -1;
	let x = loco.x;
	let y = loco.y;
	let pathIdx = loco.pathIdx;
	let t = loco.t;
	let dir = loco.dir;
	let cursor = loco.routingCursor;
	let dist = 0;
	let safety = 64;
	let first = true;
	while (dist <= maxDist && safety-- > 0) {
		const piece = getPiece(x, y);
		if (!piece) return Infinity;
		const paths = pathsOf(piece);
		const path = paths[pathIdx];
		const pl = pathLength(path);
		const effDir = (dir * motionSign) as 1 | -1;
		// Stop at this tile iff something useful would happen — either we'd let
		// a foreign-origin passenger off, or board a fresh one with capacity to
		// spare. Skip the loco's current tile if it just finished boarding here,
		// so the lookahead doesn't immediately re-trigger on the same tile.
		const tk = cellKey(x, y);
		const justLeftHere = first && loco.lastBoardedAt === tk;
		if (!justLeftHere && shouldStopAt(loco, tk)) {
			const targetT = 0.5;
			let distToCentre: number;
			if (effDir === 1) distToCentre = (targetT - t) * pl;
			else distToCentre = (t - targetT) * pl;
			if (distToCentre >= -1e-6) return dist + Math.max(0, distToCentre);
		}
		const remainingT = effDir === 1 ? 1 - t : t;
		const remainingDist = remainingT * pl;
		dist += remainingDist;
		if (dist > maxDist) return Infinity;
		const exitDir = effDir === 1 ? path.to : path.from;
		const nx = x + dx[exitDir];
		const ny = y + dy[exitDir];
		const entryDir = opposite(exitDir);
		const nextPiece = getPiece(nx, ny);
		if (!nextPiece) return Infinity;
		const nextPaths = pathsOf(nextPiece);
		const candidates: { idx: number; entry: 'from' | 'to' }[] = [];
		for (let i = 0; i < nextPaths.length; i++) {
			if (nextPaths[i].from === entryDir) candidates.push({ idx: i, entry: 'from' });
			else if (nextPaths[i].to === entryDir) candidates.push({ idx: i, entry: 'to' });
		}
		if (candidates.length === 0) return Infinity;
		let chosen = candidates[0];
		if (candidates.length > 1) {
			const tk = cellKey(nx, ny);
			let matched: { idx: number; entry: 'from' | 'to' } | null = null;
			for (let k = cursor; k < loco.routingTrail.length; k++) {
				const r = loco.routingTrail[k];
				if (r.tileKey === tk && r.entryPort === entryDir) {
					const c = candidates.find((cn) => cn.idx === r.pathIdx);
					if (c) {
						matched = c;
						cursor = k + 1;
						break;
					}
				}
			}
			if (matched) chosen = matched;
			else {
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
	return Infinity;
}

// Read-only walk forward along the loco's intended route. Returns the distance
// (in tile units) from this train's leading vehicle (loco when going forward,
// rear wagon when reversing) to the nearest point occupied by some other
// train's loco or wagon, or +Infinity if none within `maxDist`.
//
// Two vehicles count as colliding when they share the same tile AND the same
// pathIdx; vehicles on a different pathIdx of the same switch tile are on a
// physically separate branch and don't block. Mirrors `step`'s routing
// decisions so the brake point lines up with where the loco will actually go.
function distanceToNextVehicle(loco: Loco, maxDist: number): number {
	if (loco.reverser === 0) return Infinity;
	const motionSign = loco.reverser as 1 | -1;
	// When reversing, the loco pushes the wagons — the rearmost wagon leads.
	const leader: Vehicle =
		motionSign === -1 && loco.wagons.length > 0 ? loco.wagons[loco.wagons.length - 1] : loco;
	const own = new Set<Vehicle>([loco, ...loco.wagons]);
	let x = leader.x;
	let y = leader.y;
	let pathIdx = leader.pathIdx;
	let t = leader.t;
	let dir = leader.dir;
	let cursor = leader.routingCursor;
	let dist = 0;
	let safety = 64;
	while (dist <= maxDist && safety-- > 0) {
		const piece = getPiece(x, y);
		if (!piece) return Infinity;
		const paths = pathsOf(piece);
		const path = paths[pathIdx];
		const pl = pathLength(path);
		const effDir = (dir * motionSign) as 1 | -1;
		let nearest = Infinity;
		for (const other of sim.locos) {
			const vs: Vehicle[] = [other, ...other.wagons];
			for (const v of vs) {
				if (own.has(v)) continue;
				if (v.x !== x || v.y !== y || v.pathIdx !== pathIdx) continue;
				let segDist: number;
				if (effDir === 1) {
					if (v.t < t - 1e-9) continue;
					segDist = (v.t - t) * pl;
				} else {
					if (v.t > t + 1e-9) continue;
					segDist = (t - v.t) * pl;
				}
				if (segDist < nearest) nearest = segDist;
			}
		}
		if (nearest < Infinity) return dist + nearest;
		const remainingT = effDir === 1 ? 1 - t : t;
		const remainingDist = remainingT * pl;
		dist += remainingDist;
		if (dist > maxDist) return Infinity;
		const exitDir = effDir === 1 ? path.to : path.from;
		const nx = x + dx[exitDir];
		const ny = y + dy[exitDir];
		const entryDir = opposite(exitDir);
		const nextPiece = getPiece(nx, ny);
		if (!nextPiece) return Infinity;
		const nextPaths = pathsOf(nextPiece);
		const candidates: { idx: number; entry: 'from' | 'to' }[] = [];
		for (let i = 0; i < nextPaths.length; i++) {
			if (nextPaths[i].from === entryDir) candidates.push({ idx: i, entry: 'from' });
			else if (nextPaths[i].to === entryDir) candidates.push({ idx: i, entry: 'to' });
		}
		if (candidates.length === 0) return Infinity;
		let chosen = candidates[0];
		if (candidates.length > 1) {
			const tk = cellKey(nx, ny);
			let matched: { idx: number; entry: 'from' | 'to' } | null = null;
			for (let k = cursor; k < loco.routingTrail.length; k++) {
				const r = loco.routingTrail[k];
				if (r.tileKey === tk && r.entryPort === entryDir) {
					const c = candidates.find((cn) => cn.idx === r.pathIdx);
					if (c) {
						matched = c;
						cursor = k + 1;
						break;
					}
				}
			}
			if (matched) chosen = matched;
			else {
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
	}
	return Infinity;
}

// True if stopping the loco at `stationKey` would actually do something —
// either let a passenger off (one whose origin is somewhere else AND whose
// origin colour matches this station's colour) or board a new person (station
// has people AND the train has free wagon capacity). Gray-coloured stations
// are wildcards on the matching side, so a layout of all-gray stations
// behaves like the original any-to-any system.
function shouldStopAt(loco: Loco, stationKey: string): boolean {
	if (loco.wagons.length === 0) return false;
	const station = grid.stations.get(stationKey);
	if (!station) return false;
	if (station.peopleWaiting > 0 && loco.passengers.length < loco.wagons.length) return true;
	for (const origin of loco.passengers) {
		if (origin === stationKey) continue;
		const originStation = grid.stations.get(origin);
		const originColor = originStation?.color ?? 'gray';
		if (stationColorsMatch(originColor, station.color)) return true;
	}
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
		// Phase 1: dismount one passenger whose origin is not this station AND
		// whose origin colour matches this station's colour (gray is a wildcard
		// on either side). Passengers whose colour doesn't match stay aboard.
		const foreignIdx = l.passengers.findIndex((origin) => {
			if (origin === stationKey) return false;
			const originStation = grid.stations.get(origin);
			const originColor = originStation?.color ?? 'gray';
			return stationColorsMatch(originColor, station.color);
		});
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

function loop() {
	const now = performance.now();
	const dt = Math.min((now - lastTime) / 1000, 0.1);
	lastTime = now;

	tickStations(dt);

	for (const l of sim.locos) {
		if (l.boardingAt) {
			tickBoarding(l, dt);
			continue;
		}
		if (locoIsMoving(l)) {
			let dist = l.throttle * dt;
			const distToStop = distanceToNextStop(l, APPROACH_DIST + dist);
			const distToVehicleRaw = distanceToNextVehicle(l, APPROACH_DIST + WAGON_LENGTH + dist);
			const distToVehicle =
				distToVehicleRaw === Infinity ? Infinity : Math.max(0, distToVehicleRaw - WAGON_LENGTH);
			const distToObstacle = Math.min(distToStop, distToVehicle);
			if (distToObstacle < Infinity) {
				const factor = Math.max(0, Math.min(1, distToObstacle / APPROACH_DIST));
				dist = Math.min(dist * factor, distToObstacle);
			}
			const sign = l.reverser as 1 | -1;
			if (dist > 1e-9) {
				const prevKey = cellKey(l.x, l.y);
				step(l, dist, sign, l.routingTrail);
				for (const w of l.wagons) {
					if (!w.stopped) step(w, dist, sign, l.routingTrail);
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
	loco.reverser = r;
	if (r !== 0) {
		if (loco.stopped) loco.stopped = false;
		for (const w of loco.wagons) if (w.stopped) w.stopped = false;
	}
	startLoopIfNeeded();
}

export function setThrottle(id: number, t: number) {
	const loco = findLoco(id);
	if (!loco) return;
	const clamped = Math.max(0, Math.min(MAX_THROTTLE, t));
	loco.throttle = clamped;
	if (clamped > 0 && loco.reverser !== 0) {
		if (loco.stopped) loco.stopped = false;
		for (const w of loco.wagons) if (w.stopped) w.stopped = false;
	}
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
	// pollute the train's shared trail.
	step(probe, WAGON_LENGTH, -1, []);
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
}

export function removeWagon(id: number) {
	const loco = findLoco(id);
	if (!loco) return;
	loco.wagons.pop();
	pruneTrail(loco);
}
