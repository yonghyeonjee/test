import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { allowed, fetchText, links } from "@/lib/orgCrawl";

/**
 * 새 수집처를 서울 서버에서 살펴본다(정부 누리집 다수가 외국 IP 를 막아 GitHub Actions 에서는 안 열린다).
 * ?url=… (쉼표로 여럿). 공공 누리집·공공데이터 API 만. 주소에 {KEY} 를 쓰면 서버의 공공데이터 키로 바꾸고,
 * 응답에서는 다시 가린다. CRON_SECRET 또는 관리자만.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OK_HOST = /(^|\.)(go\.kr|or\.kr|re\.kr|ac\.kr|data\.go\.kr)$/;
const DATE = /(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!(secret && auth === `Bearer ${secret}`) && !isLoggedIn()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.DATA_GO_KR_KEY ?? "";
  const snipKey = new URL(req.url).searchParams.get("snip");
  // ?grep=정규식: 맞는 자리마다 앞뒤 160자(최대 8곳). 스크립트 함수 정의처럼 "어디 있는지 모르는 것" 을 찾을 때.
  const grepRaw = new URL(req.url).searchParams.get("grep");
  let grep: RegExp | null = null;
  try { grep = grepRaw ? new RegExp(grepRaw, "g") : null; } catch { grep = null; }
  const raw = (new URL(req.url).searchParams.get("url") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const out = [];
  for (const u0 of raw) {
    let host = "";
    try { host = new URL(u0.replace("{KEY}", "x")).hostname; } catch { out.push({ url: u0, error: "bad url" }); continue; }
    if (!OK_HOST.test(host)) { out.push({ url: u0, error: "허용하지 않는 호스트" }); continue; }
    const u = u0.replace("{KEY}", encodeURIComponent(key));
    const isApi = host === "apis.data.go.kr";
    const robots = isApi ? null : await allowed(u);
    const r = await fetchText(u, 20_000);
    const mask = (s: string) => (key ? s.split(key).join("***").split(encodeURIComponent(key)).join("***") : s);
    const text = r.text;
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1]?.trim().slice(0, 100) ?? null;
    const ls = /<html|<body/i.test(text.slice(0, 3000)) ? links(text, r.url, true) : [];
    const dated = ls.map((l, i) => {
      const next = ls[i + 1]?.at ?? text.length;
      const d = DATE.exec(text.slice(l.end, Math.min(next, l.end + 400)).replace(/<[^>]+>/g, " "));
      return { t: l.text.slice(0, 70), h: l.js ? "(js)" : l.href.slice(0, 120), d: d?.[0] ?? null };
    }).filter((x) => x.t.length >= 8);
    out.push({
      url: mask(u0), status: r.status, final: mask(r.url), len: text.length, robots, title,
      links: ls.length, datedLinks: dated.filter((x) => x.d).length,
      sample: (dated.filter((x) => x.d).length ? dated.filter((x) => x.d) : dated).slice(0, 12),
      calls: Array.from(new Set(text.match(/["'](\/[\w/\-]+\.(?:do|json|jsp|ajax))/g) ?? [])).slice(0, 20),
      head: ls.length ? undefined : mask(text.slice(0, 1500)),
      // ?snip=낱말: 그 낱말이 처음 나온 곳 앞뒤 HTML(목록 줄 구조를 볼 때).
      snip: snipKey && text.includes(snipKey)
        ? mask(text.slice(Math.max(0, text.indexOf(snipKey) - 1200), text.indexOf(snipKey) + 1800)) : undefined,
      grep: grep
        ? Array.from(text.matchAll(grep)).slice(0, 8).map((m) =>
            mask(text.slice(Math.max(0, m.index! - 160), m.index! + 400).replace(/\s+/g, " ")))
        : undefined,
      // 바깥 스크립트 전부. 함수가 여기 들어 있으면 그 주소를 다시 살펴본다.
      scripts: grep ? Array.from(text.matchAll(/<script[^>]+src=["']([^"']+)/gi)).map((m) => m[1]).slice(0, 30) : undefined,
    });
  }
  return NextResponse.json({ at: new Date().toISOString(), out });
}
