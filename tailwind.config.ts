import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFDF9",
        foreground: "#1a1a2e",
        gold: {
          DEFAULT: "#C9A030",
          light: "#E8D48B",
          dark: "#A07D1C",
          50: "#FBF7E9",
        },
        navy: {
          DEFAULT: "#1a1a2e",
          light: "#2d2d4a",
          600: "#3a3a5c",
        },
        slate: {
          light: "#f1f5f9",
        },
        border: "#e2e0db",
        card: "#ffffff",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-cinzel)", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
