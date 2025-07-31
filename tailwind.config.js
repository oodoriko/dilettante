/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Muted blue palette for calming design
        primary: { 
          50: "#f0f9ff", 
          100: "#e0f2fe", 
          200: "#bae6fd", 
          300: "#7dd3fc", 
          400: "#38bdf8", 
          500: "#3b82f6", 
          600: "#2563eb", 
          700: "#1d4ed8", 
          800: "#1e40af", 
          900: "#1e3a8a" 
        },
        // Soft grey palette with blue undertones
        gray: { 
          50: "#f8fafc", 
          100: "#f1f5f9", 
          200: "#e2e8f0", 
          300: "#cbd5e1", 
          400: "#94a3b8", 
          500: "#64748b", 
          600: "#475569", 
          700: "#334155", 
          800: "#1e293b", 
          900: "#0f172a" 
        },
        // Additional blue variants for tags and accents
        blue: {
          50: "#eff6ff",
          100: "#dbeafe", 
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a"
        }
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