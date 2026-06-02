// Bridges the renderer-agnostic railway geometry (geometry.ts) into three.js
// meshes. Nothing here knows about Svelte — it just turns the same `sample()`
// path data the SVG board uses into BufferGeometries for the 3D scene.
//
// Coordinate mapping: the board lies on the XZ ground plane with Y up. A tile's
// local (sx, sy) from `sample()` maps to (sx, height, sy) — i.e. the SVG's
// "screen-down" y becomes world Z. Each Track3D group is positioned at its grid
// (x, y) so these helpers work purely in tile-local 0..1 space.

import * as THREE from 'three';
import { sample, isStraight } from '$lib/railway/geometry';
import type { TilePath } from '$lib/railway/types';

export const RAIL_Y = 0.07; // rail height above the ground plane
export const RAIL_GAUGE = 0.16; // half-distance between the two rails
export const RAIL_RADIUS = 0.028;

// One rail of a path as a tube. `side` is +1 / -1 for the two rails.
export function railGeometry(path: TilePath, side: 1 | -1): THREE.TubeGeometry {
	const n = isStraight(path) ? 2 : 10;
	const pts: THREE.Vector3[] = [];
	for (let i = 0; i <= n; i++) {
		const s = sample(path, i / n);
		// Perpendicular to travel in the XZ plane: travel dir is (cos h, sin h),
		// so the normal is (-sin h, cos h).
		const px = -Math.sin(s.heading);
		const pz = Math.cos(s.heading);
		pts.push(new THREE.Vector3(s.x + side * RAIL_GAUGE * px, RAIL_Y, s.y + side * RAIL_GAUGE * pz));
	}
	const curve = new THREE.CatmullRomCurve3(pts);
	return new THREE.TubeGeometry(curve, n * 2, RAIL_RADIUS, 6, false);
}

export type Sleeper = { x: number; z: number; rotY: number };

// Evenly spaced cross-ties along a path. Box meshes are oriented so their depth
// (Z) axis lies across the rails: rotation.y = -heading aligns a box's local
// axes with the direction of travel (sleeper symmetry makes the sign moot).
export function sleepers(path: TilePath, count = 5): Sleeper[] {
	const out: Sleeper[] = [];
	for (let i = 0; i < count; i++) {
		const s = sample(path, (i + 0.5) / count);
		out.push({ x: s.x, z: s.y, rotY: -s.heading });
	}
	return out;
}

// Grid line segments covering a width×height board, in the board group's local
// space (0..w, 0..h on XZ). Rendered as a single LineSegments mesh.
export function gridLinesGeometry(w: number, h: number): THREE.BufferGeometry {
	const verts: number[] = [];
	const y = 0.012; // lift slightly off the ground to avoid z-fighting
	for (let i = 0; i <= w; i++) {
		verts.push(i, y, 0, i, y, h);
	}
	for (let j = 0; j <= h; j++) {
		verts.push(0, y, j, w, y, j);
	}
	const geom = new THREE.BufferGeometry();
	geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
	return geom;
}
