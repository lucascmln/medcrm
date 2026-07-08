import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        // Innove Doctors brand — graphite / dark slate-blue (matches the favicon tile)
        brand: {
          50: "#f5f6f8",
          100: "#e7e9ed",
          200: "#cbd0d9",
          300: "#a4abbb",
          400: "#767e93",
          500: "#565d6f",
          600: "#454b5a",
          700: "#3a3f4b",
          800: "#2c303a",
          900: "#20232b",
          950: "#141619",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
