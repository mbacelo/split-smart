// Thin wrapper around the GTM dataLayer (pushed in index.html). Safe to call
// even if GTM failed to load (e.g. blocked by an ad blocker) since it lazily
// creates window.dataLayer if missing, mirroring GTM's own snippet.
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export const trackEvent = (event: string, params?: Record<string, unknown>): void => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
};
