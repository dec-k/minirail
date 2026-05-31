<script lang="ts">
	import { particles } from '$lib/railway/particles.svelte';
	import { TILE } from './constants';

	let { widthPx, heightPx }: { widthPx: number; heightPx: number } = $props();

	let canvasEl: HTMLCanvasElement | undefined = $state();

	function drawSteam(ctx: CanvasRenderingContext2D, p: (typeof particles.list)[number]) {
		const t = Math.min(1, p.life / p.maxLife);
		const cx = p.x * TILE;
		const cy = p.y * TILE;
		const r = (0.1 + t * p.size * 1.4) * TILE;
		const alpha = (1 - t) * 0.55;
		// Sootier puffs leave the stack dark and lighten as they cool and disperse.
		const lightAnchor = 220;
		const start = lightAnchor - p.soot * 170;
		const tint = Math.floor(start + (lightAnchor - start) * t);
		const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
		grad.addColorStop(0, `rgba(${tint},${tint},${tint},${alpha})`);
		grad.addColorStop(0.5, `rgba(${tint},${tint},${tint},${alpha * 0.45})`);
		grad.addColorStop(1, `rgba(${tint},${tint},${tint},0)`);
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
	}

	function drawParticles(ctx: CanvasRenderingContext2D) {
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		// Sparks composite additively for a glowing ember look; steam uses normal
		// alpha. Draw steam first, then the additive spark glow pass.
		for (const p of particles.list) {
			if (p.kind === 'steam') drawSteam(ctx, p);
		}
		ctx.globalCompositeOperation = 'lighter';
		for (const p of particles.list) {
			if (p.kind !== 'spark') continue;
			const t = Math.min(1, p.life / p.maxLife);
			const cx = p.x * TILE;
			const cy = p.y * TILE;
			const r = (p.size + 0.02) * TILE;
			const alpha = (1 - t) * 0.9;
			const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
			grad.addColorStop(0, `rgba(255,248,200,${alpha})`);
			grad.addColorStop(0.4, `rgba(255,176,64,${alpha * 0.8})`);
			grad.addColorStop(1, 'rgba(255,120,0,0)');
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalCompositeOperation = 'source-over';
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
