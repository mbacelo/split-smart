import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// Full-screen receipt preview for cross-checking the AI's reading against the
// photo. Implements its own gesture-based zoom on the image so it works the
// same everywhere regardless of browser pinch-zoom behavior: pinch (two-finger)
// or mouse wheel to scale 1×–6×, drag to pan when zoomed, double-tap/double-click
// to toggle 1×↔2.5×. Tapping the (un-zoomed) backdrop closes it. The transform is
// applied imperatively to avoid re-rendering on every gesture frame.
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const ReceiptPreview: React.FC<{ image: string; onClose: () => void }> = ({ image, onClose }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  // Live gesture state held in a ref so pointer/touch handlers mutate it without
  // triggering React re-renders; `zoomed` is React state only so the cursor and
  // close-on-backdrop behavior can react to whether we're currently magnified.
  const [zoomed, setZoomed] = useState(false);
  const t = useRef({ scale: 1, x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);

  // Close on Escape, like the other overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    const el = imgRef.current;
    if (el) el.style.transform = `translate(${t.current.x}px, ${t.current.y}px) scale(${t.current.scale})`;
  };

  const setScale = (next: number) => {
    const s = clamp(next, MIN_SCALE, MAX_SCALE);
    t.current.scale = s;
    if (s === 1) { t.current.x = 0; t.current.y = 0; }
    apply();
    setZoomed((z) => (s > 1) !== z ? s > 1 : z);
  };

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      pinchStart.current = { dist: dist(pts[0], pts[1]), scale: t.current.scale };
      panStart.current = null;
    } else if (pts.length === 1 && t.current.scale > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: t.current.x, ty: t.current.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && pinchStart.current) {
      const ratio = dist(pts[0], pts[1]) / (pinchStart.current.dist || 1);
      setScale(pinchStart.current.scale * ratio);
    } else if (pts.length === 1 && panStart.current) {
      t.current.x = panStart.current.tx + (e.clientX - panStart.current.x);
      t.current.y = panStart.current.ty + (e.clientY - panStart.current.y);
      apply();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  // Double-tap / double-click toggles between fit and 2.5×.
  const onTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = e.timeStamp;
    if (now - lastTap.current < 300) {
      setScale(t.current.scale > 1 ? 1 : 2.5);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(t.current.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  };

  return (
    <div
      onClick={() => { if (!zoomed) onClose(); }}
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm overflow-hidden animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt photo"
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        title="Close"
        aria-label="Close receipt preview"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="w-full h-full flex items-center justify-center p-4 touch-none select-none overflow-hidden">
        <img
          ref={imgRef}
          src={image}
          alt="Receipt"
          draggable={false}
          onClick={onTap}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          title={zoomed ? 'Double-tap to fit' : 'Pinch or double-tap to zoom'}
          style={{ touchAction: 'none', transformOrigin: 'center center' }}
          className={`max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl will-change-transform ${
            zoomed ? 'cursor-grab' : 'cursor-zoom-in'
          }`}
        />
      </div>
    </div>
  );
};
