import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#070b14',
        foreground: '#eef6ff',
        border: 'rgba(148, 163, 184, 0.2)',
        primary: '#22d3ee',
        accent: '#a78bfa',
        muted: '#93a4b8'
      },
      boxShadow: {
        glow: '0 0 60px rgba(34, 211, 238, 0.18)'
      }
    }
  },
  plugins: []
};

export default config;
