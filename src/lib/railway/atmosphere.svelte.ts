// Global presentation state: the time of day the layout is lit for. The
// renderer (LightingLayer) reads `atmosphere.timeOfDay` and cross-fades the
// darkness tint and lamp glow whenever it changes.

export type TimeOfDay = 'day' | 'dusk' | 'night' | 'dawn';

export const TIMES_OF_DAY: TimeOfDay[] = ['day', 'dusk', 'night', 'dawn'];

export const atmosphere = $state({
	timeOfDay: 'day' as TimeOfDay
});

export function setTimeOfDay(t: TimeOfDay) {
	atmosphere.timeOfDay = t;
}
