import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { trackEvent } from '../services/analytics';
import { clearSession } from '../state/session';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// The app's last line of defence. Without a boundary, any error thrown during
// render unmounts the whole tree and leaves a blank white page — the worst
// possible outcome for a split the user has been tapping through, and the one
// case where the localStorage persistence in state/session.ts can't help by
// itself. This keeps the failure visible and explains that the work is saved.
//
// Must be a class: React exposes no hook equivalent of componentDidCatch.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log locally for dev, and report through the analytics chokepoint so
    // crashes are visible in Amplitude alongside the session replay. Only the
    // message and component stack — never the receipt contents.
    console.error('Unhandled render error:', error, info.componentStack);
    trackEvent('app-crashed', {
      message: error.message,
      componentStack: info.componentStack?.slice(0, 2000),
    });
  }

  // Plain reload: the persisted session is rehydrated, so the user resumes
  // where they were. This is the right first try when the crash was transient.
  private handleReload = () => {
    window.location.reload();
  };

  // Escape hatch for the case a reload can't fix: when the restored session is
  // itself what crashes, reloading just replays the crash. Dropping the session
  // (people are kept, under their own key) breaks that loop.
  private handleStartOver = () => {
    clearSession();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <div className="p-6">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 flex items-start gap-4">
              <div className="p-2 bg-white rounded-full border border-slate-200 text-red-500 shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Something went wrong</h3>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                  Your split is saved. Reloading should pick up where you left off.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={this.handleStartOver}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              >
                Start over
              </button>
              <button
                onClick={this.handleReload}
                autoFocus
                className="px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
