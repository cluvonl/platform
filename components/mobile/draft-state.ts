const dirtyDrafts = new Set<string>();
export function setMobileDraftDirty(scope: string, dirty: boolean) {if (dirty) dirtyDrafts.add(scope); else dirtyDrafts.delete(scope);}
export function hasUnsavedMobileDraft() {return dirtyDrafts.size > 0;}
export function clearMobileDrafts() {dirtyDrafts.clear();}
