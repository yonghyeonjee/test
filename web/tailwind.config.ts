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
        // 종이에 가까운 따뜻한 바탕. 차가운 회색은 관리 도구처럼 보였다.
        ground:   "#F6F4EE",
        surface:  "#FFFFFF",
        surface2: "#FBFAF7",
        line:     "#E6E2D8",
        line2:    "#CFC9BB",
        ink:      "#14201C",
        ink2:     "#2F3B36",
        muted:    "#66716C",
        faint:    "#98A19C",
        /** 짙은 띠(히어로·통계·꼬리말) 바탕 */
        deep:     "#0B2A21",
        deep2:    "#0F3A2D",
        clay:     "#B8672A",
        claySoft: "#F6E7DA",

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
        serif: ['"Noto Serif KR"', '"Apple SD Gothic Neo"', '"Nanum Myeongjo"', "serif"],
      },
      // 모서리를 조금 죽이고 그림자를 걷어낸다. 둥둥 떠 있는 카드가 템플릿처럼 보였다.
      borderRadius: { card: "14px", btn: "10px", ctl: "10px", pill: "999px" },
      boxShadow: {
        card: "0 1px 0 rgba(20,32,28,.04)",
        lift: "0 8px 24px rgba(20,32,28,.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
