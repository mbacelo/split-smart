import React from 'react';
import { ImageUploader } from './ImageUploader';
import { Plus } from 'lucide-react';

interface UploadStepProps {
  onImageSelected: (base64: string) => void;
  onManualEntry: () => void;
  onError: (message: string) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({ onImageSelected, onManualEntry, onError }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-4">
    <div className="text-center mb-10 max-w-lg">
      <h2 className="text-3xl font-bold text-slate-900 mb-4">Split bills in seconds</h2>
      <p className="text-slate-600 text-lg">
        Upload a photo of your receipt. Our AI will extract the items and help you split the costs with your friends.
      </p>
    </div>
    <ImageUploader onImageSelected={onImageSelected} onError={onError} />

    {/* Escape hatch for when there's no receipt to scan (cash, a verbal tab, a
        bill someone read out). Kept visually secondary so the photo flow stays
        the hero. */}
    <button
      onClick={onManualEntry}
      className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span>No receipt? Enter items manually</span>
    </button>
  </div>
);
