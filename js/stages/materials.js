// Materials stage logic: validation and utilities
export function isMaterialsComplete(appState) {
  try {
    const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
    const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
    return !!(hasMaterial && hasColor);
  } catch (e) {
    return false;
  }
}

export default { isMaterialsComplete };
