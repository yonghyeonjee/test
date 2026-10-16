/**
 * 글 제목용 명조(Noto Serif KR). 블로그 목록·상세에서만 부른다 — 첫 화면까지 글꼴을 더 받게 하지 않는다.
 * 글자는 .article-title(globals.css)이 쓴다. 못 받으면 고딕으로 그대로 보인다(display=swap).
 */
export default function SerifFont() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700&display=swap" />
    </>
  );
}
