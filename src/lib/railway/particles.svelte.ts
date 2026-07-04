// Lightweight ephemeral particle systems in grid-tile coordinates. Owned by
// the sim loop: spawned by moving locos (steam) and boarding events (walkers),
// ticked once per RAF frame, removed when life >= maxLife. Renderers consume
// the reactive lists.

export type Particle = {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
};

// A passenger walking between a platform and the train during (de)boarding.
// Pure animation — the sim's passenger counts change instantly; the walker
// just makes the transfer visible. Endpoints are grid-tile coordinates.
export type Walker = {
	id: number;
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	life: number;
	maxLife: number;
	color: string;
};

export const particles = $state({ list: [] as Particle[] });
export const walkers = $state({ list: [] as Walker[] });

let nextId = 1;

const STEAM_LIFE = 0.9;

export function spawnSteam(x: number, y: number, vx: number, vy: number) {
	particles.list.push({
		id: nextId++,
		x,
		y,
		vx,
		vy,
		life: 0,
		maxLife: STEAM_LIFE
	});
}

export function spawnWalker(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	color: string,
	duration: number
) {
	walkers.list.push({ id: nextId++, x0, y0, x1, y1, life: 0, maxLife: duration, color });
}

export function tickParticles(dt: number) {
	const list = particles.list;
	for (let i = list.length - 1; i >= 0; i--) {
		const p = list[i];
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.life += dt;
		if (p.life >= p.maxLife) list.splice(i, 1);
	}
	const wl = walkers.list;
	for (let i = wl.length - 1; i >= 0; i--) {
		const w = wl[i];
		w.life += dt;
		if (w.life >= w.maxLife) wl.splice(i, 1);
	}
}

export function hasActiveParticles(): boolean {
	return particles.list.length > 0 || walkers.list.length > 0;
}

export function clearParticles() {
	particles.list.length = 0;
	walkers.list.length = 0;
}
