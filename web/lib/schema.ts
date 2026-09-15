/**
 * 구조화 데이터(JSON-LD)를 한 곳에서 짓는다.
 *
 * 지금까지는 쪽마다 따로 @context 를 단 덩어리를 뿌리고 있었다. 채용 공고,
 * 지원사업, 자주 묻는 질문이 각각 떠 있고 사이트와 아무 관계가 없었다.
 * 검색엔진은 그걸 "이 회사의 이 쪽에 있는 이 공고" 로 잇지 못한다.
 *
 * 그래서 쪽마다 하나의 @graph 를 내보내고, 마디를 @id 로 잇는다.
 *
 *   WebSite(#website) ─ publisher ─→ Organization(#org)      ← layout 에서 한 번
 *        ↑ isPartOf
 *   WebPage(<url>#page) ─ breadcrumb ─→ BreadcrumbList(<url>#breadcrumb)
 *        ↑ mainEntityOfPage
 *   GovernmentService / JobPosting / BlogPosting …
 *
 * 화면에 없는 것은 적지 않는다. 길잡이(breadcrumb)도 화면에 그려진 그대로만
 * 적는다 — 눈에 안 보이는 것을 검색엔진에만 말하면 그게 속임수다.
 */

import { SITE_URL } from "./seo";

export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ORG_ID = `${SITE_URL}/#org`;

/** 길잡이 한 칸. 마지막 칸은 지금 쪽이라 주소를 주지 않아도 된다. */
export type Crumb = { name: string; path?: string };

type Node = Record<string, unknown>;

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

/**
 * 쪽 하나의 그래프.
 *
 * path 는 정본 주소(canonical)와 같아야 한다. 다르면 검색엔진이 두 쪽으로
 * 본다.
 */
export function pageGraph(opts: {
  /** "/jobs/region/서울특별시" 처럼 슬래시로 시작하는 경로. */
  path: string;
  name: string;
  description?: string | null;
  /** 화면에 그려진 길잡이 그대로. 마지막 칸이 지금 쪽이다. */
  crumbs?: Crumb[];
  /** 이 쪽이 다루는 것. GovernmentService·JobPosting·BlogPosting 등. */
  about?: Node | null;
  /** 목록 쪽이면 CollectionPage 로 바꾼다. */
  collection?: boolean;
  /** 마지막으로 바뀐 날. 있으면 적는다. */
  dateModified?: string | null;
}): Node {
  const url = abs(opts.path);
  const pageId = `${url}#page`;
  const graph: Node[] = [];

  const page: Node = {
    "@type": opts.collection ? "CollectionPage" : "WebPage",
    "@id": pageId,
    url,
    name: opts.name,
    inLanguage: "ko-KR",
    isPartOf: { "@id": WEBSITE_ID },
  };
  if (opts.description) page.description = opts.description;
  if (opts.dateModified) page.dateModified = opts.dateModified;

  if (opts.crumbs?.length) {
    const crumbId = `${url}#breadcrumb`;
    page.breadcrumb = { "@id": crumbId };
    graph.push({
      "@type": "BreadcrumbList",
      "@id": crumbId,
      itemListElement: opts.crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        // 마지막 칸은 지금 보고 있는 쪽이라 링크를 걸지 않는 것이 규칙이다.
        ...(c.path ? { item: abs(c.path) } : {}),
      })),
    });
  }

  graph.unshift(page);

  if (opts.about) {
    graph.push({ ...opts.about, mainEntityOfPage: { "@id": pageId } });
    page.mainEntity = { "@id": (opts.about["@id"] as string) ?? undefined };
    if (!opts.about["@id"]) delete page.mainEntity;
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
