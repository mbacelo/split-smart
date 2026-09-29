import React from 'react';
import { ImageUploader } from './ImageUploader';
import { ReceiptHero } from './ReceiptHero';
import { PenLine } from 'lucide-react';

interface UploadStepProps {
  onImageSelected: (base64: string) => void;
  onManualEntry: () => void;
  onError: (message: string) => void;
  // Hides the sign-in heads-up once it no longer applies.
  signedIn: boolean;
}

// One narrow centered column that must fit a small phone's visible area
// without scrolling (360×~640 once browser chrome is subtracted), so the
// manual-entry option is never below the fold. Receipt illustration → what
// the app does → how to start → the no-receipt alternative.
export const UploadStep: React.FC<UploadStepProps> = ({ onImageSelected, onManualEntry, onError, signedIn }) => (
  // Mobile height is the visible viewport minus the sticky header (4rem + its
  // 1px border), so the column centers without a stray scroll.
  <div className="min-h-[calc(100svh-4rem-1px)] sm:min-h-[60vh] flex items-center justify-center px-6 py-6 sm:py-2 animate-fade-in">
    <div className="w-full max-w-[20rem] sm:max-w-sm flex flex-col items-center text-center">
      {/* On very short screens the illustration gives way to the actions. */}
      <div className="[@media(max-height:600px)]:hidden mb-7">
        <ReceiptHero />
      </div>

      <h2 className="text-[1.75rem] leading-tight font-bold tracking-tight text-slate-900 sm:text-3xl">
        Split bills in seconds
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600 text-balance sm:text-base">
        Snap the receipt and AI lists every item. Tap who had what, and tax and tip are split for you.
      </p>

      <div className="mt-6 w-full">
        <ImageUploader onImageSelected={onImageSelected} onError={onError} />
        {/* Heads-up so the sign-in gate isn't a surprise: only the AI scan
            needs an account; manual entry doesn't. */}
        {!signedIn && (
          <p className="mt-2.5 text-xs text-slate-500">Scanning uses AI and needs a Google sign-in.</p>
        )}
      </div>

      {/* Escape hatch for when there's no receipt to scan (cash, a verbal tab,
          a bill someone read out). Secondary to the photo flow, but a real,
          full-size tap target rather than fine print. */}
      <button
        onClick={onManualEntry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
      >
        <PenLine className="w-4 h-4" />
        No receipt? Enter items by hand
      </button>
    </div>
  </div>
);
