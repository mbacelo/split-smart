import React, { useEffect } from 'react';
import { Receipt, RotateCcw, AlertCircle, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SignInGateProps {
  isOpen: boolean;
  /** True while a silent re-auth may still complete (show a spinner). */
  resolvingAuth: boolean;
  /** Why the sign-in button can't be shown, if it can't (see useAuth). */
  signInError: 'config' | 'unavailable' | null;
  /** Container the GIS Sign In button renders into (owned by useAuth). */
  signInButtonRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

// Sign-in is only required for the AI receipt scan, so instead of a whole-app
// wall this gate appears as a modal when the user actually starts a scan.
// Dismissing it returns them to the app (manual entry keeps working signed out).
export const SignInGate: React.FC<SignInGateProps> = ({
  isOpen,
  resolvingAuth,
  signInError,
  signInButtonRef,
  onClose,
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to SplitSmart"
    >
      <div
        ref={dialogRef}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 flex flex-col items-center text-center">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white mb-5">
            <Receipt className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
            SplitSmart
          </h2>
          <p className="text-slate-600 text-sm mb-6">
            Sign in to scan receipts with AI. You can keep splitting manually without an account.
          </p>

          {resolvingAuth && (
            <div className="flex items-center gap-3 text-slate-500" role="status" aria-live="polite">
              <svg className="animate-spin w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="text-sm font-medium">Signing you in…</span>
            </div>
          )}

          {/* Kept mounted (hidden while resolving or errored) so GIS can render
              into it as soon as it's ready. Hidden when we know no button can
              render. */}
          <div ref={signInButtonRef} className={resolvingAuth || signInError ? 'hidden' : ''} />

          {/* Fallback so the gate is never a dead logo when sign-in can't load. */}
          {signInError && !resolvingAuth && (
            <div className="w-full text-center" role="alert">
              <div className="flex items-start gap-3 text-left bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  {signInError === 'config' ? (
                    <p>Sign-in isn't configured for this deployment. Please contact the app owner.</p>
                  ) : (
                    <p>Couldn't reach Google Sign-In. Check your connection and try again.</p>
                  )}
                </div>
              </div>
              {signInError === 'unavailable' && (
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try again</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
