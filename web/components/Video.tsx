import fs from "node:fs";
import path from "node:path";

/** public 아래 파일이 있는지. 없는 영상을 걸어 두면 빈 상자만 뜬다. */
export function hasPublic(rel: string) {
  return fs.existsSync(path.join(process.cwd(), "public", rel));
}

/**
 * 배경 영상. 소리 없이 반복하고, 위에 짙은 막을 덮어 글자가 읽히게 한다.
 * 스크립트가 필요 없다 — autoplay·muted 만으로 브라우저가 알아서 튼다.
 */
export function AmbientVideo({ src, poster }: { src: string; poster?: string }) {
  return (
    <video
      className="ambient"
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden
      tabIndex={-1}
    />
  );
}

/** 사람이 눌러서 보는 영상. 파일이 없으면 아무것도 그리지 않는다. */
export function IntroVideo({ rel, poster, title }: { rel: string; poster?: string; title: string }) {
  if (!hasPublic(rel)) return null;
  return (
    <figure className="card overflow-hidden">
      <video className="aspect-video w-full bg-deep" src={`/${rel}`} poster={poster} controls preload="metadata" />
      <figcaption className="px-4 py-2.5 text-xs text-muted">{title}</figcaption>
    </figure>
  );
}
