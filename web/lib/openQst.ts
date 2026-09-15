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

/** 값 가운데 파일 주소로 보이는 것을 찾는다. 항목 이름을 모르니 값으로 찾는다. */
function findFileUrls(v: unknown, out: string[] = []): string[] {
  if (out.length >= 5 || v === null || v === undefined) return out;
  if (Array.isArray(v)) {
    for (const x of v) findFileUrls(x, out);
    return out;
  }
  if (typeof v === "object") {
    for (const x of Object.values(v as Record<string, unknown>)) findFileUrls(x, out);
    return out;
  }
  const s = String(v);
  if (/^https?:\/\//.test(s) && !out.includes(s)) out.push(s);
  return out;
}

/** 값 가운데 게시물 아이디로 보이는 것. 숫자만으로 된 짧은 값. */
function findIds(v: unknown, out: string[] = []): string[] {
  if (out.length >= 3 || v === null || v === undefined) return out;
  if (Array.isArray(v)) {
    for (const x of v) findIds(x, out);
    return out;
  }
  if (typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (/id$|no$|seq$/i.test(k) && (typeof x === "string" || typeof x === "number")) {
        const s = String(x);
        if (/^\d{1,12}$/.test(s) && !out.includes(s)) out.push(s);
      }
      findIds(x, out);
    }
  }
  return out;
}

/**
 * 목록 → 상세 → 첨부파일 → 글자까지 끝까지 가 본다.
 *
 * 알고 싶은 것은 하나다. 저 첨부파일에서 문항과 정답을 뽑아낼 수 있나?
 * 못 뽑으면 문제 은행을 만들 수 없고, 그러면 CBT 도 없다. 그래서 한 번에
 * 끝까지 가서 실제 글자를 찍어 본다.
 *
 * 파라미터 이름은 문서에 한글 설명뿐이라 흔한 조합을 하나씩 대 본다.
 * 하나라도 제대로 오면 거기서 멈추고, 응답에서 이름을 읽어 다음 단계로
 * 넘어간다.
 */
export async function probeOpenQst(): Promise<Probe[]> {
  const out: Probe[] = [];
  const k = encodeURIComponent(key());

  // ── 1. 목록 ────────────────────────────────────────────
  const tries: { step: string; qs: string }[] = [
    { step: "목록 · 기본", qs: `serviceKey=${k}&pageNo=1&numOfRows=5&_type=json` },
    { step: "목록 · 국가기술자격", qs: `serviceKey=${k}&pageNo=1&numOfRows=5&_type=json&qualgbCd=T` },
    { step: "목록 · XML", qs: `serviceKey=${k}&pageNo=1&numOfRows=5` },
  ];

  let listText = "";
  for (const t of tries) {
    const r = await get(`${BASE}/getOpenQstList?${t.qs}`);
    const bad = !r.ok || /errMsg|SERVICE ERROR|SERVICE_KEY|LIMITED_NUMBER/i.test(r.text);
    out.push({
      step: t.step,
      ok: !bad,
      detail: "err" in r ? r.err! : `응답 ${r.status}\n${outline(r.text)}`,
      ms: r.ms,
    });
    if (!bad) { listText = r.text; break; }
  }
  if (!listText) return out;

  // ── 2. 상세 ────────────────────────────────────────────
  let parsed: unknown = null;
  try { parsed = JSON.parse(listText); } catch { /* XML 이면 아이디를 못 찾는다 */ }
  const ids = parsed ? findIds(parsed) : [];
  if (!ids.length) {
    out.push({ step: "상세", ok: false, detail: "목록에서 게시물 아이디로 보이는 값을 못 찾았습니다. 위 항목 이름을 보고 알려 주세요.", ms: 0 });
    return out;
  }

  let fileUrl = "";
  for (const id of ids.slice(0, 2)) {
    const r = await get(`${BASE}/getOpenQst?serviceKey=${k}&_type=json&openQstId=${id}`);
    const bad = !r.ok || /errMsg|SERVICE ERROR/i.test(r.text);
    out.push({
      step: `상세 · 아이디 ${id}`,
      ok: !bad,
      detail: "err" in r ? r.err! : `응답 ${r.status}\n${outline(r.text)}`,
      ms: r.ms,
    });
    if (bad) continue;
    try {
      const urls = findFileUrls(JSON.parse(r.text)).filter((u) => !u.includes("data.go.kr/openapi"));
      if (urls.length) { fileUrl = urls[0]; break; }
    } catch { /* 무시 */ }
  }
  if (!fileUrl) {
    out.push({ step: "첨부파일", ok: false, detail: "상세 응답에서 파일 주소를 못 찾았습니다.", ms: 0 });
    return out;
  }

  // ── 3. 파일 받기 ──────────────────────────────────────
  const t0 = Date.now();
  let buf: Uint8Array | null = null;
  let ctype = "";
  try {
    const res = await fetch(fileUrl, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    ctype = res.headers.get("content-type") ?? "";
    buf = new Uint8Array(await res.arrayBuffer());
    out.push({
      step: "첨부파일 받기",
      ok: res.ok && buf.byteLength > 0,
      detail: `${fileUrl}\n${res.status} · ${ctype} · ${(buf.byteLength / 1024).toFixed(0)} KB`,
      ms: Date.now() - t0,
    });
  } catch (e) {
    out.push({ step: "첨부파일 받기", ok: false, detail: `${fileUrl}\n${e instanceof Error ? e.message : String(e)}`, ms: Date.now() - t0 });
    return out;
  }

  // ── 4. 글자 뽑기 ──────────────────────────────────────
  const head = String.fromCharCode(...buf.slice(0, 4));
  if (head !== "%PDF") {
    out.push({
      step: "글자 뽑기",
      ok: false,
      detail: `PDF 가 아닙니다(앞 네 글자 "${head}"). 한글(HWP)이면 따로 다뤄야 합니다.`,
      ms: 0,
    });
    return out;
  }

  const t1 = Date.now();
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(buf);
    const { totalPages, text } = await extractText(doc, { mergePages: true });
    const body = String(text).replace(/\s+/g, " ").trim();
    // 정답이 파일 안에 있는지가 갈림길이다. 있으면 문제 은행을 만들 수 있고,
    // 없으면 문제만 있고 채점을 못 한다.
    const hasAnswer = /정\s*답|answer/i.test(body);
    out.push({
      step: "글자 뽑기",
      ok: body.length > 100,
      detail:
        `${totalPages}쪽 · 글자 ${body.length.toLocaleString()}자\n` +
        `정답 표시 ${hasAnswer ? "있음" : "안 보임"}\n\n` +
        `${body.slice(0, 1500)}`,
      ms: Date.now() - t1,
    });
  } catch (e) {
    out.push({ step: "글자 뽑기", ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t1 });
  }
  return out;
}
