/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cool: {
          50: '#eff9ff', 100: '#dcf1ff', 200: '#b2e4ff', 300: '#6dcfff',
          400: '#20b6fb', 500: '#059ceb', 600: '#007cc8', 700: '#0163a2',
          800: '#065386', 900: '#0b456f',
        },
      },
    },
  },
  plugins: [],
}
