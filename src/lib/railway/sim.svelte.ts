import { dx, dy, opposite, type Loco } from './types';
import { pathsOf } from './pieces';
import { pathLength } from './geometry';
import { getPiece } from './grid.svelte';

export type Reverser = -1 | 0 | 1;

export const sim = $state({
	loco: null as Loco | null,
	reverser: 0 as Reverser,
	throttle: 0 // notches 0..MAX_THROTTLE, interpreted as tiles/sec
});

export const MAX_THROTTLE = 8;

let rafHandle = 0;
let lastTime = 0;
// Tracks the loco's current physical motion direction relative to placement,
// so we know whether to flip loco.dir when the user toggles reverser.
let lastNonzeroReverser: 1 | -1 = 1;

export function placeLoco(x: number, y: number) {
	const piece = getPiece(x, y);
	if (!piece) return;
	sim.loco = { x, y, pathIdx: 0, t: 0.5, dir: 1, stopped: false };
	lastNonzeroReverser = 1;
	sim.reverser = 0;
	sim.throttle = 0;
}

export function clearLoco() {
	sim.loco = null;
	sim.reverser = 0;
	sim.throttle = 0;
	if (rafHandle) cancelAnimationFrame(rafHandle);
	rafHandle = 0;
}

function step(loco: Loco, distance: number) {
	let remaining = distance;
	let safety = 1000;
	while (remaining > 1e-9 && !loco.stopped && safety-- > 0) {
		const piece = getPiece(loco.x, loco.y);
		if (!piece) {
			loco.stopped = true;
			break;
		}
		const paths = pathsOf(piece);
		const path = paths[loco.pathIdx];
		const pl = pathLength(path);
		const remainingT = loco.dir === 1 ? 1 - loco.t : loco.t;
		const remainingDist = remainingT * pl;
		if (remaining <= remainingDist) {
			loco.t += loco.dir * (remaining / pl);
			return;
		}
		remaining -= remainingDist;
		const exitDir = loco.dir === 1 ? path.to : path.from;
		const nx = loco.x + dx[exitDir];
		const ny = loco.y + dy[exitDir];
		const entryDir = opposite(exitDir);
		const nextPiece = getPiece(nx, ny);
		if (!nextPiece) {
			loco.stopped = true;
			loco.t = loco.dir === 1 ? 1 : 0;
			break;
		}
		const nextPaths = pathsOf(nextPiece);
		const candidates: { idx: number; entry: 'from' | 'to' }[] = [];
		for (let i = 0; i < nextPaths.length; i++) {
			if (nextPaths[i].from === entryDir) candidates.push({ idx: i, entry: 'from' });
			else if (nextPaths[i].to === entryDir) candidates.push({ idx: i, entry: 'to' });
		}
		if (candidates.length === 0) {
			loco.stopped = true;
			loco.t = loco.dir === 1 ? 1 : 0;
			break;
		}
		let chosen = candidates[0];
		if (candidates.length > 1) {
			const active = nextPiece.active ?? 0;
			chosen = candidates.find((c) => c.idx === active) ?? candidates[0];
		}
		loco.x = nx;
		loco.y = ny;
		loco.pathIdx = chosen.idx;
		loco.dir = chosen.entry === 'from' ? 1 : -1;
		loco.t = chosen.entry === 'from' ? 0 : 1;
	}
}

function isMoving(): boolean {
	return !!(sim.loco && !sim.loco.stopped && sim.reverser !== 0 && sim.throttle > 0);
}

function loop() {
	const now = performance.now();
	const dt = Math.min((now - lastTime) / 1000, 0.1);
	lastTime = now;
	if (isMoving()) {
		step(sim.loco!, sim.throttle * dt);
	}
	if (isMoving()) {
		rafHandle = requestAnimationFrame(loop);
	} else {
		rafHandle = 0;
	}
}

function startLoopIfNeeded() {
	if (rafHandle !== 0 || !isMoving()) return;
	lastTime = performance.now();
	rafHandle = requestAnimationFrame(loop);
}

export function setReverser(r: Reverser) {
	if (r === sim.reverser) return;
	if (sim.loco && r !== 0 && r !== lastNonzeroReverser) {
		sim.loco.dir = (-sim.loco.dir) as 1 | -1;
		lastNonzeroReverser = r;
	}
	if (sim.loco?.stopped && r !== 0) sim.loco.stopped = false;
	sim.reverser = r;
	startLoopIfNeeded();
}

export function setThrottle(t: number) {
	const clamped = Math.max(0, Math.min(MAX_THROTTLE, t));
	sim.throttle = clamped;
	if (sim.loco?.stopped && clamped > 0 && sim.reverser !== 0) sim.loco.stopped = false;
	startLoopIfNeeded();
}
