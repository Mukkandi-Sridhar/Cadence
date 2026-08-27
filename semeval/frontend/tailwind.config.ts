/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      colors: {
        // Primary brand — a deep navy, drawn from the RGMCET crest's gear
        brand: {
          50:  '#eef2f9',
          100: '#dce6f2',
          200: '#b9cce6',
          300: '#8babd4',
          400: '#5c86bd',
          500: '#3a67a3',
          600: '#254f85',
          700: '#1c3d68',
          800: '#16304f',
          900: '#12253d',
          950: '#0b1626',
        },
        // Accent gold — drawn from the crest's shield gradient
        gold: {
          400: '#f0b429',
          500: '#dc9a1f',
          600: '#b87e15',
        },
        // Surface palette — light, cream-toned UI
        surface: {
          50:  '#fffdf8',
          100: '#fbf7ec',
          200: '#e8e1cc',
          900: '#ffffff',
          950: '#faf5e7',
        },
        // Warm near-black for text — replaces literal white/black utilities
        ink: '#1a1815',
        // Semantic colours
        success: '#16803c',
        warning: '#b45309',
        danger:  '#b91c1c',
        info:    '#0369a1',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
