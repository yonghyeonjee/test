import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "청년미래적금 2차 — 10월 7일부터 16일까지 신청";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 카톡으로 이 글을 보낼 때 보이는 카드. 날짜가 제일 중요하니 크게 적는다. */
export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          flexDirection: "column", justifyContent: "center", padding: 80,
          background: "linear-gradient(150deg,#062418 0%,#3B2FB5 55%,#5A4BE0 100%)",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 8, color: "#C4B5FD" }}>나라지원</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.15, marginTop: 22 }}>
          청년미래적금 2차
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.15 }}>
          10월 16일까지 신청
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 36 }}>
          {["월 50만원 · 3년", "정부기여금 6% / 12%", "이자 비과세"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex", fontSize: 28, color: "#EAF3EE",
                background: "rgba(255,255,255,.12)", borderRadius: 999,
                padding: "12px 26px",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
