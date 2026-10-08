import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * 쪽마다 다른 공유 카드 그림. /og?k=채용&t=제목&s=한 줄
 *
 * 카톡·문자로 채용 공고를 보내도 사이트 공통 그림("받을 수 있는데 모르고 지나친 지원금")이 떠서
 * 무슨 링크인지 그림만으로는 알 수 없었다. lib/seo 의 withOg 가 쪽 제목·갈래로 이 주소를 단다.
 * 첫 화면은 app/opengraph-image.tsx 가 그대로 맡는다.
 */
const ACCENT: Record<string, string> = {
  채용: "#34D399", "기업·소상공인": "#FBBF24", 자격증: "#60A5FA", 정책지도: "#F472B6",
  지원사업: "#C4B5FD", "안내 글": "#A5B4FC", "공공기관 사업": "#5EEAD4", 검색: "#C4B5FD", 지원금: "#C4B5FD",
};

/** 한글 글꼴. 이 그림에 쓰는 글자만 받는다(구글 폰트 text= 부분 받기). 못 받으면 기본 글꼴로. */
async function krFont(text: string, weight: 400 | 800): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    )).text();
    const src = /src:\s*url\(([^)]+)\)\s*format\('(?:opentype|truetype|woff)'\)/.exec(css)?.[1];
    return src ? await (await fetch(src)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = clip((u.searchParams.get("k") ?? "지원금").trim(), 12);
  const title = clip((u.searchParams.get("t") ?? "K나라지원").replace(/\s+/g, " ").trim(), 54);
  const sub = clip((u.searchParams.get("s") ?? "").replace(/\s+/g, " ").trim(), 46);
  const accent = ACCENT[kind] ?? "#C4B5FD";
  // 글자 수에 맞춰 크기를 줄인다. 세 줄을 넘지 않게.
  const size = title.length <= 14 ? 80 : title.length <= 26 ? 66 : title.length <= 40 ? 56 : 48;
  const FOOT = "회원가입 없이 바로 보는 공공 정보";
  // 보통 글꼴을 먼저 올려 기본으로 쓰고, 제목·딱지만 굵은 글꼴. 굵은 글꼴만 올리면 그 글자가 든 다른 줄까지 굵어졌다.
  const [regular, bold] = await Promise.all([krFont(`K나라지원${sub}${FOOT}jiwon.knowhow-it.com`, 400), krFont(`${title}${kind}`, 800)]);

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "70px 80px", color: "#fff",
        background: "linear-gradient(150deg,#062418 0%,#3B2FB5 55%,#5A4BE0 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 28 }}>
          <span style={{ letterSpacing: 6, color: "#C4B5FD", fontFamily: regular ? "KR" : undefined }}>K나라지원</span>
          <span style={{
            marginLeft: 22, padding: "6px 18px", borderRadius: 999, fontSize: 26, fontWeight: 700,
            color: "#0B1020", background: accent, fontFamily: bold ? "KR Bold" : undefined,
          }}>{kind}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.22, maxHeight: size * 1.22 * 3, overflow: "hidden", wordBreak: "keep-all", fontFamily: bold ? "KR Bold" : undefined }}>
            {title}
          </div>
          {sub && <div style={{ marginTop: 26, fontSize: 32, color: "#D9D6F5", fontFamily: regular ? "KR" : undefined }}>{sub}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#B9B4E6", fontFamily: regular ? "KR" : undefined }}>
          <span>{FOOT}</span>
          <span>jiwon.knowhow-it.com</span>
        </div>
      </div>
    ),
    {
      width: 1200, height: 630,
      fonts: [
        ...(regular ? [{ name: "KR", data: regular, weight: 400 as const, style: "normal" as const }] : []),
        ...(bold ? [{ name: "KR Bold", data: bold, weight: 800 as const, style: "normal" as const }] : []),
      ],
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
    },
  );
}
