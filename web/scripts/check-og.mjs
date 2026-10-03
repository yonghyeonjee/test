// 새 쪽에 공유 카드(og:title·og:image)를 빠뜨리지 않게 CI 에서 막는다.
// app 아래 page.tsx 가 메타데이터를 내보내면, withOg(…) 를 거치거나 withOg 를 쓰는 도우미를 불러야 한다.
// 도우미를 새로 만들면 HELPERS 에 이름을 더한다. 공유할 일이 없는 쪽(관리자·계정·바로 넘기는 쪽)은 SKIP.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const HELPERS = ["withOg(", "jobsIndexMetadata(", "businessMetadata(", "homeMetadata("];
const SKIP = [/^app\/admin\//, /^app\/account\//, /^app\/api\//, /^app\/jobs\/search\/page\.tsx$/];

const walk = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith("page.tsx") ? [p] : [];
});

const bad = [];
for (const f of walk("app")) {
  if (SKIP.some((re) => re.test(f))) continue;
  const src = readFileSync(f, "utf8");
  const hasMeta = /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata|const\s+generateMetadata)/.test(src);
  if (!hasMeta) { bad.push(`${f}: 메타데이터가 없습니다(공유 카드가 사이트 공통으로 나갑니다)`); continue; }
  if (!HELPERS.some((h) => src.includes(h))) bad.push(`${f}: withOg 를 거치지 않았습니다`);
}
if (bad.length) {
  console.error("공유 카드 점검 실패:\n  " + bad.join("\n  "));
  console.error("\n메타데이터를 withOg({ title, description, alternates: { canonical } }) 로 감싸 주세요(lib/seo).");
  process.exit(1);
}
console.log("공유 카드 점검: 모든 쪽이 withOg 를 거칩니다.");
