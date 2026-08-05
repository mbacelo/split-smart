// Single analytics chokepoint for the whole app. Events go to Amplitude via its
// Browser SDK. Every call is guarded so a blocked, absent, or unconfigured
// backend can never throw — instrumentation must never break the app.
import * as amplitude from '@amplitude/analytics-browser';
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-browser';

// Whether Amplitude was successfully initialized. When false (no API key, or the
// SDK failed/was blocked), trackEvent/identifyUser no-op.
let amplitudeReady = false;

// Every event the app can emit. Keeping the taxonomy closed makes a typo'd
// event name a compile error instead of a silently forked metric.
export type AnalyticsEvent =
  | 'signed-in'
  | 'signed-out'
  | 'receipt-upload-started'
  | 'receipt-scan-succeeded'
  | 'receipt-scan-failed'
  | 'receipt-scan-cancelled'
  | 'enter-items-manually'
  | 'receipt-reset'
  | 'first-item-assigned'
  | 'person-added'
  | 'tip-set'
  | 'discount-set'
  | 'summary-shared'
  | 'summary-share-cancelled'
  | 'summary-share-failed'
  | 'scan-sign-in-prompted'
  | 'waitlist-prompted'
  | 'waitlist-joined'
  | 'waitlist-join-failed'
  | 'access-granted'
  | 'access-revoked'
  | 'access-rejected'
  | 'access-grant-failed'
  | 'app-crashed';

/**
 * Initialize Amplitude once at app startup. Reads the client-side API key from
 * VITE_AMPLITUDE_API_KEY. If the key is absent (e.g. local dev without a key),
 * this no-ops and the app runs normally — events just don't reach Amplitude.
 */
export const initAnalytics = (): void => {
  const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined;
  if (!apiKey) return;
  try {
    // Session Replay: record 100% of sessions — the app is behind an email
    // allowlist with a handful of users, so replay quota isn't a concern.
    // Must be added before init(). Default masking (inputs) is kept.
    amplitude.add(sessionReplayPlugin({ sampleRate: 1 }));
    amplitude.init(apiKey, {
      // Auto-capture sessions and page views; explicit events come via trackEvent.
      autocapture: { sessions: true, pageViews: true },
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

export const trackEvent = (event: AnalyticsEvent, params?: Record<string, unknown>): void => {
  if (!amplitudeReady) return;
  try {
    amplitude.track(event, params);
  } catch {
    /* ignore — analytics must never break the app */
  }
};
