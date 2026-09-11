import { findRows } from "./openapi";

/**
 * 알리오 플러스 (기획재정부, 공공기관 경영정보 공개).
 *
 * 공공기관이 하는 사업·행사·시설을 국민 쪽에서 보게 정리한 API 다.
 * 공공데이터포털과 별개라 인증키도 따로다 — alioplus.go.kr 에서 소셜
 * 로그인 뒤 Open API 메뉴에서 발급받아 ALIOPLUS_API_KEY(Secret)에 넣는다.
 *
 * 가이드대로: POST, 폼 인코딩, 인증키는 X-API-AUTH-KEY 항목으로 본문에,
 * 키의 + 는 %2B 로. SSL 을 지원하지 않아 http 다 — 서버에서만 부르므로
 * 브라우저에는 이 주소도 키도 나가지 않는다. 쪽 번호 없이 pageSize 만
 * 받으므로 넉넉히 한 번에 받아 화면에서 거른다.
 */

const BASE = "http://openapi.alioplus.go.kr/api";

/**
 * 알리오 플러스는 활용정보(시설·행사·사업·기관)마다 인증키를 따로 준다.
 * 종류별 변수를 먼저 보고, 없으면 공통 ALIOPLUS_API_KEY 로 대신한다.
 */
const KEYS: Record<"facility" | "event" | "business" | "apba", string> = {
  facility: (process.env.ALIOPLUS_KEY_FACILITY ?? process.env.ALIOPLUS_API_KEY ?? "").trim(),
  event: (process.env.ALIOPLUS_KEY_EVENT ?? process.env.ALIOPLUS_API_KEY ?? "").trim(),
  business: (process.env.ALIOPLUS_KEY_BUSINESS ?? process.env.ALIOPLUS_API_KEY ?? "").trim(),
  apba: (process.env.ALIOPLUS_KEY_APBA ?? process.env.ALIOPLUS_API_KEY ?? "").trim(),
};
export const alioConfigured = Object.values(KEYS).some((k) => k.length > 0);

export type AlioResult =
  | { ok: true; rows: Record<string, string>[] }
  | { ok: false; reason: string };

/** 값이 객체나 배열이면 문자열로 눌러 둔다. 화면에서는 문자열만 쓴다. */
function flat(r: Record<string, unknown>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (v === null || v === undefined) continue;
    o[k] = typeof v === "string" ? v.trim() : typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return o;
}

export async function callAlio(
  path: "facility" | "event" | "apba" | "business",
  params: Record<string, string> = {},
  pageSize = 300,
  revalidate = 21600,
): Promise<AlioResult> {
  const key = KEYS[path];
  if (!key) return { ok: false, reason: "인증키가 설정되지 않았습니다." };
  const body = new URLSearchParams({
    "X-API-AUTH-KEY": key.replace(/\+/g, "%2B"),
    pageSize: String(pageSize),
    ...params,
  });
  try {
    const res = await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
      next: { revalidate },
    });
    if (!res.ok) return { ok: false, reason: `응답 코드 ${res.status}` };
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { return { ok: false, reason: "JSON 이 아닌 응답" }; }
    const rows = findRows(json);
    if (!rows) {
      console.warn("[alioplus]", path, "목록을 못 찾았다:", text.slice(0, 200));
      return { ok: false, reason: "목록을 찾지 못했습니다." };
    }
    return { ok: true, rows: rows.map(flat) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "호출 실패" };
  }
}

// ── 코드표 (가이드 4장) ────────────────────────────────────

export const LIFE_CYCLE: { code: string; label: string }[] = [
  { code: "01", label: "영유아" }, { code: "02", label: "아동·청소년" }, { code: "03", label: "청년" },
  { code: "04", label: "중장년" }, { code: "05", label: "어르신" },
];

export const BSN_CATE: { code: string; label: string }[] = [
  { code: "B06", label: "사회복지" }, { code: "B09", label: "취업·직업" }, { code: "B03", label: "교육연구" },
  { code: "B01", label: "건강" }, { code: "B08", label: "생활환경" }, { code: "B05", label: "문화생활" },
  { code: "B07", label: "산업진흥" }, { code: "B02", label: "공공안전" }, { code: "B04", label: "국가인프라" },
  { code: "B99", label: "편의서비스" },
];

export const SVC_CATE: { code: string; label: string }[] = [
  { code: "05", label: "사업지원" }, { code: "03", label: "교육/상담" }, { code: "06", label: "시설지원" },
  { code: "04", label: "평가/발급" }, { code: "01", label: "생활정보" },
];

export const EVT_CATE: { code: string; label: string }[] = [
  { code: "E003", label: "교육/강연" }, { code: "E002", label: "체험" }, { code: "E007", label: "문화/예술" },
  { code: "E001", label: "견학/탐방" }, { code: "E004", label: "세미나" }, { code: "E005", label: "공모전" },
  { code: "E006", label: "자원봉사" }, { code: "E008", label: "국민참여" },
];

export const FCLT_CATE: { code: string; label: string }[] = [
  { code: "F005", label: "체육시설" }, { code: "F004", label: "문화시설" }, { code: "F001", label: "회의실" },
  { code: "F002", label: "강당·강의실" }, { code: "F007", label: "숙박시설" }, { code: "F008", label: "주차장" },
];

/** 시·도 이름을 알리오가 쓰는 짧은 이름으로. "경기도" → "경기" */
export const SIDO_SHORT = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// ── 화면용 정규화 ─────────────────────────────────────────

export type AlioItem = {
  id: string;
  title: string;
  org: string | null;
  cate: string | null;
  target: string | null;
  desc: string | null;
  address: string | null;
  start: string | null;
  end: string | null;
  url: string | null;
  tags: string[];
};

const g = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (r[k]) return r[k];
  return null;
};

const iso = (v: string | null) => {
  const m = v?.match(/(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

export function toBusiness(r: Record<string, string>): AlioItem | null {
  const title = g(r, "bsnNa");
  if (!title) return null;
  const tags = [g(r, "lifeCycleNa"), g(r, "svcCateNa")].filter((x): x is string => !!x);
  return {
    id: `${g(r, "apbaNa") ?? ""}|${title}`,
    title, org: g(r, "apbaNa"), cate: g(r, "cateNaPath", "cateNa"),
    target: g(r, "guideTar"), desc: g(r, "bsnDsc"), address: null,
    start: iso(g(r, "bsnStDt")), end: iso(g(r, "bsnEndDt")),
    url: g(r, "siteUrl"), tags,
  };
}

export function toEvent(r: Record<string, string>): AlioItem | null {
  const title = g(r, "evtNa");
  if (!title) return null;
  const tags = [
    r.aplYn === "Y" ? "신청 가능" : null,
    g(r, "payYnNa"), g(r, "evtType"),
  ].filter((x): x is string => !!x);
  return {
    id: `${g(r, "apbaNa") ?? ""}|${title}|${g(r, "evtStDt") ?? ""}`,
    title, org: g(r, "apbaNa", "hostName"), cate: g(r, "cateNaPath", "cateNa"),
    target: g(r, "evtTar"), desc: g(r, "evtDsc"), address: g(r, "address"),
    start: iso(g(r, "evtStDt")), end: iso(g(r, "evtEndDt")),
    url: g(r, "aplMthUrl"), tags,
  };
}

export function toFacility(r: Record<string, string>): AlioItem | null {
  const title = g(r, "facltNa");
  if (!title) return null;
  const tags = [
    r.resvYn === "Y" ? "예약 가능" : null,
    g(r, "payYnNa"), g(r, "inOutGbNa"),
  ].filter((x): x is string => !!x);
  return {
    id: `${g(r, "apbaNa") ?? ""}|${title}|${g(r, "address") ?? ""}`,
    title, org: g(r, "apbaNa"), cate: g(r, "cateNaPath"),
    target: g(r, "guideTar"), desc: g(r, "guideDsc"), address: g(r, "address"),
    start: null, end: null, url: g(r, "siteUrl"), tags,
  };
}

export const dot = (s: string | null) => (s ? s.replaceAll("-", ".") : null);
