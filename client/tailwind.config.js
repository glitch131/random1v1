/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // The storm: deep indigo base layers
        storm: {
          950: '#120C2B',
          900: '#1C1442',
          800: '#2A1F5C',
          700: '#3A2C78',
          600: '#4E3E9A',
        },
        haze: '#B8AEE0', // muted text
        ice: '#F4F1FF', // primary text
        shield: '#35C9FF', // you
        rival: '#FF5C8A', // opponent
        loot: '#FFC23D', // legendary gold: primary actions, wins
        alert: '#FF6B5B', // errors
      },
      fontFamily: {
        display: ['var(--font-display)', 'Arial Narrow', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        storm: {
          '0%': { transform: 'scale(1.6)', opacity: '0' },
          '25%': { opacity: '0.9' },
          '100%': { transform: 'scale(0.3)', opacity: '0' },
        },
        pop: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        storm: 'storm 2.7s cubic-bezier(.45,0,.2,1) infinite',
        pop: 'pop 160ms ease-out',
      },
    },
  },
  plugins: [],
};
