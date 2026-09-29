import React from 'react';

// Home-screen illustration: a small paper receipt whose lines already carry
// the colored person dots used on the splitting screen, so the idea (items →
// people) reads at a glance before any copy does. Purely decorative, so it's
// hidden from assistive tech; the headline and text below carry the meaning.
// Dot colors are safelisted person classes (see index.css).
const LINES: { name: string; price: string; dots: string[] }[] = [
  { name: 'Margherita', price: '14.50', dots: ['bg-blue-500'] },
  { name: 'Beer ×4', price: '24.00', dots: ['bg-blue-500', 'bg-green-500', 'bg-purple-500'] },
  { name: 'Tiramisu', price: '8.00', dots: ['bg-green-500', 'bg-purple-500'] },
];

// Torn-paper zigzag along the bottom edge.
const ZIGZAG_MASK = 'conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 10px 100%';

export const ReceiptHero: React.FC = () => {
  let dotIndex = 0;
  return (
    // drop-shadow on the wrapper, since the mask would clip a box-shadow.
    <div aria-hidden="true" className="-rotate-3 drop-shadow-[0_6px_14px_rgba(79,70,229,0.18)]">
      <div
        className="w-48 bg-white px-4 pt-3 pb-5 rounded-t-md font-mono text-[11px] leading-none text-slate-600"
        style={{ mask: ZIGZAG_MASK, WebkitMask: ZIGZAG_MASK }}
      >
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-200" />
        <ul className="space-y-2.5">
          {LINES.map((line) => (
            <li key={line.name} className="flex items-center gap-2">
              <span className="truncate">{line.name}</span>
              <span className="flex gap-0.5 shrink-0">
                {line.dots.map((dot) => (
                  <span
                    key={dot}
                    className={`receipt-dot w-2 h-2 rounded-full ${dot}`}
                    style={{ animationDelay: `${250 + dotIndex++ * 110}ms` }}
                  />
                ))}
              </span>
              <span className="ml-auto tabular-nums">{line.price}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300 flex justify-between font-bold text-slate-800">
          <span>Total</span>
          <span className="tabular-nums">46.50</span>
        </div>
      </div>
    </div>
  );
};
