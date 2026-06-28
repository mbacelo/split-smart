import React from 'react';
import { ReceiptIcon } from './Icons';

export const AnalyzingStep: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-pulse p-4">
    <div className="relative w-24 h-24">
      <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
      <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
        <ReceiptIcon className="w-8 h-8" />
      </div>
    </div>
    <div className="text-center">
      <h3 className="text-xl font-semibold text-slate-800">Analyzing Receipt...</h3>
      <p className="text-slate-500 mt-2">Identifying items, prices, and totals.</p>
    </div>
  </div>
);
