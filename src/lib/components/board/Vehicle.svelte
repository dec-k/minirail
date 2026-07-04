<script lang="ts">
	import { TILE } from './constants';

	let {
		kind,
		color,
		occupantColor = null,
		x,
		y,
		heading
	}: {
		kind: 'loco' | 'wagon';
		color: string;
		// Origin-station colour of the passenger riding this wagon, or null when
		// empty. Locos never carry passengers.
		occupantColor?: string | null;
		x: number;
		y: number;
		heading: number;
	} = $props();

	function darken(hex: string): string {
		const m = /^#([0-9a-f]{6})$/i.exec(hex);
		if (!m) return hex;
		const n = parseInt(m[1], 16);
		const r = Math.max(0, ((n >> 16) & 0xff) - 60);
		const g = Math.max(0, ((n >> 8) & 0xff) - 60);
		const b = Math.max(0, (n & 0xff) - 60);
		return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
	}

	const dark = $derived(darken(color));
</script>

<g transform="translate({x} {y}) rotate({heading})">
	{#if kind === 'loco'}
		{@const bodyL = -TILE * 0.32}
		{@const bodyR = TILE * 0.32}
		{@const halfH = TILE * 0.18}
		<ellipse
			cx="0"
			cy={halfH * 1.1}
			rx={TILE * 0.36}
			ry={halfH * 0.45}
			fill="#000"
			fill-opacity="0.18"
		/>
		<rect x={bodyL - 3} y="-2.5" width="3" height="5" fill="#222" />
		<rect x={-TILE * 0.22} y={-halfH - 2} width={TILE * 0.07} height="3" fill="#222" />
		<rect x={-TILE * 0.22} y={halfH - 1} width={TILE * 0.07} height="3" fill="#222" />
		<rect x={TILE * 0.06} y={-halfH - 2} width={TILE * 0.07} height="3" fill="#222" />
		<rect x={TILE * 0.06} y={halfH - 1} width={TILE * 0.07} height="3" fill="#222" />
		<rect
			x={bodyL}
			y={-halfH}
			width={TILE * 0.64}
			height={halfH * 2}
			rx={TILE * 0.07}
			fill={color}
			stroke={dark}
			stroke-width="1.5"
		/>
		<rect
			x={bodyL}
			y={-halfH}
			width={TILE * 0.22}
			height={halfH * 2}
			rx={TILE * 0.07}
			fill={dark}
			fill-opacity="0.55"
		/>
		<rect
			x={bodyL + TILE * 0.05}
			y={-TILE * 0.08}
			width={TILE * 0.12}
			height={TILE * 0.16}
			rx="1.5"
			fill="#fde68a"
		/>
		<circle cx={TILE * 0.05} cy="0" r={TILE * 0.065} fill="#1a1a1a" />
		<circle cx={TILE * 0.05} cy="0" r={TILE * 0.04} fill="#555" />
		<circle
			cx={bodyR - TILE * 0.03}
			cy="0"
			r={TILE * 0.04}
			fill="#fef3c7"
			stroke="#92400e"
			stroke-width="0.5"
		/>
		<polygon
			points="{bodyR},{-halfH + 1} {bodyR + TILE * 0.09},0 {bodyR},{halfH - 1}"
			fill="#3a3a3a"
			stroke="#1a1a1a"
			stroke-width="0.5"
		/>
	{:else}
		{@const wL = -TILE * 0.27}
		{@const wR = TILE * 0.27}
		{@const whalfH = TILE * 0.16}
		<ellipse
			cx="0"
			cy={whalfH * 1.1}
			rx={TILE * 0.3}
			ry={whalfH * 0.45}
			fill="#000"
			fill-opacity="0.18"
		/>
		<rect x={wL - 3} y="-2.5" width="3" height="5" fill="#222" />
		<rect x={wR} y="-2.5" width="3" height="5" fill="#222" />
		<rect x={-TILE * 0.18} y={-whalfH - 2} width={TILE * 0.07} height="3" fill="#222" />
		<rect x={-TILE * 0.18} y={whalfH - 1} width={TILE * 0.07} height="3" fill="#222" />
		<rect x={TILE * 0.11} y={-whalfH - 2} width={TILE * 0.07} height="3" fill="#222" />
		<rect x={TILE * 0.11} y={whalfH - 1} width={TILE * 0.07} height="3" fill="#222" />
		<rect
			x={wL}
			y={-whalfH}
			width={TILE * 0.54}
			height={whalfH * 2}
			rx={TILE * 0.05}
			fill={color}
			stroke={dark}
			stroke-width="1.5"
		/>
		{#if occupantColor}
			<!-- Passenger seen from above: shoulders in origin-station colour with
			     the head centred on top, so it stays readable at any heading. -->
			<circle
				cx="0"
				cy="0"
				r={TILE * 0.065}
				fill={occupantColor}
				stroke="rgba(0,0,0,0.35)"
				stroke-width="0.7"
			/>
			<circle cx="0" cy="0" r={TILE * 0.035} fill="#fbe49d" stroke="#7a5535" stroke-width="0.6" />
		{/if}
	{/if}
</g>
