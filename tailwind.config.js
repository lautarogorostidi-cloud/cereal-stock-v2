/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        display: ['var(--font-display)', 'serif'],
      },
      colors: {
        campo: {
          50:  '#f5f7f0',
          100: '#e8edd8',
          200: '#d0dab2',
          300: '#b0c280',
          400: '#8fa854',
          500: '#718c36',
          600: '#587029',
          700: '#445722',
          800: '#38461e',
          900: '#2f3b1c',
          950: '#17200b',
        },
        tierra: {
          50:  '#fdf8f0',
          100: '#faeedd',
          200: '#f3d9b5',
          300: '#eabf82',
          400: '#e09d4d',
          500: '#d8832a',
          600: '#c96a1f',
          700: '#a7511b',
          800: '#86411c',
          900: '#6c3719',
          950: '#3a1b0b',
        },
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
