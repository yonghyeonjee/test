import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "지원찾기 — 내가 받을 수 있는 정부지원금 조회";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 카톡·문자로 링크를 보낼 때 보이는 카드. 공유가 유입의 큰 축이다. */
export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          flexDirection: "column", justifyContent: "center", padding: 80,
          background: "linear-gradient(150deg,#062418 0%,#08402F 55%,#0D6B4F 100%)",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 8, color: "#8FCFB0" }}>
          지원찾기
        </div>
        <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.15, marginTop: 22 }}>
          받을 수 있는데
        </div>
        <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.15 }}>
          모르고 지나친 지원금
        </div>
        <div style={{ fontSize: 32, color: "#A9CFBC", marginTop: 30 }}>
          회원가입도 주민등록번호도 없이 조회
        </div>
      </div>
    ),
    size
  );
}
