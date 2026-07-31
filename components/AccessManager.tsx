import React, { useEffect, useState } from 'react';
import { AlertCircle, Ban, Check, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { ConfirmDialog } from './ConfirmDialog';
import { AccessRequest, grantAccess, setAccessStatus } from '../services/adminAccess';
import { trackEvent } from '../services/analytics';

interface AccessManagerProps {
  isOpen: boolean;
  onClose: () => void;
  requests: AccessRequest[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Replaces one row after a mutation, so the list updates without a refetch. */
  onApplyLocal: (updated: AccessRequest) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Class strings are written out in full (never interpolated) so Tailwind's
// scanner sees them — same reason as components/personColors.ts.
const STATUS_STYLES: Record<AccessRequest['status'], { pill: string; label: string }> = {
  waitlisted: { pill: 'bg-amber-100 text-amber-700', label: 'Waitlisted' },
  allowed: { pill: 'bg-green-100 text-green-700', label: 'Allowed' },
  rejected: { pill: 'bg-slate-200 text-slate-600', label: 'Rejected' },
};

const BUTTON_BASE =
  'inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-60 disabled:pointer-events-none';

const ACTION_BUTTON = {
  approve: `${BUTTON_BASE} text-indigo-600 hover:bg-indigo-50`,
  reject: `${BUTTON_BASE} text-slate-500 hover:bg-slate-100`,
  revoke: `${BUTTON_BASE} text-red-600 hover:bg-red-50`,
};

// Admin-only: approve or revoke AI-scan access, or grant it to an email
// directly. Replaces hand-editing the access_requests table in SQL. Only
// rendered when the server confirmed the user is an admin (see useAdmin), and
// every action here is re-authorized server-side regardless.
export const AccessManager: React.FC<AccessManagerProps> = ({
  isOpen,
  onClose,
  requests,
  loading,
  error,
  onRefresh,
  onApplyLocal,
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [newEmail, setNewEmail] = useState('');
  const [granting, setGranting] = useState(false);
  // The email of the row with an action in flight — only that row spins.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Taking access away — revoking or rejecting — goes through a confirmation.
  // Approving never does; it's the easily-undone direction.
  const [confirmTarget, setConfirmTarget] = useState<
    { request: AccessRequest; action: 'revoke' | 'reject' } | null
  >(null);

  // Fresh state on every open — a previous visit's error shouldn't leak.
  useEffect(() => {
    if (isOpen) { setNewEmail(''); setActionError(null); setConfirmTarget(null); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Let the confirmation handle its own Escape first.
      if (e.key === 'Escape' && !confirmTarget) { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, confirmTarget]);

  if (!isOpen) return null;

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setActionError('Enter a valid email address.');
      return;
    }
    setGranting(true);
    setActionError(null);
    try {
      onApplyLocal(await grantAccess(email));
      trackEvent('access-granted', { source: 'direct' });
      setNewEmail('');
    } catch (err: any) {
      trackEvent('access-grant-failed', { reason: err?.message || 'unknown' });
      setActionError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setGranting(false);
    }
  };

  const applyStatus = async (request: AccessRequest, status: AccessRequest['status']) => {
    setPendingEmail(request.email);
    setActionError(null);
    try {
      const updated = await setAccessStatus(request.email, status);
      onApplyLocal(updated);
      trackEvent(
        status === 'allowed' ? 'access-granted' : status === 'rejected' ? 'access-rejected' : 'access-revoked',
        // Approving a rejected person is an undo, worth telling apart from a
        // first-time approval when reading the funnel.
        { source: 'list', from: request.status },
      );
    } catch (err: any) {
      trackEvent('access-grant-failed', { reason: err?.message || 'unknown' });
      setActionError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setPendingEmail(null);
    }
  };

  const spinner = (
    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Manage access"
      >
        <div
          ref={dialogRef}
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 p-5 border-b border-slate-100">
            <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900">Manage access</h2>
              <p className="text-sm text-slate-500">Choose who can scan receipts with AI.</p>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              aria-label="Refresh list"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleGrant} className="p-5 border-b border-slate-100 flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="person@example.com"
              aria-label="Email to grant access to"
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
            />
            <button
              type="submit"
              disabled={granting || !newEmail.trim()}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-xl text-sm hover:bg-indigo-700 transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:pointer-events-none shrink-0"
            >
              {granting ? spinner : <UserPlus className="w-4 h-4" />}
              <span>Grant</span>
            </button>
          </form>

          {(actionError || error) && (
            <div className="mx-5 mt-4 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-sm">{actionError || error}</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 pt-4">
            {requests.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                {loading ? 'Loading…' : 'No access requests yet. Grant access by email above.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {requests.map((request) => {
                  const busy = pendingEmail === request.email;
                  const { pill, label } = STATUS_STYLES[request.status];
                  return (
                    // Stacked on mobile: an email is long and identifies the
                    // person, so it wraps in full rather than fighting the pill
                    // and buttons for width on one line.
                    <li
                      key={request.email}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="min-w-0 sm:flex-1">
                        <p className="text-sm font-semibold text-slate-800 break-words">
                          {request.name || request.email}
                        </p>
                        {request.name && (
                          <p className="text-xs text-slate-500 break-all">{request.email}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${pill}`}>
                          {label}
                        </span>
                        <div className="flex items-center gap-1">
                          {/* Approve: for a pending request, or to undo a rejection. */}
                          {request.status !== 'allowed' && (
                            <button
                              onClick={() => void applyStatus(request, 'allowed')}
                              disabled={busy}
                              className={ACTION_BUTTON.approve}
                            >
                              {busy ? spinner : <Check className="w-3.5 h-3.5" />}
                              <span>Approve</span>
                            </button>
                          )}
                          {/* Reject a pending request: takes them out of the
                              queue for good, undoable via Approve. */}
                          {request.status === 'waitlisted' && (
                            <button
                              onClick={() => setConfirmTarget({ request, action: 'reject' })}
                              disabled={busy}
                              className={ACTION_BUTTON.reject}
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          )}
                          {request.status === 'allowed' && (
                            <button
                              onClick={() => setConfirmTarget({ request, action: 'revoke' })}
                              disabled={busy}
                              className={ACTION_BUTTON.revoke}
                            >
                              {busy ? spinner : <X className="w-3.5 h-3.5" />}
                              <span>Revoke</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title={confirmTarget?.action === 'reject' ? 'Reject request?' : 'Revoke access?'}
        message={
          confirmTarget
            ? `${confirmTarget.request.name || confirmTarget.request.email} ${
                confirmTarget.action === 'reject'
                  ? "won't get access to AI scanning. They'll drop off the pending list — you can still approve them later if you change your mind."
                  : "will no longer be able to scan receipts with AI. They'll go back to the waitlist, so you can approve them again later."
              }`
            : ''
        }
        confirmLabel={confirmTarget?.action === 'reject' ? 'Reject' : 'Revoke'}
        variant="danger"
        icon={confirmTarget?.action === 'reject' ? <Ban className="w-5 h-5" /> : <X className="w-5 h-5" />}
        onConfirm={() => {
          const target = confirmTarget;
          setConfirmTarget(null);
          if (target) void applyStatus(target.request, target.action === 'reject' ? 'rejected' : 'waitlisted');
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
};
