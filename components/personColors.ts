// Static Tailwind classes for each person color.
//
// Why this exists: components build their look from `person.color` (a string like
// "blue"). Writing `bg-${color}-100` directly would be invisible to Tailwind's
// build-time purge and the class would be dropped. Listing the full class strings
// here (and in tailwind.config.js `safelist`) keeps them in the build and makes the
// exact classes greppable. Both lists are driven by the same palette in
// SettingsModal's COLOR_PALETTE — keep them in sync if you add a color.

export interface PersonColorClasses {
  ringSelected: string; // selected card ring
  borderSelected: string; // selected card border
  bgSubtle: string; // selected card background tint
  bgSoft: string; // avatar / icon background
  text: string; // avatar / icon text + label
  borderSoft: string; // avatar border
}

const COLOR_CLASSES: Record<string, PersonColorClasses> = {
  blue: { ringSelected: 'ring-blue-500', borderSelected: 'border-blue-500', bgSubtle: 'bg-blue-50', bgSoft: 'bg-blue-100', text: 'text-blue-600', borderSoft: 'border-blue-200' },
  green: { ringSelected: 'ring-green-500', borderSelected: 'border-green-500', bgSubtle: 'bg-green-50', bgSoft: 'bg-green-100', text: 'text-green-600', borderSoft: 'border-green-200' },
  purple: { ringSelected: 'ring-purple-500', borderSelected: 'border-purple-500', bgSubtle: 'bg-purple-50', bgSoft: 'bg-purple-100', text: 'text-purple-600', borderSoft: 'border-purple-200' },
  orange: { ringSelected: 'ring-orange-500', borderSelected: 'border-orange-500', bgSubtle: 'bg-orange-50', bgSoft: 'bg-orange-100', text: 'text-orange-600', borderSoft: 'border-orange-200' },
  pink: { ringSelected: 'ring-pink-500', borderSelected: 'border-pink-500', bgSubtle: 'bg-pink-50', bgSoft: 'bg-pink-100', text: 'text-pink-600', borderSoft: 'border-pink-200' },
  indigo: { ringSelected: 'ring-indigo-500', borderSelected: 'border-indigo-500', bgSubtle: 'bg-indigo-50', bgSoft: 'bg-indigo-100', text: 'text-indigo-600', borderSoft: 'border-indigo-200' },
  rose: { ringSelected: 'ring-rose-500', borderSelected: 'border-rose-500', bgSubtle: 'bg-rose-50', bgSoft: 'bg-rose-100', text: 'text-rose-600', borderSoft: 'border-rose-200' },
  amber: { ringSelected: 'ring-amber-500', borderSelected: 'border-amber-500', bgSubtle: 'bg-amber-50', bgSoft: 'bg-amber-100', text: 'text-amber-600', borderSoft: 'border-amber-200' },
  emerald: { ringSelected: 'ring-emerald-500', borderSelected: 'border-emerald-500', bgSubtle: 'bg-emerald-50', bgSoft: 'bg-emerald-100', text: 'text-emerald-600', borderSoft: 'border-emerald-200' },
  cyan: { ringSelected: 'ring-cyan-500', borderSelected: 'border-cyan-500', bgSubtle: 'bg-cyan-50', bgSoft: 'bg-cyan-100', text: 'text-cyan-600', borderSoft: 'border-cyan-200' },
};

const FALLBACK = COLOR_CLASSES.blue;

export const getColorClasses = (color: string): PersonColorClasses =>
  COLOR_CLASSES[color] ?? FALLBACK;
