export const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)';

export function isMobileViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}
