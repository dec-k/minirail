// Lightweight ephemeral particle system in grid-tile coordinates. Owned by
// the sim loop: spawned by moving locos, ticked once per RAF frame, removed
// when life >= maxLife. Renderers consume `particles.list` reactively.

export type Particle = {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
};

export const particles = $state({ list: [] as Particle[] });

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

export function tickParticles(dt: number) {
	const list = particles.list;
	for (let i = list.length - 1; i >= 0; i--) {
		const p = list[i];
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.life += dt;
		if (p.life >= p.maxLife) list.splice(i, 1);
	}
}

export function hasActiveParticles(): boolean {
	return particles.list.length > 0;
}

export function clearParticles() {
	particles.list.length = 0;
}
