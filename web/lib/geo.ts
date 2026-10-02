import { SGG_POINT, SIDO_POINT } from "./geoData";

/**
 * 지도에 놓을 자리.
 *
 * 공고에는 주소가 없다. 있는 것은 시·도와 시·군·구 이름뿐이라, 그 구역의
 * 가운데에 놓는다(lib/geoData.ts). 그래서 거리는 늘 "시·군·구 중심 기준
 * 직선거리"다 — 청사까지의 길 거리가 아니다. 화면도 그렇게 적는다.
 *
 * 채용 공고는 지역이 시·도까지만 있고 그마저 비어 있는 것이 많다. 기관명과
 * 제목에서 시·군·구 이름을 찾아 쓴다("인천광역시 연수구" → 연수구).
 */
export type LatLng = [number, number];

export type Place = {
  sido: string;
  sigungu: string | null;
  lat: number;
  lng: number;
  /** 시·군·구를 못 찾아 시·도 가운데에 둔 것. 화면에 "시·도 기준"이라 적는다. */
  approx: boolean;
  /** "경기 시흥시", "서울" */
  label: string;
};

export const SIDO_SHORT: Record<string, string> = {
  서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천", 대전광역시: "대전",
  울산광역시: "울산", 세종특별자치시: "세종", 경기도: "경기", 강원특별자치도: "강원", 충청북도: "충북",
  충청남도: "충남", 전북특별자치도: "전북", 경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주",
  전남광주통합특별시: "전남·광주",
};

/** 옛 이름·줄임말 → 지금 시·도 이름. 채용 공고의 region 은 옛 이름(전라남도·광주광역시)으로 온다. */
const SIDO_ALIAS: [RegExp, string][] = [
  [/^서울/, "서울특별시"], [/^부산/, "부산광역시"], [/^대구/, "대구광역시"], [/^인천/, "인천광역시"],
  [/^대전/, "대전광역시"], [/^울산/, "울산광역시"], [/^세종/, "세종특별자치시"], [/^경기/, "경기도"],
  [/^강원/, "강원특별자치도"], [/^충청북|^충북/, "충청북도"], [/^충청남|^충남/, "충청남도"],
  [/^전라북|^전북/, "전북특별자치도"], [/^경상북|^경북/, "경상북도"], [/^경상남|^경남/, "경상남도"],
  [/^제주/, "제주특별자치도"], [/^광주|^전라남|^전남/, "전남광주통합특별시"],
];

export function normSido(s?: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  // "경기@대전" 처럼 여러 시·도에 걸친 공고는 자리가 없다 — 전국 공통으로 본다.
  if (!t || t.includes("@")) return null;
  if (SIDO_POINT[t]) return t;
  for (const [re, name] of SIDO_ALIAS) if (re.test(t)) return name;
  return null;
}

/** 자료에 있는 이름이 좌표표(2018 경계)와 다른 것. */
const SGG_ALIAS: Record<string, Record<string, string>> = {
  인천광역시: { 미추홀구: "남구" },
};

function sggPoint(sido: string, sigungu: string): LatLng | null {
  const table = SGG_POINT[sido];
  if (!table) return null;
  const alias = SGG_ALIAS[sido]?.[sigungu];
  return table[sigungu] ?? (alias ? table[alias] : undefined) ?? null;
}

/** 시·도와 시·군·구 이름으로 자리를 찾는다. 시·도도 모르면 null — 전국 공통 사업. */
export function locate(sido?: string | null, sigungu?: string | null): Place | null {
  const s = normSido(sido);
  if (!s) return null;
  const g = (sigungu ?? "").trim();
  const pt = g ? sggPoint(s, g) : null;
  if (pt) return { sido: s, sigungu: g, lat: pt[0], lng: pt[1], approx: false, label: `${SIDO_SHORT[s]} ${g}` };
  const [lat, lng] = SIDO_POINT[s];
  return { sido: s, sigungu: null, lat, lng, approx: true, label: SIDO_SHORT[s] };
}

/** 두 점 사이 직선거리(km). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLng = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const fmtKm = (km: number) => (km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`);

// ── 글에서 시·군·구 찾기 (채용 공고) ────────────────────────

type Hit = { sido: string; name: string };

/**
 * 줄기(시·군·구를 뗀 이름)가 다른 뜻으로도 흔히 쓰이는 것. 이런 줄기는
 * 뒤에 시·군·구·청·대학교 같은 말이 따라올 때만 지명으로 본다.
 * "영양관리" 는 영양군이 아니고 "역량 강화" 는 강화군이 아니다.
 */
const RISKY = new Set([
  "영양", "고령", "영광", "진도", "상주", "음성", "부여", "예산", "수영", "강화", "연수", "사상", "인제",
  "동해", "남해", "달성", "장수", "완주", "공주", "광명", "동작", "정선", "영동", "성주", "순창", "구리",
  "양산", "화성", "평창", "하동", "의성", "광주", "고성", "진주", "성동", "중랑", "강남", "강서", "기장",
]);
/** 줄기 뒤에 이것이 오면 지명이다. */
const AFTER = /^(시|군|구|청|지원|지청|지사|지부|우체국|대학교|대학|보건소|경찰서|소방서|교육지원청|의료원|세무서|등기소|법원|검찰청|공단|공사|병원|시설관리|도시|문화재단|복지재단|복지관)/;

const INDEX: { token: string; hits: Hit[]; stem: boolean }[] = (() => {
  const m = new Map<string, { hits: Hit[]; stem: boolean }>();
  const add = (token: string, hit: Hit, stem: boolean) => {
    const cur = m.get(token) ?? { hits: [], stem };
    if (!cur.hits.some((h) => h.sido === hit.sido && h.name === hit.name)) cur.hits.push(hit);
    m.set(token, cur);
  };
  for (const [sido, table] of Object.entries(SGG_POINT)) {
    for (const name of Object.keys(table)) {
      add(name, { sido, name }, false);
      const stem = name.replace(/(시|군|구)$/, "");
      if (stem.length >= 2 && stem !== name) add(stem, { sido, name }, true);
    }
  }
  // 긴 이름부터 — "남양주" 를 "양주" 보다 먼저.
  return [...m.entries()].map(([token, v]) => ({ token, ...v })).sort((a, b) => b.token.length - a.token.length);
})();

/** 글에 적힌 시·도. "광주" 는 경기 광주시와 헷갈려 "광주광역시" 로 적힌 것만 본다. */
const SIDO_IN_TEXT: [RegExp, string][] = [
  [/서울특별시|서울시/, "서울특별시"], [/부산광역시|부산시/, "부산광역시"], [/대구광역시|대구시/, "대구광역시"],
  [/인천광역시|인천시/, "인천광역시"], [/대전광역시|대전시/, "대전광역시"], [/울산광역시|울산시/, "울산광역시"],
  [/세종특별자치시|세종시/, "세종특별자치시"], [/경기도/, "경기도"], [/강원특별자치도|강원도/, "강원특별자치도"],
  [/충청북도|충북/, "충청북도"], [/충청남도|충남/, "충청남도"], [/전북특별자치도|전라북도|전북/, "전북특별자치도"],
  [/경상북도|경북/, "경상북도"], [/경상남도|경남/, "경상남도"], [/제주특별자치도|제주도/, "제주특별자치도"],
  [/전남광주통합특별시|광주광역시|전라남도|전남/, "전남광주통합특별시"],
];

export function sidoInText(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const [re, name] of SIDO_IN_TEXT) if (re.test(text)) return name;
  return null;
}

/** 글에서 시·군·구 하나. hint(시·도)가 있으면 그 안에서 먼저 찾고, 같은 이름이 여럿이면 hint 없이는 고르지 않는다. */
export function findSgg(text: string | null | undefined, hint: string | null): Hit | null {
  if (!text) return null;
  const t = text;
  for (const { token, hits, stem } of INDEX) {
    let from = 0;
    while (from < t.length) {
      const i = t.indexOf(token, from);
      if (i < 0) break;
      from = i + token.length;
      if (stem) {
        const after = t.slice(i + token.length);
        const bounded = after === "" || /^[\s,.·()\[\]/-]/.test(after) || AFTER.test(after);
        if (!bounded) continue;
        if (RISKY.has(token) && !AFTER.test(after)) continue;
      }
      const picked = hint ? hits.find((h) => h.sido === hint) : null;
      if (picked) return picked;
      if (hits.length === 1 && (!hint || hits[0].sido === hint)) return hits[0];
      if (hits.length === 1 && hint && hits[0].sido !== hint) {
        // 시·도 힌트와 어긋난다. "경기도교육청 ○○초등학교" 제목에 다른 지역이 적히는 일은 드물지만,
        // 틀린 자리에 놓는 것보다 시·도 가운데가 낫다. 다음 후보를 본다.
        continue;
      }
      // 같은 이름이 여러 시·도에(중구·남구…). 힌트 없이는 못 고른다.
    }
    // 잡힌 것이 없을 때만 다음 토큰. 잡혔으면 위에서 돌려줬다.
  }
  return null;
}

/**
 * 시·군·구가 비어 있는 공고의 담당 부서·기관 이름에서 시·군·구를 찾는다.
 *
 * "전북특별자치도 군산시 복지환경국 아동정책과" 처럼 부서 이름은 띄어쓰기로 갈린 말
 * 마디라, 마디 하나가 그 시·도의 시·군·구 이름(또는 "군산시청")과 똑같을 때만 쓴다.
 * 둘 이상 걸리면(드물다) 고르지 않는다 — 틀린 동네에 꽂느니 시·도 전역이 낫다.
 */
export function sggFromDept(sido: string | null, ...texts: (string | null | undefined)[]): string | null {
  const s = normSido(sido);
  const table = s ? SGG_POINT[s] : null;
  if (!s || !table) return null;
  const found = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const raw of t.split(/[\s,()\[\]/·]+/)) {
      const tok = raw.replace(/청$/, "");
      if (tok.length >= 2 && table[tok]) found.add(tok);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

/** 채용 공고의 자리. 기관명 → 제목 순으로 시·군·구를 찾고, 없으면 시·도 가운데. */
export function locateJob(job: { org: string | null; title: string; region?: string | null }): Place | null {
  const hint = normSido(job.region) ?? sidoInText(job.org) ?? sidoInText(job.title);
  const hit = findSgg(job.org, hint) ?? findSgg(job.title, hint);
  if (hit) return locate(hit.sido, hit.name);
  return hint ? locate(hint, null) : null;
}

/** 지도 앱으로 길찾기. 좌표가 아니라 이름으로 찾게 한다 — 우리 좌표는 구역 가운데라 길찾기에 쓰면 엉뚱한 곳에 데려다 준다. */
export function mapLinks(query: string) {
  const q = encodeURIComponent(query);
  return {
    kakao: `https://map.kakao.com/link/search/${q}`,
    naver: `https://map.naver.com/p/search/${q}`,
  };
}
