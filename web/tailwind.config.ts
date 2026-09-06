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
        // 따뜻한 종이색은 정부지원 조회 화면에 얹으니 촌스러웠다.
        // 중립에 가까운 서늘한 회색으로 낮추고, 색은 초록 하나만 남긴다.
        ground:   "#F2F4F5",
        surface:  "#FFFFFF",
        surface2: "#F8FAFA",
        line:     "#E1E6E7",
        line2:    "#C9D1D2",
        ink:      "#131A1C",
        ink2:     "#2E3A3C",
        muted:    "#647175",
        faint:    "#94A0A3",

        brand:     "#0D6B4F",  // 진초록
        brand2:    "#2E8F6E",
        brandDeep: "#08402F",
        brandSoft: "#E3F0E9",

        accent:     "#A8500F",  // 마감
        accentSoft: "#FBEDE0",
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
