<script lang="ts">
	import { particles } from '$lib/railway/particles.svelte';
	import { TILE } from './constants';

	let { widthPx, heightPx }: { widthPx: number; heightPx: number } = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	function drawParticles(ctx: CanvasRenderingContext2D) {
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		for (const p of particles.list) {
			const t = Math.min(1, p.life / p.maxLife);
			const cx = p.x * TILE;
			const cy = p.y * TILE;
			const r = (0.1 + t * 0.22) * TILE;
			const alpha = (1 - t) * 0.55;
			const tint = Math.floor(255 - t * 50);
			const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
			grad.addColorStop(0, `rgba(${tint},${tint},${tint},${alpha})`);
			grad.addColorStop(0.5, `rgba(${tint},${tint},${tint},${alpha * 0.45})`);
			grad.addColorStop(1, `rgba(${tint},${tint},${tint},0)`);
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// Local rAF loop. Runs while particles exist, plus one final frame after the
	// list empties so the last puff actually clears off the canvas.
	$effect(() => {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		let raf = 0;
		let lastDrewCount = 0;
		const frame = () => {
			const n = particles.list.length;
			if (n > 0 || lastDrewCount > 0) {
				drawParticles(ctx);
				lastDrewCount = n;
			}
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

<canvas
	bind:this={canvasEl}
	width={widthPx}
	height={heightPx}
	class="pointer-events-none absolute top-0 left-0"
	style="width: {widthPx}px; height: {heightPx}px;"
></canvas>
