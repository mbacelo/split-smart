import React, { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styles the confirm action red (for destructive actions). */
  variant?: 'default' | 'danger';
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

// A lightweight in-app confirmation, styled to match SettingsModal's reset-confirm
// panel — used in place of the browser's native window.confirm().
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  icon,
  onConfirm,
  onCancel,
}) => {
  // Escape cancels; Enter confirms — standard dialog affordances.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  const confirmClasses =
    variant === 'danger'
      ? 'text-white bg-red-500 hover:bg-red-600'
      : 'text-white bg-indigo-600 hover:bg-indigo-700';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 flex items-start gap-4">
            <div className="p-2 bg-white rounded-full border border-slate-200 text-slate-500 shrink-0 shadow-sm">
              {icon ?? <RotateCcw className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">{message}</p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              autoFocus
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 ${confirmClasses}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
