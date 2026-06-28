import React from 'react';
import { ImageUploader } from './ImageUploader';

interface UploadStepProps {
  onImageSelected: (base64: string) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({ onImageSelected }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-4">
    <div className="text-center mb-10 max-w-lg">
      <h2 className="text-3xl font-bold text-slate-900 mb-4">Split bills in seconds</h2>
      <p className="text-slate-600 text-lg">
        Upload a photo of your receipt. Our AI will extract the items and help you split the costs with your friends.
      </p>
    </div>
    <ImageUploader onImageSelected={onImageSelected} />
  </div>
);
