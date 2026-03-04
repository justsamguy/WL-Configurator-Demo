const handledSelectionEvents = new WeakSet();

export function isSelectionClickHandled(event) {
  return !!(event && handledSelectionEvents.has(event));
}

export function markSelectionClickHandled(event) {
  if (!event) return;
  handledSelectionEvents.add(event);
}
