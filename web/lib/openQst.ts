/**
 * 한국산업인력공단 국가자격 공개문제 조회 서비스.
 *
 *   End Point  https://apis.data.go.kr/B490007/openQst
 *   /getOpenQstList  목록 — 게시물 아이디, 제목, 자격구분, 계열, 종목
 *   /getOpenQst      상세 — 제목, 내용, 자격구분, 계열, 종목, 첨부파일 URL
 *
 * 중요한 것 하나: 이 API 가 주는 "문제" 는 첨부파일이다. 문항·보기·정답이
 * 항목으로 오는 것이 아니라 시험지 파일(대개 PDF)의 주소가 온다. 그래서
 * 이것만으로는 풀고 채점하는 CBT 를 만들 수 없다. 만들려면 파일을 사람이
 * 옮겨 적어야 한다 — 지어내면 안 되는 자료다.
 *
 * 파라미터 이름은 문서에 한글 설명만 있고 영문 키가 없었다. 짐작해서 짜면
 * 지난번처럼 틀린다. 그래서 먼저 탐침으로 실제 응답을 찍어 보고, 거기서
 * 읽은 이름으로 수집기를 짠다.
 */

const BASE = "https://apis.data.go.kr/B490007/openQst";

const TIMEOUT_MS = Number(process.env.OPENAPI_TIMEOUT_MS ?? 8000);

export type Probe = {
  step: string;
  ok: boolean;
  detail: string;
  ms: number;
};

function key() {
  const k = process.env.DATA_GO_KR_KEY;
  if (!k) throw new Error("DATA_GO_KR_KEY 가 설정되지 않았습니다.");
  return k;
}

async function get(url: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, ms: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false, status: 0, text: "",
      ms: Date.now() - t0,
      err: e instanceof Error
        ? e.name === "TimeoutError" ? `${TIMEOUT_MS / 1000}초 안에 응답 없음` : `${e.name}: ${e.message}`
        : String(e),
    };
  }
}

/** 응답에서 항목 이름만 훑어 준다. 값이 길면 잘라 낸다. */
function outline(text: string) {
  try {
    const j = JSON.parse(text);
    const seen = new Set<string>();
    const walk = (v: unknown, path: string, depth: number) => {
      if (depth > 5 || v === null) return;
      if (Array.isArray(v)) return walk(v[0], `${path}[]`, depth + 1);
      if (typeof v === "object") {
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, `${path}.${k}`, depth + 1);
        return;
      }
      const s = String(v);
      seen.add(`${path} = ${s.length > 60 ? `${s.slice(0, 60)}…` : s}`);
    };
    walk(j, "", 0);
    return [...seen].join("\n");
  } catch {
    // XML 로 왔거나 오류 문구다. 그대로 앞부분만 보여 준다.
    return text.replace(/\s+/g, " ").slice(0, 1200);
  }
}

/**
 * 이름을 모르니 흔한 것을 하나씩 대 본다.
 *
 * 공공데이터포털 API 는 대개 serviceKey·pageNo·numOfRows·_type 을 쓴다.
 * 그것만으로 목록이 오는지 먼저 보고, 오면 자격구분·종목 파라미터를
 * 응답 항목 이름에서 거꾸로 읽는다.
 */
export async function probeOpenQst(): Promise<Probe[]> {
  const out: Probe[] = [];
  const k = encodeURIComponent(key());

  const tries: { step: string; qs: string }[] = [
    { step: "목록 · 기본", qs: `serviceKey=${k}&pageNo=1&numOfRows=5&_type=json` },
    { step: "목록 · XML", qs: `serviceKey=${k}&pageNo=1&numOfRows=5` },
    { step: "목록 · 국가기술자격", qs: `serviceKey=${k}&pageNo=1&numOfRows=5&_type=json&qualgbCd=T` },
    { step: "목록 · 종목 이름", qs: `serviceKey=${k}&pageNo=1&numOfRows=5&_type=json&jmNm=${encodeURIComponent("정보처리기사")}` },
  ];

  for (const t of tries) {
    const r = await get(`${BASE}/getOpenQstList?${t.qs}`);
    out.push({
      step: t.step,
      ok: r.ok && !/errMsg|OpenAPI_ServiceResponse|SERVICE ERROR/i.test(r.text),
      detail: "err" in r ? r.err! : `응답 ${r.status}\n${outline(r.text)}`,
      ms: r.ms,
    });
    // 하나라도 제대로 오면 나머지는 굳이 두드리지 않는다.
    if (out.at(-1)!.ok) break;
  }
  return out;
}
