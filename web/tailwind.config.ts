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
        ground:   "#F7F7FB",
        surface:  "#FFFFFF",
        surface2: "#F9F8FF",
        line:     "#E6E4F2",
        line2:    "#CFCBE6",
        ink:      "#171532",
        ink2:     "#2E2B4F",
        muted:    "#6B6885",
        faint:    "#9C99B4",
        /** 짙은 띠(히어로·통계·꼬리말) 바탕 */
        deep:     "#1E1B4B",
        deep2:    "#2A2777",
        clay:     "#D9691F",
        claySoft: "#FCEBDD",

        brand:     "#5A4BE0",  // 진초록
        brand2:    "#7B6CF6",
        brandDeep: "#3B2FB5",
        brandSoft: "#ECEAFF",

        accent:     "#D9691F",  // 마감
        accentSoft: "#FCEBDD",
        alert:      "#A32B22",
        alertSoft:  "#FAE9E6",
        gold:       "#8A6A12",
        goldSoft:   "#FAF2DC",
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "-apple-system",
               "system-ui", '"Malgun Gothic"', "sans-serif"],
        // 제목도 같은 고딕. 굵기와 자간으로만 본문과 갈라놓는다.
        serif: ['"Pretendard Variable"', "Pretendard", "-apple-system",
                "system-ui", '"Malgun Gothic"', "sans-serif"],
      },
      // 모서리를 조금 죽이고 그림자를 걷어낸다. 둥둥 떠 있는 카드가 템플릿처럼 보였다.
      borderRadius: { card: "18px", btn: "12px", ctl: "10px", pill: "999px" },
      boxShadow: {
        card: "0 2px 12px rgba(23,21,50,.05)",
        lift: "0 8px 24px rgba(23,21,50,.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
