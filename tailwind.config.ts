import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // GrowEasy brand green (logo / accents / progress / status)
        brand: {
          50: "#eefdf3",
          100: "#d6f9e2",
          200: "#aff1c8",
          300: "#79e4a7",
          400: "#3fce80",
          500: "#18b364",
          600: "#0c9151",
          700: "#0b7343",
          800: "#0d5b39",
          900: "#0c4a30",
        },
        // GrowEasy primary-CTA orange (the "Upload File" button)
        accent: {
          50: "#fff5ed",
          100: "#ffe9d5",
          200: "#fed0aa",
          300: "#fdb174",
          400: "#fb9038",
          500: "#f97316",
          600: "#ea6407",
          700: "#c24d09",
          800: "#9a3e10",
          900: "#7c3510",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
