import type { Config } from "tailwindcss";

/**
 * 나라지원 팔레트.
 *
 * 바탕·글자·선은 색기 없는 중립 회색이다. 예전에는 회색까지 보라를 머금어 화면 전체가
 * 한 가지 색으로 보였고, 짙은 보라 띠(메뉴·히어로·꼬리말)가 무거웠다.
 *
 *  - 브랜드 보라(brand)는 주 동작(검색·찾기 단추, 고른 것, 초점)에만 쓴다.
 *  - 갈래마다 제 색(cat.*)이 있다. 바로가기 아이콘·분야·배지가 이 색을 입어 화면이
 *    다채로워지되, 채도는 Open Color 6~8 단계로 묶어 들뜨지 않게 한다.
 *  - 회색 단계는 국내 서비스들이 쓰는 값에 맞췄다(본문 #191F28, 보조 #5B6573).
 *    보조 글자는 바탕(#F5F6F8) 위에서도 명도 대비 4.5:1 을 넘는다.
 */
export default {
  // lib/ 도 읽는다 — 갈래 색·기둥 폭 같은 클래스 묶음이 lib/nav.ts 에 있다.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground:   "#F5F6F8",
        surface:  "#FFFFFF",
        surface2: "#F9FAFB",
        line:     "#E5E8EC",
        line2:    "#D1D6DC",
        ink:      "#191F28",
        ink2:     "#333D4B",
        muted:    "#5B6573",
        faint:    "#7A8494",
        /** 짙은 바탕이 꼭 필요할 때(관리자 로그인 등). 남색에 가까운 먹색. */
        deep:     "#1B2033",
        deep2:    "#2A3150",
        clay:     "#C4410C",
        claySoft: "#FFF1E8",

        brand:     "#5A4BE0",
        brand2:    "#7B6CF6",
        brandDeep: "#4436C7",
        brandSoft: "#EEEBFF",

        accent:     "#C4410C",  // 마감
        accentSoft: "#FFF1E8",
        alert:      "#C92A2A",
        alertSoft:  "#FFF0F0",
        gold:       "#8A6A12",
        goldSoft:   "#FBF3DC",

        /** 갈래 색. 글자로 쓸 때는 진한 쪽(DEFAULT), 바탕은 soft. */
        cat: {
          green: "#0C9F6E",  greenSoft: "#E6FCF5",
          red: "#E03131",    redSoft: "#FFF0F0",
          violet: "#7048E8", violetSoft: "#F3F0FF",
          blue: "#1C7ED6",   blueSoft: "#E7F5FF",
          orange: "#E8590C", orangeSoft: "#FFF4E6",
          amber: "#E67700",  amberSoft: "#FFF9DB",
          lime: "#5C940D",   limeSoft: "#F4FCE3",
          cyan: "#0C8599",   cyanSoft: "#E3FAFC",
          indigo: "#3B5BDB", indigoSoft: "#EDF2FF",
          pink: "#C2255C",   pinkSoft: "#FFF0F6",
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "-apple-system",
               "system-ui", '"Malgun Gothic"', "sans-serif"],
        // 제목도 같은 고딕. 굵기와 자간으로만 본문과 갈라놓는다.
        serif: ['"Pretendard Variable"', "Pretendard", "-apple-system",
                "system-ui", '"Malgun Gothic"', "sans-serif"],
      },
      // 포털 카드의 모서리(16px). 검색창은 알약 모양.
      borderRadius: { card: "16px", btn: "12px", ctl: "10px", pill: "999px" },
      boxShadow: {
        card: "0 1px 2px rgba(17,24,39,.04)",
        lift: "0 10px 30px -12px rgba(17,24,39,.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
