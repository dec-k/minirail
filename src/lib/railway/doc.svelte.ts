// Tracks which saved layout (if any) is currently loaded and whether the canvas
// has unsaved edits. The "document" abstraction lets the UI offer real
// document semantics (Save updates the loaded file; New / Load can prompt to
// discard unsaved work) instead of treating every save as a fresh entry.
//
// `key` is the localStorage suffix (after persistence's STORAGE_PREFIX). It is
// null when nothing is loaded yet — fresh canvas or file import that hasn't
// been persisted. `name` is the human label shown in the header.
//
// Grid and sim mutators call `markDirty()` after edits. Bulk operations that
// produce a known-clean state (load, new) call `setLoaded` / `clearLoaded`,
// both of which reset the dirty flag — they're called *after* the mutators
// have fired so they override any intermediate dirty marks.
export const doc = $state({
	key: null as string | null,
	name: null as string | null,
	dirty: false
});

export function markDirty() {
	doc.dirty = true;
}

export function markClean() {
	doc.dirty = false;
}

export function setLoaded(key: string | null, name: string) {
	doc.key = key;
	doc.name = name;
	doc.dirty = false;
}

export function clearLoaded() {
	doc.key = null;
	doc.name = null;
	doc.dirty = false;
}
