// Lightweight ephemeral particle system in grid-tile coordinates. Owned by
// the sim loop: spawned by moving locos (steam) and braking/switch events
// (sparks). Ticked once per RAF frame, removed when life >= maxLife. Renderers
// consume `particles.list` reactively.

export type ParticleKind = 'steam' | 'spark';

export type Particle = {
	id: number;
	kind: ParticleKind;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	// Base render size in tile-units (steam radius / spark glow radius).
	size: number;
	// 0..1 darkness for steam (0 = white puff, 1 = sooty). Ignored by sparks.
	soot: number;
};

export const particles = $state({ list: [] as Particle[] });

// Soft cap so a huge board under heavy weather can't grow the list without
// bound. Spawns are dropped once we're at the ceiling.
const MAX_PARTICLES = 700;

let nextId = 1;

const STEAM_LIFE = 0.9;

export function spawnSteam(
	x: number,
	y: number,
	vx: number,
	vy: number,
	soot = 0,
	size = 0.22,
	life = STEAM_LIFE
) {
	if (particles.list.length >= MAX_PARTICLES) return;
	particles.list.push({
		id: nextId++,
		kind: 'steam',
		x,
		y,
		vx,
		vy,
		life: 0,
		maxLife: life,
		size,
		soot
	});
}

// A short, bright burst of sparks flung outward from (x, y). Used for hard
// braking (wheels on rail) and switch throws (points snapping over).
export function spawnSparks(x: number, y: number, count: number, spread: number) {
	for (let i = 0; i < count; i++) {
		if (particles.list.length >= MAX_PARTICLES) return;
		const ang = Math.random() * Math.PI * 2;
		const sp = spread * (0.4 + Math.random() * 0.6);
		particles.list.push({
			id: nextId++,
			kind: 'spark',
			x,
			y,
			vx: Math.cos(ang) * sp,
			vy: Math.sin(ang) * sp - 0.3,
			life: 0,
			maxLife: 0.3 + Math.random() * 0.25,
			size: 0.05 + Math.random() * 0.04,
			soot: 0
		});
	}
}

const SPARK_GRAVITY = 6;
const SPARK_DRAG = 2.2;

// Advance and cull every particle.
export function tickParticles(dt: number) {
	const list = particles.list;
	for (let i = list.length - 1; i >= 0; i--) {
		const p = list[i];
		if (p.kind === 'spark') {
			p.vy += SPARK_GRAVITY * dt;
			const drag = Math.max(0, 1 - SPARK_DRAG * dt);
			p.vx *= drag;
			p.vy *= drag;
		}
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
