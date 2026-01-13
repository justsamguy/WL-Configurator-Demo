import { createLogger } from './logger.js';

const log = createLogger('StageData');

// Lightweight stage data loader
export async function loadStageData(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return await res.json();
  } catch (e) {
    log.warn('loadStageData failed', { path, error: e });
    return null;
  }
}

export default { loadStageData };
