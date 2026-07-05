// Single analytics chokepoint for the whole app. Events go to Amplitude via its
// Browser SDK. Every call is guarded so a blocked, absent, or unconfigured
// backend can never throw — instrumentation must never break the app.
import * as amplitude from '@amplitude/analytics-browser';

// Whether Amplitude was successfully initialized. When false (no API key, or the
// SDK failed/was blocked), trackEvent/identifyUser no-op.
let amplitudeReady = false;

/**
 * Initialize Amplitude once at app startup. Reads the client-side API key from
 * VITE_AMPLITUDE_API_KEY. If the key is absent (e.g. local dev without a key),
 * this no-ops and the app runs normally — events just don't reach Amplitude.
 */
export const initAnalytics = (): void => {
  const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined;
  if (!apiKey) return;
  try {
    amplitude.init(apiKey, {
      // Auto-capture sessions and page views; explicit events come via trackEvent.
      defaultTracking: { sessions: true, pageViews: true },
    });
    amplitudeReady = true;
  } catch {
    // Blocked by an ad blocker, offline, etc. — leave analytics disabled.
    amplitudeReady = false;
  }
};

/** Tie subsequent events to a signed-in user (the app is gated behind sign-in). */
export const identifyUser = (email: string): void => {
  if (!amplitudeReady) return;
  try {
    amplitude.setUserId(email);
  } catch {
    /* ignore — analytics must never break the app */
  }
};

export const trackEvent = (event: string, params?: Record<string, unknown>): void => {
  if (!amplitudeReady) return;
  try {
    amplitude.track(event, params);
  } catch {
    /* ignore — analytics must never break the app */
  }
};
