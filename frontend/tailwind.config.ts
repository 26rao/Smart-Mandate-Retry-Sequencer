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
        razorpay: {
          blue: "#0c2340",
          accent: "#0052cc",
          cyan: "#3395ff",
          dark: "#0b1426",
          card: "#121e36",
          border: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
