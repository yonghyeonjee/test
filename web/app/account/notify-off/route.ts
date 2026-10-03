import { NextResponse } from "next/server";
import { verifyUnsub } from "@/lib/notify";
import { svcConfigured, svcDb } from "@/lib/svcDb";

/** 메일의 "그만 받기" 링크. 서명이 맞으면 알림 동의를 끄고 연락처를 지운 뒤 내 계정으로 보낸다. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const device = verifyUnsub(url.searchParams.get("t"));
  if (!device || !svcConfigured()) return NextResponse.redirect(new URL("/account?off=bad", req.url));
  await svcDb().rpc("account_update_contact", { p_device: device, p_name: null, p_phone: null, p_email: null, p_consent: false });
  return NextResponse.redirect(new URL("/account?off=1", req.url));
}
