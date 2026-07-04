// Passenger/station visual identity helpers, shared by the board renderers
// and the sim (which spawns boarding walkers). Kept out of the components so
// the station's platform geometry and the passenger colour scheme stay in one
// place.

import { hash2 } from './decorations';
import { getPiece } from './grid.svelte';
import { pathsOf } from './pieces';

// Every passenger wears the colour of the station they boarded at, so an
// observer can follow "the green people" from their origin platform onto a
// wagon and off again somewhere else. Hue comes from the station's cell
// coordinates; saturation/lightness wobble in a narrow band so two stations
// with nearby hues still read differently.
export function personColor(originKey: string): string {
	const [x, y] = originKey.split(',').map(Number);
	const hue = Math.round(hash2(x | 0, y | 0, 71) * 360);
	const sat = Math.round(55 + hash2(x | 0, y | 0, 72) * 20);
	const lig = Math.round(38 + hash2(x | 0, y | 0, 73) * 12);
	return `hsl(${hue} ${sat}% ${lig}%)`;
}

export type PlatformSide = 'south' | 'east';

// Which edge of the tile the platform is drawn on. Stations only exist on
// cells with track; if the tile's path is purely vertical (N↔S) the platform
// goes on the east edge to sit alongside the rails, otherwise on the south
// edge.
export function platformSide(x: number, y: number): PlatformSide {
	const piece = getPiece(x, y);
	if (!piece) return 'south';
	const paths = pathsOf(piece);
	if (paths.length === 0) return 'south';
	for (const p of paths) {
		if (p.from === 1 || p.from === 3 || p.to === 1 || p.to === 3) return 'south';
	}
	return 'east';
}

// Tile-local point where waiting passengers cluster — the spot boarding
// walkers set off from and dismounting walkers head to.
export function platformAnchor(x: number, y: number): { ax: number; ay: number } {
	return platformSide(x, y) === 'south' ? { ax: 0.5, ay: 0.85 } : { ax: 0.85, ay: 0.64 };
}
