<script lang="ts">
	import { useThrelte, useTask } from '@threlte/core';
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import {
		EffectComposer,
		EffectPass,
		RenderPass,
		DepthOfFieldEffect,
		SMAAEffect,
		VignetteEffect
	} from 'postprocessing';

	// Takes over rendering from Threlte so a post-processing chain can run:
	// depth-of-field (the tilt-shift "miniature" look), SMAA (the composer bypasses
	// the renderer's MSAA, so we re-add AA here), and a soft vignette. Still
	// on-demand — this only renders on the frames Threlte invalidates (camera move,
	// edits, train motion), so an idle scene costs nothing.
	const { scene, renderer, camera, size, autoRender, renderStage } = useThrelte();

	const composer = new EffectComposer(renderer);
	let dof: DepthOfFieldEffect | undefined;

	function setup(cam: THREE.PerspectiveCamera) {
		composer.removeAllPasses();
		composer.addPass(new RenderPass(scene, cam));
		dof = new DepthOfFieldEffect(cam, {
			focusDistance: 0,
			focalLength: 0.04,
			bokehScale: 3.2,
			resolutionScale: 0.85
		});
		dof.target = new THREE.Vector3(0, 0, 0);
		const vignette = new VignetteEffect({ offset: 0.34, darkness: 0.5 });
		composer.addPass(new EffectPass(cam, dof, new SMAAEffect(), vignette));
	}

	$effect(() => {
		const cam = $camera;
		if (cam) setup(cam as THREE.PerspectiveCamera);
	});
	$effect(() => {
		composer.setSize($size.width, $size.height);
	});

	onMount(() => {
		const prev = autoRender.current;
		autoRender.set(false);
		return () => {
			autoRender.set(prev);
			composer.dispose();
		};
	});

	// Refocus DoF on the ground point the camera is aimed at, so the centred model
	// stays crisp while orbiting/panning and only the fore/background blur.
	const fwd = new THREE.Vector3();
	useTask(
		(delta) => {
			const cam = camera.current as THREE.PerspectiveCamera | undefined;
			if (cam && dof?.target) {
				cam.getWorldDirection(fwd);
				if (Math.abs(fwd.y) > 1e-4) {
					const t = -cam.position.y / fwd.y;
					if (t > 0) dof.target.copy(cam.position).addScaledVector(fwd, t);
				}
			}
			composer.render(delta);
		},
		{ stage: renderStage, autoInvalidate: false }
	);
</script>
