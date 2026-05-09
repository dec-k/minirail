import { type Dir, type TilePath } from './types';

const PORT_MIDPOINT: Record<Dir, [number, number]> = {
	0: [0.5, 0],
	1: [1, 0.5],
	2: [0.5, 1],
	3: [0, 0.5]
};

export type PathSample = { x: number; y: number; heading: number };

export function isStraight(path: TilePath): boolean {
	return ((path.from + 2) % 4) === path.to;
}

function arcCenter(a: Dir, b: Dir): [number, number] {
	const set = new Set([a, b]);
	if (set.has(0) && set.has(1)) return [1, 0];
	if (set.has(1) && set.has(2)) return [1, 1];
	if (set.has(2) && set.has(3)) return [0, 1];
	if (set.has(3) && set.has(0)) return [0, 0];
	throw new Error(`Not an adjacent port pair: ${a},${b}`);
}

export function pathLength(path: TilePath): number {
	return isStraight(path) ? 1 : Math.PI / 4;
}

export function sample(path: TilePath, t: number): PathSample {
	const [fx, fy] = PORT_MIDPOINT[path.from];
	const [tx, ty] = PORT_MIDPOINT[path.to];
	if (isStraight(path)) {
		const dx = tx - fx;
		const dy = ty - fy;
		return { x: fx + dx * t, y: fy + dy * t, heading: Math.atan2(dy, dx) };
	}
	const [cx, cy] = arcCenter(path.from, path.to);
	const startAngle = Math.atan2(fy - cy, fx - cx);
	const endAngle = Math.atan2(ty - cy, tx - cx);
	let delta = endAngle - startAngle;
	if (delta > Math.PI) delta -= 2 * Math.PI;
	if (delta < -Math.PI) delta += 2 * Math.PI;
	const angle = startAngle + delta * t;
	const r = 0.5;
	const x = cx + r * Math.cos(angle);
	const y = cy + r * Math.sin(angle);
	const sign = Math.sign(delta);
	const heading = Math.atan2(sign * Math.cos(angle), -sign * Math.sin(angle));
	return { x, y, heading };
}

export function svgPathD(path: TilePath, tileSize: number): string {
	const [fx, fy] = PORT_MIDPOINT[path.from];
	const [tx, ty] = PORT_MIDPOINT[path.to];
	const sx = fx * tileSize;
	const sy = fy * tileSize;
	const ex = tx * tileSize;
	const ey = ty * tileSize;
	if (isStraight(path)) {
		return `M ${sx} ${sy} L ${ex} ${ey}`;
	}
	const r = 0.5 * tileSize;
	const [cx, cy] = arcCenter(path.from, path.to);
	const startAngle = Math.atan2(fy - cy, fx - cx);
	const endAngle = Math.atan2(ty - cy, tx - cx);
	let delta = endAngle - startAngle;
	if (delta > Math.PI) delta -= 2 * Math.PI;
	if (delta < -Math.PI) delta += 2 * Math.PI;
	const sweepFlag = delta > 0 ? 1 : 0;
	return `M ${sx} ${sy} A ${r} ${r} 0 0 ${sweepFlag} ${ex} ${ey}`;
}
