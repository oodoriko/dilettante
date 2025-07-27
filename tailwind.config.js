/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50: "#EBF8FF", 500: "#0A84FF", 600: "#0066CC" },
        gray: { 50: "#FAFAFA", 100: "#F4F4F5", 900: "#18181B" },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "65ch",
            lineHeight: "1.6",
          },
        },
      },
    },
  },
  plugins: [],
};