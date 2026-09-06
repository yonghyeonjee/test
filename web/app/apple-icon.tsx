import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * 홈 화면에 추가했을 때 보이는 아이콘. 글꼴에 기대면 환경에 따라
 * 글자가 깨지므로 도형만으로 그린다 — 브라우저 탭 아이콘과 같은 돋보기.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(150deg,#08402F 0%,#0D6B4F 100%)",
        }}
      >
        <div style={{ display: "flex", position: "relative", width: 112, height: 112 }}>
          <div
            style={{
              position: "absolute", top: 0, left: 0,
              width: 74, height: 74, borderRadius: 74,
              border: "15px solid #fff",
            }}
          />
          <div
            style={{
              position: "absolute", top: 68, left: 68,
              width: 15, height: 44, borderRadius: 8,
              background: "#fff",
              transform: "rotate(-45deg)",
            }}
          />
        </div>
      </div>
    ),
    size
  );
}
