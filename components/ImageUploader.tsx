import React, { useRef, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { downscaleImage } from '../utils/image';

interface ImageUploaderProps {
  onImageSelected: (base64: string) => void;
  // Surface a user-facing error (bad file type, unreadable image) as an in-app
  // toast instead of a browser alert().
  onError: (message: string) => void;
}

// Read a File into a data URL, repairing the HEIC mime type when the browser
// failed to detect it (needed only for the fall-through where downscaling
// can't decode the image and we send the original).
const readFile = (file: File, isHeic: boolean): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      let base64 = reader.result as string;
      if (isHeic && !base64.startsWith('data:image/heic') && !base64.startsWith('data:image/heif')) {
        const parts = base64.split(',');
        const data = parts.length > 1 ? parts[1] : parts[0];
        base64 = `data:image/heic;base64,${data}`;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, onError }) => {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processFile(file);
    // Clear the input so the same file can be selected again if needed
    event.target.value = '';
  };

  const processFile = async (file: File | undefined) => {
    if (!file || isProcessing) return;

    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

    // Check if image
    if (!file.type.startsWith('image/') && !isHeic) {
      onError('Please upload an image file.');
      return;
    }

    setIsProcessing(true);
    try {
      const base64 = await readFile(file, isHeic);
      // Shrink + normalize to JPEG before upload (no-op if the browser can't
      // decode it — e.g. HEIC on Chrome — in which case the original is sent).
      const optimized = await downscaleImage(base64);
      onImageSelected(optimized);
    } catch {
      onError('Could not read that image. Please try another photo.');
    } finally {
      setIsProcessing(false);
    }
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

  // Phones: two stacked buttons, no frame. From `sm` up the same buttons sit
  // inside a dashed drop zone, since drag & drop only exists on desktop.
  return (
    <div
      className={`relative w-full transition-colors duration-200 sm:border-2 sm:border-dashed sm:rounded-3xl sm:p-6
        ${isDragging ? 'sm:border-indigo-500 sm:bg-indigo-50' : 'sm:border-slate-300 sm:bg-white sm:hover:border-indigo-400'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Processing overlay while we read + downscale the chosen image */}
      {isProcessing && (
        <div className="absolute -inset-1 z-10 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-sm rounded-3xl animate-fade-in">
          <svg className="animate-spin w-7 h-7 text-indigo-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm font-semibold text-slate-600">Preparing image…</span>
        </div>
      )}

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

      <div className="flex flex-col gap-2.5">
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 px-5 rounded-2xl shadow-lg shadow-indigo-200 transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60 disabled:pointer-events-none"
        >
          <Camera className="w-5 h-5 shrink-0" />
          <span>Take photo</span>
        </button>
        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2.5 bg-white border border-slate-300 hover:border-indigo-400 hover:text-indigo-600 text-slate-700 font-semibold py-3.5 px-5 rounded-2xl transition-colors active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60 disabled:pointer-events-none"
        >
          <Upload className="w-5 h-5 shrink-0" />
          <span>Upload from gallery</span>
        </button>
      </div>

      <p className="hidden sm:block mt-3 text-sm text-slate-400">or drop a receipt photo here</p>
    </div>
  );
};
