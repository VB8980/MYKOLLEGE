/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        night: '#0b0d12',
        panel: '#12151d',
        accent: '#f5c542',
        neon: '#38e1ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(56,225,255,0.25)',
        soft: '0 8px 32px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
