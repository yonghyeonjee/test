"use client";

import { useEffect } from "react";
import { pushRecent, type Recent } from "@/lib/me";

/** 상세를 열면 "최근 본" 목록에 적는다. 화면에는 아무것도 없다. */
export default function RecentTracker({ kind, id, title, sub }: Omit<Recent, "at">) {
  useEffect(() => {
    pushRecent({ kind, id, title, sub });
  }, [kind, id, title, sub]);
  return null;
}
