"use client";

import { useEffect } from "react";
import { writeMe } from "@/lib/me";

/** 조건을 넣고 결과를 본 순간, 그 조건을 이 브라우저에 적어 둔다. 화면에는 아무것도 없다. */
export default function RememberMe({
  sido, sigungu, age, emp, hh,
}: { sido?: string; sigungu?: string; age?: number; emp?: string; hh?: string[] }) {
  useEffect(() => {
    if (!sido && !age) return;
    writeMe({ sido, sigungu, age, emp, hh: hh?.length ? hh : undefined });
  }, [sido, sigungu, age, emp, hh]);
  return null;
}
