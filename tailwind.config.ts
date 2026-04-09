import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--fg)",
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
          light: "var(--slate-light)",
        },
        border: "var(--border)",
        card: "var(--card)",
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
