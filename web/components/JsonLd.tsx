/**
 * JSON-LD 한 덩어리를 심는다.
 *
 * 값에 </script> 가 섞이면 태그가 거기서 끊긴다. 공고 원문에서 온 글이
 * 그대로 들어가므로 막아 둔다.
 */
export default function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
