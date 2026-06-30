// Stable unique id for client-side items/people.
//
// `crypto.randomUUID()` only exists in a *secure context* (HTTPS or localhost).
// Served over a plain-HTTP LAN IP — handy for testing the PWA on a phone — or in
// some embedded webviews, it's undefined and throws. Fall back to a
// timestamp+random id there so the flow never dies on id generation.
export const makeId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};
