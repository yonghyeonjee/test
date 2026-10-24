"use client";

/** 뿌리 레이아웃까지 터졌을 때. 그때는 <html> 부터 직접 그려야 하고, 여기서는 head 에 noindex 를 바로 적을 수 있다. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <head>
        <meta name="robots" content="noindex" />
        <title>잠시 뒤 다시 열어 주세요 | K나라지원</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "64px 24px", maxWidth: 640, margin: "0 auto", lineHeight: 1.7 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>K나라지원</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "8px 0 16px" }}>이 쪽을 그리다 멈췄습니다</h1>
        <p style={{ color: "#555" }}>
          정부 지원사업·공공기관 채용 자료를 읽어 오는 중에 서버가 잠시 답을 못 했습니다. 몇 초 뒤 다시 열어 주세요.
        </p>
        <p style={{ marginTop: 24 }}>
          <button type="button" onClick={reset} style={{ padding: "10px 16px", fontWeight: 700 }}>다시 열기</button>{" "}
          <a href="/" style={{ marginLeft: 12 }}>첫 화면으로</a>
        </p>
        {error?.digest && <p style={{ marginTop: 24, fontSize: 11, color: "#999" }}>오류 번호 {error.digest}</p>}
      </body>
    </html>
  );
}
