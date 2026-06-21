import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f5f7f8",
        surface: "#ffffff",
        "surface-2": "#f0f2f5",
        border: "#e8eaed",
        "border-strong": "#c5c9d0",
        text: "#1a1a1a",
        "text-muted": "#777777",
        "text-dim": "#aaaaaa",
        accent: "#5BC5A7",
        "accent-hover": "#4aad93",
        positive: "#5BC5A7",
        negative: "#FF652F",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.08)",
        card: "0 1px 3px rgba(0,0,0,0.07)",
      },
    },
  },
  plugins: [],
} satisfies Config;
