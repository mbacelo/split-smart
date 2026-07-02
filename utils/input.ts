import React from 'react';

// Blur a number input on wheel so scrolling the page can't silently change the
// value of a focused field (a common accidental edit on desktop/trackpad).
// Attach as onWheel to every <input type="number">.
export const blurOnWheel = (e: React.WheelEvent<HTMLInputElement>): void => {
  e.currentTarget.blur();
};
