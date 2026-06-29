// Static Tailwind classes for each person color.
//
// Why this exists: components build their look from `person.color` (a string like
// "blue"). Writing `bg-${color}-100` directly would be invisible to Tailwind's
// build-time purge and the class would be dropped. Listing the full class strings
// here (and in tailwind.config.js `safelist`) keeps them in the build and makes the
// exact classes greppable. Both lists are driven by the same palette in
// COLOR_PALETTE below — keep them in sync if you add a color.

import { Person } from '../types';

// The colors assigned to people, in the order they're handed out. Adding people
// past the end of this list cycles back to the start.
export const COLOR_PALETTE = ['blue', 'green', 'purple', 'orange', 'pink', 'indigo', 'rose', 'amber', 'emerald', 'cyan'];

export interface PersonColorClasses {
  ringSelected: string; // selected card ring
  borderSelected: string; // selected card border
  bgSubtle: string; // selected card background tint (bg-X-50)
  bgSoft: string; // avatar / icon background (bg-X-100)
  text: string; // avatar / icon text + label (text-X-600)
  borderSoft: string; // avatar border (border-X-200)
  bgSolid: string; // filled avatar / checkbox (bg-X-500)
  bgSolidMuted: string; // inactive filled avatar (bg-X-400)
  bgSolidStrong: string; // active avatar / badge (bg-X-600)
  borderStrong: string; // active avatar border (border-X-600)
  textStrong: string; // assigned item label (text-X-900)
}

const COLOR_CLASSES: Record<string, PersonColorClasses> = {
  blue: { ringSelected: 'ring-blue-500', borderSelected: 'border-blue-500', bgSubtle: 'bg-blue-50', bgSoft: 'bg-blue-100', text: 'text-blue-600', borderSoft: 'border-blue-200', bgSolid: 'bg-blue-500', bgSolidMuted: 'bg-blue-400', bgSolidStrong: 'bg-blue-600', borderStrong: 'border-blue-600', textStrong: 'text-blue-900' },
  green: { ringSelected: 'ring-green-500', borderSelected: 'border-green-500', bgSubtle: 'bg-green-50', bgSoft: 'bg-green-100', text: 'text-green-600', borderSoft: 'border-green-200', bgSolid: 'bg-green-500', bgSolidMuted: 'bg-green-400', bgSolidStrong: 'bg-green-600', borderStrong: 'border-green-600', textStrong: 'text-green-900' },
  purple: { ringSelected: 'ring-purple-500', borderSelected: 'border-purple-500', bgSubtle: 'bg-purple-50', bgSoft: 'bg-purple-100', text: 'text-purple-600', borderSoft: 'border-purple-200', bgSolid: 'bg-purple-500', bgSolidMuted: 'bg-purple-400', bgSolidStrong: 'bg-purple-600', borderStrong: 'border-purple-600', textStrong: 'text-purple-900' },
  orange: { ringSelected: 'ring-orange-500', borderSelected: 'border-orange-500', bgSubtle: 'bg-orange-50', bgSoft: 'bg-orange-100', text: 'text-orange-600', borderSoft: 'border-orange-200', bgSolid: 'bg-orange-500', bgSolidMuted: 'bg-orange-400', bgSolidStrong: 'bg-orange-600', borderStrong: 'border-orange-600', textStrong: 'text-orange-900' },
  pink: { ringSelected: 'ring-pink-500', borderSelected: 'border-pink-500', bgSubtle: 'bg-pink-50', bgSoft: 'bg-pink-100', text: 'text-pink-600', borderSoft: 'border-pink-200', bgSolid: 'bg-pink-500', bgSolidMuted: 'bg-pink-400', bgSolidStrong: 'bg-pink-600', borderStrong: 'border-pink-600', textStrong: 'text-pink-900' },
  indigo: { ringSelected: 'ring-indigo-500', borderSelected: 'border-indigo-500', bgSubtle: 'bg-indigo-50', bgSoft: 'bg-indigo-100', text: 'text-indigo-600', borderSoft: 'border-indigo-200', bgSolid: 'bg-indigo-500', bgSolidMuted: 'bg-indigo-400', bgSolidStrong: 'bg-indigo-600', borderStrong: 'border-indigo-600', textStrong: 'text-indigo-900' },
  rose: { ringSelected: 'ring-rose-500', borderSelected: 'border-rose-500', bgSubtle: 'bg-rose-50', bgSoft: 'bg-rose-100', text: 'text-rose-600', borderSoft: 'border-rose-200', bgSolid: 'bg-rose-500', bgSolidMuted: 'bg-rose-400', bgSolidStrong: 'bg-rose-600', borderStrong: 'border-rose-600', textStrong: 'text-rose-900' },
  amber: { ringSelected: 'ring-amber-500', borderSelected: 'border-amber-500', bgSubtle: 'bg-amber-50', bgSoft: 'bg-amber-100', text: 'text-amber-600', borderSoft: 'border-amber-200', bgSolid: 'bg-amber-500', bgSolidMuted: 'bg-amber-400', bgSolidStrong: 'bg-amber-600', borderStrong: 'border-amber-600', textStrong: 'text-amber-900' },
  emerald: { ringSelected: 'ring-emerald-500', borderSelected: 'border-emerald-500', bgSubtle: 'bg-emerald-50', bgSoft: 'bg-emerald-100', text: 'text-emerald-600', borderSoft: 'border-emerald-200', bgSolid: 'bg-emerald-500', bgSolidMuted: 'bg-emerald-400', bgSolidStrong: 'bg-emerald-600', borderStrong: 'border-emerald-600', textStrong: 'text-emerald-900' },
  cyan: { ringSelected: 'ring-cyan-500', borderSelected: 'border-cyan-500', bgSubtle: 'bg-cyan-50', bgSoft: 'bg-cyan-100', text: 'text-cyan-600', borderSoft: 'border-cyan-200', bgSolid: 'bg-cyan-500', bgSolidMuted: 'bg-cyan-400', bgSolidStrong: 'bg-cyan-600', borderStrong: 'border-cyan-600', textStrong: 'text-cyan-900' },
};

const FALLBACK = COLOR_CLASSES.blue;

export const getColorClasses = (color: string): PersonColorClasses =>
  COLOR_CLASSES[color] ?? FALLBACK;

// Pick a color for a new person: the first palette color not already in use,
// falling back to cycling the palette once every color is taken.
export const nextPersonColor = (existing: Person[]): string => {
  const used = existing.map(p => p.color);
  const available = COLOR_PALETTE.filter(c => !used.includes(c));
  return available.length > 0 ? available[0] : COLOR_PALETTE[existing.length % COLOR_PALETTE.length];
};

// A fresh `Person #N` name, one past the highest existing default-style number
// (falling back to the list length). Used both for quick-add and to backfill a
// name the user cleared while editing.
export const defaultPersonName = (existing: Person[]): string => {
  const highest = existing.reduce((max, p) => {
    const match = /^Person #(\d+)$/.exec(p.name.trim());
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `Person #${Math.max(highest + 1, existing.length + 1)}`;
};

// Build a new person with a unique id and an unused color. `name` defaults to a
// `defaultPersonName` so a freshly-added participant is immediately usable;
// callers can pass an explicit name (or '' to force the user to type one).
export const createPerson = (existing: Person[], name?: string): Person =>
  ({ id: `p${Date.now()}`, name: name ?? defaultPersonName(existing), color: nextPersonColor(existing) });
