// 병렬로 바꾼 걷기가 순서·커서·중단을 제대로 지키는지, 실제 로직을 흉내 내 확인한다.
// (코드 그대로는 못 돌리니 같은 규칙을 옮겨 적고 여러 상황을 먹인다.)
const CONC = 4;

function walk({ pages, start, fetchPage }) {
  let page = start, read = 0, stop = false, ended = false;
  let prevFirst = null, saved = 0;
  const seenPages = [];
  while (read < pages && !stop) {
    const batch = [];
    for (let k = 0; k < CONC && read + k < pages; k++) batch.push(page + k);
    const got = batch.map((pg) => ({ pg, r: fetchPage(pg) }));
    for (const { pg, r } of got) {
      if (stop) break;
      read++;
      if (!r.ok) { if (/목록 줄/.test(r.reason)) ended = true; stop = true; break; }
      const first = r.jobs[0];
      if (prevFirst !== null && first === prevFirst) { stop = true; break; }
      prevFirst = first;
      seenPages.push(pg); saved += r.jobs.length;
      page = pg + 1;
    }
  }
  return { nextPage: page, seenPages, saved, ended };
}

const ok = (pg) => ({ ok: true, jobs: [`p${pg}a`, `p${pg}b`] });
const t = [];
// 1. 평범하게 10쪽
t.push(["10쪽 순서대로", walk({ pages: 10, start: 1, fetchPage: ok }),
  { nextPage: 11, saved: 20, pages: [1,2,3,4,5,6,7,8,9,10] }]);
// 2. 배치 한가운데서 실패 → 그 쪽에서 멈추고 뒤 쪽은 버린다
t.push(["6쪽에서 실패", walk({ pages: 10, start: 5, fetchPage: (pg) => pg === 6 ? { ok: false, reason: "응답 500" } : ok(pg) }),
  { nextPage: 6, saved: 2, pages: [5] }]);
// 3. 끝을 지남
t.push(["8쪽이 끝", walk({ pages: 10, start: 5, fetchPage: (pg) => pg >= 8 ? { ok: false, reason: "목록 줄을 못 찾았습니다" } : ok(pg) }),
  { nextPage: 8, saved: 6, pages: [5,6,7], ended: true }]);
// 4. 쪽 넘김이 안 됨 (늘 같은 내용)
t.push(["쪽 넘김 안 됨", walk({ pages: 10, start: 1, fetchPage: () => ({ ok: true, jobs: ["same"] }) }),
  { nextPage: 2, saved: 1, pages: [1] }]);
// 5. 커서가 깊은 곳에서 이어 걷기
t.push(["4696쪽부터 6쪽", walk({ pages: 6, start: 4696, fetchPage: ok }),
  { nextPage: 4702, saved: 12, pages: [4696,4697,4698,4699,4700,4701] }]);

let bad = 0;
for (const [name, got, want] of t) {
  const okAll = got.nextPage === want.nextPage && got.saved === want.saved
    && JSON.stringify(got.seenPages) === JSON.stringify(want.pages)
    && (want.ended === undefined || got.ended === want.ended);
  if (!okAll) { bad++; console.log("FAIL", name, JSON.stringify(got), "want", JSON.stringify(want)); }
}
console.log(bad === 0 ? `걷기 규칙 OK — ${t.length}가지 모두 통과` : `${bad}가지 실패`);
process.exit(bad ? 1 : 0);
