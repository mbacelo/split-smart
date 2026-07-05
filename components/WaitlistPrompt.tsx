import React, { useEffect, useState } from 'react';
import { Hourglass, Check, AlertCircle, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { joinWaitlist } from '../services/waitlist';
import { trackEvent } from '../services/analytics';

interface WaitlistPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

// Shown when a signed-in user tries an AI scan but isn't on the allowlist
// (the server answered 403 not_allowlisted). Offers to record their interest
// server-side so the owner can approve them later.
export const WaitlistPrompt: React.FC<WaitlistPromptProps> = ({ isOpen, onClose }) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [phase, setPhase] = useState<'idle' | 'joining' | 'joined' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fresh state on every open — a previous visit's success/error shouldn't leak.
  useEffect(() => {
    if (isOpen) { setPhase('idle'); setErrorMessage(null); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleJoin = async () => {
    setPhase('joining');
    setErrorMessage(null);
    try {
      const status = await joinWaitlist();
      trackEvent('waitlist-joined', { status });
      setPhase('joined');
    } catch (err: any) {
      trackEvent('waitlist-join-failed', { reason: err?.message || 'unknown' });
      setErrorMessage(err?.message || 'Something went wrong. Please try again.');
      setPhase('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Join the waitlist"
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
          {phase === 'joined' ? (
            <>
              <div className="bg-green-100 p-3 rounded-2xl text-green-600 mb-5">
                <Check className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">You're on the list!</h2>
              <p className="text-slate-600 text-sm mb-6">
                Your request has been recorded. Once your account is enabled, AI scanning will
                just work — no need to sign up again.
              </p>
              <button
                onClick={onClose}
                className="bg-indigo-600 text-white font-semibold py-2.5 px-6 rounded-xl hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
              >
                Got it
              </button>
            </>
          ) : (
            <>
              <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 mb-5">
                <Hourglass className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">AI scanning is invite-only</h2>
              <p className="text-slate-600 text-sm mb-6">
                Your account doesn't have access to receipt scanning yet. Join the waitlist and
                we'll enable it for you — meanwhile, you can still enter items manually.
              </p>

              {phase === 'error' && errorMessage && (
                <div className="w-full flex items-start gap-2.5 text-left bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-sm">{errorMessage}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  Maybe later
                </button>
                <button
                  onClick={() => void handleJoin()}
                  disabled={phase === 'joining'}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                >
                  {phase === 'joining' && (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                  <span>Join the waitlist</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
