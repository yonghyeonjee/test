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
        ground:   "#F3F6FA",
        surface:  "#FFFFFF",
        surface2: "#F8FAFD",
        line:     "#E1E7F0",
        line2:    "#C5D0DE",
        ink:      "#0F1B2D",
        ink2:     "#2B3A4F",
        muted:    "#5F6E82",
        faint:    "#93A1B3",
        /** 짙은 띠(히어로·통계·꼬리말) 바탕 */
        deep:     "#0A1E3C",
        deep2:    "#10305C",
        clay:     "#D9691F",
        claySoft: "#FCEBDD",

        brand:     "#0B5FA5",  // 진초록
        brand2:    "#2F7FD0",
        brandDeep: "#063C6B",
        brandSoft: "#E4EEF9",

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
      borderRadius: { card: "14px", btn: "10px", ctl: "10px", pill: "999px" },
      boxShadow: {
        card: "0 1px 0 rgba(15,27,45,.04)",
        lift: "0 8px 24px rgba(15,27,45,.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
