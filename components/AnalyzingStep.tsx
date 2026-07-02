import React from 'react';
import { Receipt, X } from 'lucide-react';

// The analysis can take a while (the serverless call runs up to 30s), so offer
// a way out: Cancel aborts the in-flight request and returns to the upload step.
export const AnalyzingStep: React.FC<{ onCancel: () => void }> = ({ onCancel }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 p-4">
    <div className="relative w-24 h-24 animate-pulse">
      <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
      <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
        <Receipt className="w-8 h-8" />
      </div>
    </div>
    <div className="text-center animate-pulse">
      <h3 className="text-xl font-semibold text-slate-800">Analyzing Receipt...</h3>
      <p className="text-slate-500 mt-2">Identifying items, prices, and totals.</p>
    </div>
    <button
      onClick={onCancel}
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors"
    >
      <X className="w-4 h-4" />
      <span>Cancel</span>
    </button>
  </div>
);
