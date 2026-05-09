import { dx, dy, opposite, type Loco } from './types';
import { pathsOf } from './pieces';
import { pathLength } from './geometry';
import { getPiece } from './grid.svelte';

export const sim = $state({
	loco: null as Loco | null,
	running: false,
	speed: 2 // tiles per second
});

export function placeLoco(x: number, y: number) {
	const piece = getPiece(x, y);
	if (!piece) return;
	sim.loco = { x, y, pathIdx: 0, t: 0.5, dir: 1, stopped: false };
}

export function clearLoco() {
	sim.loco = null;
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

let lastTime = 0;
let rafHandle = 0;

function loop() {
	const now = performance.now();
	const dt = Math.min((now - lastTime) / 1000, 0.1);
	lastTime = now;
	if (sim.loco && !sim.loco.stopped) {
		step(sim.loco, sim.speed * dt);
	}
	if (sim.running) rafHandle = requestAnimationFrame(loop);
}

export function play() {
	if (sim.running || !sim.loco) return;
	sim.loco.stopped = false;
	sim.running = true;
	lastTime = performance.now();
	rafHandle = requestAnimationFrame(loop);
}

export function pause() {
	sim.running = false;
	if (rafHandle) cancelAnimationFrame(rafHandle);
}

export function setSpeed(s: number) {
	sim.speed = s;
}
