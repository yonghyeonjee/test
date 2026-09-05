import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:    "#17243B",   // 본문·구조
        paper:  "#F4F5F2",   // 배경
        rule:   "#D8DBD3",   // 괘선
        grant:  "#0E7A4D",   // 해당 가능 신호
        due:    "#A85B12",   // 마감 임박
        muted:  "#6B7280",
      },
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", "-apple-system",
               "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display": ["2.25rem", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
