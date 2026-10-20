/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Premium dark piano-app palette (Section 28) — deliberately not
        // Tailwind's default gray/slate so this doesn't read as a generic
        // admin dashboard.
        surface: {
          950: '#0a0b0f',
          900: '#111319',
          800: '#171a22',
          700: '#20242f',
          600: '#2b3040',
        },
        accent: {
          DEFAULT: '#7c5cff',
          soft: '#a78bfa',
        },
        key: {
          correct: '#3ddc97',
          wrong: '#ff5c72',
          early: '#ffb443',
          late: '#4fb0ff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
