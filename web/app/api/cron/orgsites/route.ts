import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { alioStep } from "@/lib/alioJobs";
import { crawlStep, discoverStep, ingestItems, jsBoards, seedStep, tidyStep } from "@/lib/orgCrawl";

/**
 * 기관 홈페이지 공고 수집(lib/orgCrawl). 서울 서버에서 돈다 — 외국 IP 를 막는 정부 누리집이 있다.
 * ?step=seed     홈페이지 주소 채우기(위키데이터)
 * ?step=discover 홈페이지 메뉴에서 채용·공지 게시판 찾기
 * ?step=crawl    게시판 첫 쪽의 제목·링크·날짜
 * ?step=tidy     예전 판독이 남긴 지저분한 제목 지우기
 * ?step=alio     잡알리오 새 공고(이미 있는 쪽을 만나면 멈춤) · alio_full 은 끝까지
 * ?step=jsboards HTML 로는 글을 못 읽은 게시판 목록(Playwright 가 받아 간다)
 * POST          Playwright 가 브라우저로 읽은 글 {org, kind, board, items}
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
  if (step === "jsboards") return NextResponse.json({ boards: await jsBoards() });
  try {
    const r = step === "seed" ? await seedStep() : step === "discover" ? await discoverStep() : step === "crawl" ? await crawlStep() : step === "tidy" ? await tidyStep()
      : step === "alio" ? await alioStep("new") : step === "alio_full" ? await alioStep("full") : null;
    if (!r) return NextResponse.json({ error: `모르는 step: ${step}` }, { status: 400 });
    return NextResponse.json({ at: new Date().toISOString(), ...r });
  } catch (e) {
    return NextResponse.json({ step, error: e instanceof Error ? e.message : String(e), more: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!(secret && auth === `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Parameters<typeof ingestItems>[0];
    return NextResponse.json(await ingestItems(body));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
