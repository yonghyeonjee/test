import fs from "node:fs";
import path from "node:path";

/**
 * 사진 자리.
 *
 * public/img/<name>.jpg 가 있으면 그 사진을, 없으면 대신 넘겨받은 그림을
 * 보여 준다. 사진은 Unsplash 같은 무료 자료를 내려받아 넣고, 출처를
 * credit 으로 적는다. 파일이 없다고 깨진 그림이 뜨면 안 된다 — 그래서
 * 서버에서 존재 여부를 먼저 본다.
 */
export default function Photo({
  name, alt, credit, fallback, className = "",
}: {
  name: string;
  alt: string;
  credit?: string;
  fallback: React.ReactNode;
  className?: string;
}) {
  const file = path.join(process.cwd(), "public", "img", `${name}.jpg`);
  const has = fs.existsSync(file);
  if (!has) return <>{fallback}</>;
  return (
    <figure className={`relative overflow-hidden rounded-card ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/img/${name}.jpg`} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      {credit && (
        <figcaption className="absolute bottom-1.5 right-2 rounded-pill bg-black/40 px-2 py-0.5
                               text-[10px] text-white/80">
          {credit}
        </figcaption>
      )}
    </figure>
  );
}
