// Shared, app-lifetime geometries and materials for the instanced scenery, plus
// a cache of rail tube geometries keyed by path shape. Creating these once (and
// reusing them across every InstancedMesh) is the bulk of the performance win:
// a whole forest of trees becomes ~3 draw calls instead of thousands of meshes.
//
// Geometries are authored as unit primitives so per-instance scale can size
// them; rotations that are constant (the pyramid roof, the ground patches) are
// baked into the geometry so instances only carry translation/scale/colour.

import * as THREE from 'three';
import { railGeometry } from './geometry3d';
import type { TilePath } from '$lib/railway/types';

export type InstanceItem = {
	x: number;
	y: number;
	z: number;
	sx?: number;
	sy?: number;
	sz?: number;
	ry?: number;
	color?: string;
};

// --- geometries (unit-sized; instances scale them) ---
export const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1, 6);
export const coneGeo = new THREE.ConeGeometry(1, 1, 8); // tree foliage
export const boxGeo = new THREE.BoxGeometry(1, 1, 1); // building body
export const roofGeo = (() => {
	const g = new THREE.ConeGeometry(0.74, 1, 4); // 4-sided = pyramid
	g.rotateY(Math.PI / 4); // sit square on the box
	return g;
})();
export const patchGeo = (() => {
	const g = new THREE.PlaneGeometry(1, 1);
	g.rotateX(-Math.PI / 2); // lie flat on the ground (XZ)
	return g;
})();
export const tuftGeo = new THREE.ConeGeometry(0.035, 0.09, 4);
export const pebbleGeo = new THREE.DodecahedronGeometry(1);
export const sleeperGeo = new THREE.BoxGeometry(0.07, 0.06, 0.46);

// --- materials (white base where per-instance colour is used) ---
export const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b3a12', roughness: 1 });
export const foliageMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
export const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
export const roofMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
export const grassPatchMat = new THREE.MeshStandardMaterial({ color: '#7faf5a', roughness: 1 });
export const stonePatchMat = new THREE.MeshStandardMaterial({ color: '#b8b2a6', roughness: 1 });
export const tuftMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
export const pebbleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
export const waterMat = new THREE.MeshStandardMaterial({
	color: '#3a8fc7',
	transparent: true,
	opacity: 0.88,
	roughness: 0.2,
	metalness: 0.15
});
export const sleeperMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
export const railMat = new THREE.MeshStandardMaterial({
	color: '#ffffff',
	metalness: 0.6,
	roughness: 0.4
});

// Rail tubes are identical for every tile sharing a path shape, so cache them by
// (from, to, side). A track loop reuses a handful of shapes → a few draw calls.
const railCache = new Map<string, THREE.TubeGeometry>();
export function railSig(path: TilePath, side: 1 | -1): string {
	return `${path.from}-${path.to}-${side}`;
}
export function getRailGeo(path: TilePath, side: 1 | -1): THREE.TubeGeometry {
	const sig = railSig(path, side);
	let g = railCache.get(sig);
	if (!g) {
		g = railGeometry(path, side);
		railCache.set(sig, g);
	}
	return g;
}
