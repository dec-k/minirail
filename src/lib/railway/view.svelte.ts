// Presentation-only view state. Kept separate from grid/sim/doc because it
// never touches world data — it only changes how the board is drawn.
//
// `tilted` swaps the flat 2D SVG board (Board.svelte) for the real 3D Threlte
// diorama (Board3D.svelte); +page.svelte picks the renderer off this flag.

export const view = $state({ tilted: false });

export function toggleTilt() {
	view.tilted = !view.tilted;
}
