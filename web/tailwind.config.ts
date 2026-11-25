import type { Config } from "tailwindcss";

/**
 * 나라지원 팔레트.
 *
 * 바탕·글자·선은 색기 없는 중립 회색이다. 예전에는 회색까지 보라를 머금어 화면 전체가
 * 한 가지 색으로 보였고, 짙은 보라 띠(메뉴·히어로·꼬리말)가 무거웠다.
 *
 *  - 브랜드 파랑(brand, 2026-11-25 보라에서 바꿈)은 주 동작(검색·찾기 단추, 고른 것, 초점)에만 쓴다.
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
      // 2026-11-26 색은 모두 CSS 변수(app/globals.css 의 :root)다 — 기기가 어두운 화면이면 변수만 바뀐다.
      colors: {
        ground: "rgb(var(--c-ground) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        line2: "rgb(var(--c-line2) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        ink2: "rgb(var(--c-ink2) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        // 2026-11-15: #7A8494(흰 바탕 대비 3.9:1)는 작은 글씨 기준(4.5:1)에 못 미쳤다. 날짜·출처 같은 보조 글씨가 흐려
        // 읽기 힘들다는 말에 한 단계 진하게(약 4.9:1). 브랜드 색은 그대로 둔다 — 대비 5.6:1 로 이미 넉넉하고,
        // 정부 표준 파랑으로 바꾸면 공식 사이트로 오해받는다.
        faint: "rgb(var(--c-faint) / <alpha-value>)",
        /** 짙은 바탕이 꼭 필요할 때(관리자 로그인 등). 남색에 가까운 먹색. */
        deep: "rgb(var(--c-deep) / <alpha-value>)",
        deep2: "rgb(var(--c-deep2) / <alpha-value>)",
        clay: "rgb(var(--c-clay) / <alpha-value>)",
        claySoft: "rgb(var(--c-claySoft) / <alpha-value>)",

        brand: "rgb(var(--c-brand) / <alpha-value>)",
        brand2: "rgb(var(--c-brand2) / <alpha-value>)",
        brandDeep: "rgb(var(--c-brandDeep) / <alpha-value>)",
        brandSoft: "rgb(var(--c-brandSoft) / <alpha-value>)",

        accent: "rgb(var(--c-accent) / <alpha-value>)",  // 마감
        accentSoft: "rgb(var(--c-accentSoft) / <alpha-value>)",
        alert: "rgb(var(--c-alert) / <alpha-value>)",
        alertSoft: "rgb(var(--c-alertSoft) / <alpha-value>)",
        gold: "rgb(var(--c-gold) / <alpha-value>)",
        goldSoft: "rgb(var(--c-goldSoft) / <alpha-value>)",

        /** 갈래 색. 글자로 쓸 때는 진한 쪽(DEFAULT), 바탕은 soft. */
        cat: {
          green: "rgb(var(--c-cat-green) / <alpha-value>)",  greenSoft: "rgb(var(--c-cat-greenSoft) / <alpha-value>)",
          red: "rgb(var(--c-cat-red) / <alpha-value>)",    redSoft: "rgb(var(--c-cat-redSoft) / <alpha-value>)",
          violet: "rgb(var(--c-cat-violet) / <alpha-value>)", violetSoft: "rgb(var(--c-cat-violetSoft) / <alpha-value>)",
          blue: "rgb(var(--c-cat-blue) / <alpha-value>)",   blueSoft: "rgb(var(--c-cat-blueSoft) / <alpha-value>)",
          orange: "rgb(var(--c-cat-orange) / <alpha-value>)", orangeSoft: "rgb(var(--c-cat-orangeSoft) / <alpha-value>)",
          amber: "rgb(var(--c-cat-amber) / <alpha-value>)",  amberSoft: "rgb(var(--c-cat-amberSoft) / <alpha-value>)",
          lime: "rgb(var(--c-cat-lime) / <alpha-value>)",   limeSoft: "rgb(var(--c-cat-limeSoft) / <alpha-value>)",
          cyan: "rgb(var(--c-cat-cyan) / <alpha-value>)",   cyanSoft: "rgb(var(--c-cat-cyanSoft) / <alpha-value>)",
          indigo: "rgb(var(--c-cat-indigo) / <alpha-value>)", indigoSoft: "rgb(var(--c-cat-indigoSoft) / <alpha-value>)",
          pink: "rgb(var(--c-cat-pink) / <alpha-value>)",   pinkSoft: "rgb(var(--c-cat-pinkSoft) / <alpha-value>)",
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
        // 2026-11-25 짙은 첫 화면 띠 위로 떠오르는 카드.
        float: "0 24px 60px -24px rgba(16,20,60,.45), 0 2px 6px rgba(16,20,60,.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
