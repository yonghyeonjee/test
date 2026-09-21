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
  /**
   * 다음 웹마스터도구. 이쪽은 meta 가 아니라 robots.txt 안에 주석 한 줄로
   * 넣는다 — "#DaumWebMasterTool:…" 형태 그대로.
   */
  daum: string;
  /** 비우면 코드의 기본 설명을 쓴다. */
  description: string;
  keywords: string;
  index: boolean;
};

export type AdKind = "html" | "image";
export type AdSlotCfg = { on: boolean; kind: AdKind; html: string; img: string; href: string; alt: string };
export const AD_SLOTS = ["home_mid", "results_bottom", "post_bottom", "page_bottom", "detail_bottom", "detail_mid", "post_mid", "side_rail"] as const;
export type AdSlotName = (typeof AD_SLOTS)[number];
export type Ads = Record<AdSlotName, AdSlotCfg>;

export const AD_SLOT_LABEL: Record<AdSlotName, string> = {
  home_mid: "홈 · 절차 설명 아래",
  results_bottom: "조회 결과 목록 아래",
  post_bottom: "안내 글 본문 끝",
  page_bottom: "자료 화면(채용·공공기관·정책·지역) 본문 끝",
  detail_bottom: "상세 화면(사업·채용·자격증) 맨 아래 — 멀티플렉스처럼 큰 광고, 높이 제한 없음",
  detail_mid: "본문 중간 (사업 상세·지역·채용·통계 화면) — 비우면 우리 사이트 배너",
  post_mid: "안내 글 중간 — 비우면 우리 사이트 배너",
  side_rail: "넓은 화면 오른쪽 세로 (사이드 레일) — 폭 1536px·높이 880px 이상에서만 (글자 크게 보기에서는 숨김), 160×600 세로 단위 권장",
};

export const EMPTY_SLOT: AdSlotCfg = { on: false, kind: "html", html: "", img: "", href: "", alt: "" };

/**
 * 광고 전체 스위치. 관리자 화면에서 켜고 끈다.
 *
 * 한동안 코드에 박아 두었는데, 광고를 급히 내려야 할 때마다 배포를
 * 기다려야 했다. 켜고 끄는 일은 화면에서 해야 한다. 끄면 지면이 통째로
 * 사라지고 빈 상자도 남지 않는다. 본문 중간 자리에는 우리 사이트 배너가
 * 대신 들어간다.
 *
 * 자동광고는 이 스위치로 막는 것이 아니다. 자동광고를 쓸지 말지는
 * 애드센스 계정 설정에 달려 있고, 우리 쪽에서는 광고 로더 주소에서
 * client 인자를 떼어 "자동광고를 달라고 하지 않는" 것까지가 전부다
 * (components/AdHtml.tsx).
 */
export const ADS_ON_DEFAULT = true;

export function parseAdsOn(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const o = (v && typeof v === "object" ? v : null) as { on?: unknown } | null;
  return typeof o?.on === "boolean" ? o.on : ADS_ON_DEFAULT;
}

/** 확인 토큰은 DB 가 비어 있거나 못 읽어도 나가야 한다. 코드에 기본값을 둔다. */
export const DEFAULT_SEO: Seo = {
  naver: "a910f9a9fb3d311d3ebe25d0d7f821df89c3bb12",
  daum: "c5c205ec2131c804e16bafa3971f389b5c56e8e4b4e42a153a178f743f21252d:TTrNsDNWeyJBX4OQHE95rw==",
  google: "", bing: "", description: "", keywords: "", index: true,
};

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function parseSeo(v: unknown): Seo {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    naver: str(o.naver, DEFAULT_SEO.naver),
    daum: str(o.daum, DEFAULT_SEO.daum),
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

async function load(): Promise<{ seo: Seo; ads: Ads; adsOn: boolean }> {
  const empty = { seo: DEFAULT_SEO, ads: parseAds({}), adsOn: ADS_ON_DEFAULT };
  if (!dbConfigured) return empty;
  try {
    const { data } = await db
      .from("settings_public")
      .select("key,value")
      .in("key", ["seo", "ads", "ads_on"]);
    const m = new Map((data ?? []).map((d) => [d.key as string, d.value]));
    return {
      seo: parseSeo(m.get("seo")),
      ads: parseAds(m.get("ads")),
      adsOn: parseAdsOn(m.get("ads_on")),
    };
  } catch {
    return empty;
  }
}

export const getSiteConfig = unstable_cache(load, ["site-config"], { revalidate: 300 });
