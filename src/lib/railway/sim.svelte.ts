import { dx, dy, opposite, LOCO_COLORS, type Loco, type Reverser } from './types';
import { pathsOf } from './pieces';
import { pathLength } from './geometry';
import { getPiece } from './grid.svelte';

export type { Reverser };

export const sim = $state({
	locos: [] as Loco[]
});

export const MAX_THROTTLE = 8;

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
		lastNonzeroReverser: 1
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
		if (locoIsMoving(l)) step(l, l.throttle * dt);
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
	if (r !== 0 && r !== loco.lastNonzeroReverser) {
		loco.dir = (-loco.dir) as 1 | -1;
		loco.lastNonzeroReverser = r;
	}
	if (loco.stopped && r !== 0) loco.stopped = false;
	loco.reverser = r;
	startLoopIfNeeded();
}

export function setThrottle(id: number, t: number) {
	const loco = findLoco(id);
	if (!loco) return;
	const clamped = Math.max(0, Math.min(MAX_THROTTLE, t));
	loco.throttle = clamped;
	if (loco.stopped && clamped > 0 && loco.reverser !== 0) loco.stopped = false;
	startLoopIfNeeded();
}
