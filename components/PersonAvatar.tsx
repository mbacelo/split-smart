import React from 'react';

interface PersonAvatarProps {
  // The person's photo data URL, if any. When present it fills the circle; when
  // absent, `children` (the colored initial or icon) render instead.
  photo?: string;
  // The circle itself — size, color background, border, ring, etc. The caller
  // owns these so each render site keeps its existing look. Must include the
  // sizing + `rounded-full` and any `flex items-center justify-center`.
  className?: string;
  // Fallback content shown when there's no photo (an initial letter or icon).
  children?: React.ReactNode;
  // Forwarded to the wrapper (e.g. title tooltip, inline styles for overlays).
  title?: string;
  style?: React.CSSProperties;
  // Extra content layered on top of the avatar regardless of photo (e.g. the
  // active-selection checkmark badge). Rendered after the photo/fallback.
  overlay?: React.ReactNode;
}

// A person's avatar circle: shows their contact photo when available, otherwise
// falls back to whatever the caller passes as children (colored initial / icon).
// The photo is drawn with object-cover so it fills the circle without distortion.
export const PersonAvatar: React.FC<PersonAvatarProps> = ({ photo, className = '', children, title, style, overlay }) => (
  <div className={`relative overflow-hidden ${className}`} title={title} style={style}>
    {photo ? (
      <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
    ) : (
      children
    )}
    {overlay}
  </div>
);
