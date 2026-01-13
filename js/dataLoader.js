import { createLogger } from './logger.js';

const log = createLogger('DataLoader');

// Simple data loader with in-memory cache for local JSON files used by stages
const cache = {};

export async function loadData(path) {
  if (cache[path]) return cache[path];
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    const j = await res.json();
    cache[path] = j;
    return j;
  } catch (e) {
    log.warn('loadData failed', { path, error: e });
    cache[path] = null;
    return null;
  }
}

export default { loadData };
