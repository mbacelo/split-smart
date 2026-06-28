import React, { useRef, useState } from 'react';
import { CameraIcon, UploadIcon, ReceiptIcon } from './Icons';

interface ImageUploaderProps {
  onImageSelected: (base64: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected }) => {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file);
    // Clear the input so the same file can be selected again if needed
    event.target.value = '';
  };

  const processFile = (file: File | undefined) => {
    if (!file) return;
    
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

    // Check if image
    if (!file.type.startsWith('image/') && !isHeic) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      let base64 = reader.result as string;

      // Fix mime type for HEIC if browser didn't detect it properly
      if (isHeic && !base64.startsWith('data:image/heic') && !base64.startsWith('data:image/heif')) {
          const parts = base64.split(',');
          const data = parts.length > 1 ? parts[1] : parts[0];
          base64 = `data:image/heic;base64,${data}`;
      }

      onImageSelected(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div 
      className={`w-full max-w-xl mx-auto border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 relative
        ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-300 bg-white shadow-sm hover:border-indigo-400 hover:shadow-md'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden inputs */}
      <input 
        type="file" 
        ref={galleryInputRef} 
        onChange={handleFileChange} 
        accept="image/*,.heic,.heif" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
      />
      
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="flex flex-col items-center">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-4 border border-indigo-100">
            <ReceiptIcon className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Add a Receipt</h3>
          <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm sm:text-base leading-relaxed">
            Snap a photo or upload an image. Our AI will handle the math for you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md pt-2">
          <button 
            onClick={() => cameraInputRef.current?.click()}
            className="group flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all active:scale-95 shadow-lg shadow-indigo-100"
          >
            <CameraIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
            <span>Take Photo</span>
          </button>
          
          <button 
            onClick={() => galleryInputRef.current?.click()}
            className="group flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 font-bold py-4 px-6 rounded-2xl transition-all active:scale-95"
          >
            <UploadIcon className="w-6 h-6 transition-transform group-hover:-translate-y-1" />
            <span>Gallery</span>
          </button>
        </div>

        <div className="hidden sm:block pt-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            — or drag & drop —
          </p>
        </div>

        <div className="text-[11px] font-medium text-slate-400 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-100 inline-block">
          JPEG, PNG, WEBP, HEIC
        </div>
      </div>
    </div>
  );
};