import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";

/**
 * 관리자가 화면에서 바꾸는 값들. site_settings 에 JSON 으로 둔다.
 *
 * SEO 확인 토큰과 광고 지면은 코드에 박아 두면 바꿀 때마다 배포해야
 * 한다. 관리자 화면에서 고치고 캐시만 비우면 반영되게 한다. 5분 캐시라
 * 저장 직후에는 "화면 캐시 즉시 갱신"을 누르면 된다.
 */

export type Seo = {
  naver: string;
  google: string;
  bing: string;
  /** 비우면 코드의 기본 설명을 쓴다. */
  description: string;
  keywords: string;
  index: boolean;
};

export type AdKind = "html" | "image";
export type AdSlotCfg = { on: boolean; kind: AdKind; html: string; img: string; href: string; alt: string };
export const AD_SLOTS = ["home_mid", "results_bottom", "post_bottom", "page_bottom"] as const;
export type AdSlotName = (typeof AD_SLOTS)[number];
export type Ads = Record<AdSlotName, AdSlotCfg>;

export const AD_SLOT_LABEL: Record<AdSlotName, string> = {
  home_mid: "홈 · 절차 설명 아래",
  results_bottom: "조회 결과 목록 아래",
  post_bottom: "안내 글 본문 끝",
  page_bottom: "자료 화면(채용·공공기관·정책·지역) 본문 끝",
};

export const EMPTY_SLOT: AdSlotCfg = { on: false, kind: "html", html: "", img: "", href: "", alt: "" };

/** 네이버 확인 토큰은 DB 가 비어 있어도 나가야 한다. 코드에 기본값을 둔다. */
const DEFAULT_SEO: Seo = {
  naver: "a910f9a9fb3d311d3ebe25d0d7f821df89c3bb12",
  google: "", bing: "", description: "", keywords: "", index: true,
};

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function parseSeo(v: unknown): Seo {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    naver: str(o.naver, DEFAULT_SEO.naver),
    google: str(o.google), bing: str(o.bing),
    description: str(o.description), keywords: str(o.keywords),
    index: bool(o.index, true),
  };
}

export function parseAds(v: unknown): Ads {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out = {} as Ads;
  for (const name of AD_SLOTS) {
    const s = (o[name] && typeof o[name] === "object" ? o[name] : {}) as Record<string, unknown>;
    out[name] = {
      on: bool(s.on, false),
      kind: s.kind === "image" ? "image" : "html",
      html: str(s.html), img: str(s.img), href: str(s.href), alt: str(s.alt),
    };
  }
  return out;
}

async function load(): Promise<{ seo: Seo; ads: Ads }> {
  if (!dbConfigured) return { seo: DEFAULT_SEO, ads: parseAds({}) };
  try {
    const { data } = await db.from("settings_public").select("key,value").in("key", ["seo", "ads"]);
    const m = new Map((data ?? []).map((d) => [d.key as string, d.value]));
    return { seo: parseSeo(m.get("seo")), ads: parseAds(m.get("ads")) };
  } catch {
    return { seo: DEFAULT_SEO, ads: parseAds({}) };
  }
}

export const getSiteConfig = unstable_cache(load, ["site-config"], { revalidate: 300 });
