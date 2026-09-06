import type { Config } from "tailwindcss";

/**
 * 지원찾기 고유 팔레트.
 *
 * Datacenter(삼성앤텍 운영 도구)는 차가운 회색 + 남색 #1428A0 을 쓴다.
 * 이쪽은 무관한 공공 안내 서비스이므로 계열로 오인되면 안 된다.
 * 토큰 '체계'만 같이 가져가고 색은 전부 다르게 잡는다.
 *
 * 초록: 한국어 맥락에서 승인·수령의 색. "받을 수 있다"는 메시지와 맞다.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground:   "#F6F5F1",   // 따뜻한 종이색 (Datacenter 는 차가운 #F3F4F7)
        surface:  "#FFFFFF",
        surface2: "#FAF9F6",
        line:     "#E6E4DC",
        line2:    "#D3D0C4",
        ink:      "#1A2420",   // 초록 기운이 도는 먹색
        ink2:     "#343E39",
        muted:    "#6B7570",
        faint:    "#9BA39E",

        brand:     "#0D6B4F",  // 진초록
        brand2:    "#2E8F6E",
        brandDeep: "#08402F",
        brandSoft: "#E3F0E9",

        accent:     "#B4530E",  // 마감 — 따뜻한 주황
        accentSoft: "#FBEEE1",
        alert:      "#A32B22",
        alertSoft:  "#FAE9E6",
        gold:       "#8A6A12",
        goldSoft:   "#FAF2DC",
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "-apple-system",
               "system-ui", '"Malgun Gothic"', "sans-serif"],
      },
      borderRadius: { card: "18px", btn: "12px", ctl: "10px", pill: "999px" },
      boxShadow: {
        card: "0 1px 2px rgba(26,36,32,.04), 0 6px 18px rgba(26,36,32,.055)",
        lift: "0 2px 6px rgba(26,36,32,.06), 0 16px 40px rgba(26,36,32,.11)",
      },
    },
  },
  plugins: [],
} satisfies Config;
