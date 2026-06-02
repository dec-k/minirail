// Presentation-only view state. Kept separate from grid/sim/doc because it
// never touches world data — it only changes how the board is drawn.
//
// `tilted` leans the whole board back into a tabletop "diorama" via a CSS 3D
// transform in Board.svelte. While tilted, tile editing is suppressed because
// the SVG's getScreenCTM().inverse() (used to map pointer → cell) returns a 2D
// matrix and cannot account for the 3D perspective — clicks would land on the
// wrong tile. Pan/zoom still work since they're plain numeric math. Scenery
// "stands up" via the `.standee` CSS rule that keys off the tilted board.

export const TILT_DEG = 54;

export const view = $state({ tilted: false });

export function toggleTilt() {
	view.tilted = !view.tilted;
}
