import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { crawlStep, discoverStep, seedStep, tidyStep } from "@/lib/orgCrawl";

/**
 * 기관 홈페이지 공고 수집(lib/orgCrawl). 서울 서버에서 돈다 — 외국 IP 를 막는 정부 누리집이 있다.
 * ?step=seed     홈페이지 주소 채우기(위키데이터)
 * ?step=discover 홈페이지 메뉴에서 채용·공지 게시판 찾기
 * ?step=crawl    게시판 첫 쪽의 제목·링크·날짜
 * ?step=tidy     예전 판독이 남긴 지저분한 제목 지우기
 * 응답의 more 가 true 면 남은 것이 있다. 부르는 쪽(GitHub Actions)이 다시 부른다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!(secret && auth === `Bearer ${secret}`) && !isLoggedIn()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const step = new URL(req.url).searchParams.get("step") ?? "crawl";
  try {
    const r = step === "seed" ? await seedStep() : step === "discover" ? await discoverStep() : step === "crawl" ? await crawlStep() : step === "tidy" ? await tidyStep() : null;
    if (!r) return NextResponse.json({ error: `모르는 step: ${step}` }, { status: 400 });
    return NextResponse.json({ at: new Date().toISOString(), ...r });
  } catch (e) {
    return NextResponse.json({ step, error: e instanceof Error ? e.message : String(e), more: false }, { status: 500 });
  }
}
