/** @type {import('tailwindcss').Config} */

// The person palette. Cards/avatars build classes from `person.color` at runtime
// (see components/personColors.ts), so Tailwind's purge step can't see them in the
// markup. We safelist exactly the classes those colors produce.
const PERSON_COLORS = [
  'blue', 'green', 'purple', 'orange', 'pink',
  'indigo', 'rose', 'amber', 'emerald', 'cyan',
];

const safelist = PERSON_COLORS.flatMap((c) => [
  `ring-${c}-500`,
  `border-${c}-500`,
  `border-${c}-200`,
  `bg-${c}-50`,
  `bg-${c}-100`,
  `text-${c}-600`,
]);

export default {
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.{ts,tsx}'],
  safelist,
  theme: {
    extend: {},
  },
  plugins: [],
};
