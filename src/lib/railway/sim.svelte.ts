import {
	dx,
	dy,
	opposite,
	cellKey,
	LOCO_COLORS,
	type Loco,
	type Reverser,
	type RoutingDecision,
	type Vehicle
} from './types';
import { pathsOf } from './pieces';
import { pathLength } from './geometry';
import { getPiece } from './grid.svelte';

export type { Reverser };

export const sim = $state({
	locos: [] as Loco[]
});

export const MAX_THROTTLE = 8;
export const WAGON_LENGTH = 0.6;

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
		routingTrail: []
	});
}

export function removeLoco(id: number) {
	const idx = sim.locos.findIndex((l) => l.id === id);
	if (idx >= 0) sim.locos.splice(idx, 1);
	if (!anyMoving() && rafHandle) {
		cancelAnimationFrame(rafHandle);
		rafHandle = 0;
	}
}

export function clearAllLocos() {
	sim.locos.length = 0;
	nextLocoId = 1;
	if (rafHandle) cancelAnimationFrame(rafHandle);
	rafHandle = 0;
}

// Walk a vehicle along the track by `distance`, advancing in v.dir * motionSign.
// motionSign +1 = head-first (forward), -1 = rear-first (reverse).
//
// At a switch facing-point, the vehicle scans the shared `trail` from its own
// `routingCursor`. If a matching (tileKey, entryPort) entry is found, it reuses
// the recorded pathIdx — keeping the chain consistent with whichever vehicle
// led through this crossing. If no match is found, the vehicle is acting as
// leader: it picks based on the switch's current `active` state and appends.
function step(
	v: Vehicle,
	distance: number,
	motionSign: 1 | -1,
	trail: RoutingDecision[]
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

function loop() {
	const now = performance.now();
	const dt = Math.min((now - lastTime) / 1000, 0.1);
	lastTime = now;
	for (const l of sim.locos) {
		if (locoIsMoving(l)) {
			const dist = l.throttle * dt;
			const sign = l.reverser as 1 | -1;
			step(l, dist, sign, l.routingTrail);
			for (const w of l.wagons) {
				if (!w.stopped) step(w, dist, sign, l.routingTrail);
			}
			pruneTrail(l);
		}
	}
	if (anyMoving()) {
		rafHandle = requestAnimationFrame(loop);
	} else {
		rafHandle = 0;
	}
}

function startLoopIfNeeded() {
	if (rafHandle !== 0 || !anyMoving()) return;
	lastTime = performance.now();
	rafHandle = requestAnimationFrame(loop);
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
	const last: Vehicle =
		loco.wagons.length > 0 ? loco.wagons[loco.wagons.length - 1] : loco;
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
