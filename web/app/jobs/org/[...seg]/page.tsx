import type { Metadata } from "next";
import { IllusJobs } from "@/components/Illus";
import { withOg } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdSlot from "@/components/AdSlot";
import GuideBanner from "@/components/GuideBanner";
import JobList from "@/components/JobList";
import JsonLd from "@/components/JsonLd";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { YearBars } from "@/components/TrendBars";
import { getOrgPosts, getOrgTrend, indexWord, pctChange, titleMix, type OrgPost } from "@/lib/jobTrend";
import { dot, getJobsByOrg, getOrgStat, peakMonths } from "@/lib/pubJobs";
import { jobCanonical, jobPath, jobRobots, jobRouteLabel, peekJobRoute, readJobRoute } from "@/lib/jobRoute";
import { jobsRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";

// /jobs/org/법무부 · /jobs/org/법무부/hire/국가/page/2
// 세 시간. 조합이 수천 개라 15분마다 새로 그리면 캐시 저장(ISR Writes)이 크게 쌓였다. 채용은 하루 다섯 번 모은다.
export const revalidate = 10800;

type P = { params: { seg: string[] } };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const r = peekJobRoute(["org"], params.seg);
  const org = r.org!;
  const stat = await getOrgStat(org);
  const span = stat?.firstReg && stat.lastReg
    ? `${stat.firstReg.slice(0, 4)}년부터 ${stat.n.toLocaleString()}건`
    : "지금까지 올라온 공고";
  const extra = jobRouteLabel(r).filter((v) => v !== org);
  const tail = r.page > 1 ? ` (${r.page}쪽)` : "";
  return withOg({
    title: `${org} 채용 공고${extra.length ? ` — ${extra.join(" · ")}` : " — 지금까지 낸 공고와 접수 기간"}${tail}`,
    description:
      `${org}이(가) 나라일터에 낸 채용 공고를 모았습니다. ${span}을 등록일순으로 보고, ` +
      "접수 중인 공고와 접수 기간이 며칠이었는지를 함께 확인합니다.",
    keywords: [`${org} 채용`, `${org} 채용공고`, `${org} 공고`, "공공기관 채용", "나라일터"],
    alternates: { canonical: jobCanonical(r) },
    robots: jobRobots(r),
  });
}

/** 열두 달 막대. 값이 아니라 모양을 보여 주는 것이라 눈금은 두지 않는다. */
function MonthBars({ months }: { months: number[] }) {
  const max = Math.max(1, ...months);
  return (
    <div className="mt-3 flex items-end gap-1" aria-hidden="true">
      {months.map((n, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-brand/70"
               style={{ height: `${Math.max(2, Math.round((n / max) * 44))}px` }} />
          <span className="text-[12px] text-faint">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default async function JobsByOrg({ params }: P) {
  const route = readJobRoute(["org"], params.seg);
  if (!route) notFound();
  const org = route.org!;
  const [board, stat, trend, own] = await Promise.all([getJobsByOrg(org), getOrgStat(org), getOrgTrend(org), getOrgPosts(org)]);
  if (!stat && !board.jobs.length) notFound();
  // 공고가 있는 기관인데 목록만 못 읽었으면 잠깐 DB 가 늦은 것이다. 이 그림을 세 시간 동안
  // 캐시에 남기지 않게 던진다. 다시 그리는 중이면 Next 가 이전에 그린 쪽을 계속 보인다.
  if (stat && stat.n > 0 && !board.ok) throw new Error(`기관 공고 목록을 읽지 못했습니다: ${org}`);

  const mix = titleMix(board.jobs.map((j) => j.title), org);
  const yoy = trend ? pctChange(trend.n12, trend.p12) : null;
  // 밖에서 찾을 때는 기관 이름 앞쪽만. "부산광역시교육청 …학교채용지원팀" 을 통째로 넣으면 아무것도 안 걸린다.
  const shortOrg = org.split(/\s+/)[0];
  const enc = encodeURIComponent;
  const outLinks: [string, string, string][] = [
    ["잡코리아", `${shortOrg} 합격 자소서`, `https://www.jobkorea.co.kr/starter/passassay?schTxt=${enc(shortOrg)}`],
    ["사람인", `${shortOrg} 자기소개서`, `https://www.saramin.co.kr/zf_user/search?searchword=${enc(`${shortOrg} 자기소개서`)}`],
    ["사람인", `${shortOrg} 기업 정보·후기`, `https://www.saramin.co.kr/zf_user/search/company?searchword=${enc(shortOrg)}`],
    ["잡코리아", `${shortOrg} 채용`, `https://www.jobkorea.co.kr/Search/?stext=${enc(shortOrg)}`],
  ];

  const peak = stat ? peakMonths(stat.months) : null;

  return (
    <div className="pb-4">
      <PageBanner tone="blue"
        eyebrow="채용 · 기관별"
        title={org}
        sub={`${org}이(가) 나라일터에 낸 채용 공고입니다. 접수 중인 것이 앞에 오고, 그 뒤로 지난 공고가 등록일순으로 이어집니다.`}
        art={<IllusJobs />}
      >
        {stat && (
          <p className="num mt-4 text-sm text-muted">
            공고 {stat.n.toLocaleString()}건
            {stat.openN > 0 && ` · 접수 중 ${stat.openN}건`}
            {stat.firstReg && stat.lastReg && ` · ${dot(stat.firstReg)}~${dot(stat.lastReg)}`}
          </p>
        )}
      </PageBanner>

      <JsonLd
        data={pageGraph({
          path: jobPath(route),
          name: `${org} 채용 공고`,
          collection: true,
          crumbs: [
            { name: "채용", path: "/jobs" },
            { name: "기관별", path: "/jobs/org" },
            { name: org },
          ],
        })}
      />
      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/jobs" className="hover:text-brand">채용</Link>
        {" · "}
        <Link href="/jobs/org" className="hover:text-brand">기관별</Link>
        {" · "}
        <span className="text-ink2">{org}</span>
      </nav>

      {stat && (
        <section className="card mt-6 p-5">
          <h2 className="text-[15px] font-bold">지난 공고에서 읽히는 것</h2>
          <ul className="mt-3 space-y-2 text-[14px] leading-[1.75] text-ink2">
            <li>
              마지막 공고는 <b className="num">{dot(stat.lastReg) ?? "—"}</b>에 올라왔습니다.
            </li>
            {stat.avgDays != null && (
              <li>
                접수 기간은 평균 <b className="num">{stat.avgDays}일</b>이었습니다. 공고를 보고
                나서 서류를 떼면 늦을 수 있습니다.
              </li>
            )}
            {peak ? (
              <li>
                지금까지 낸 공고의 <b className="num">{peak.share}%</b>가{" "}
                <b>{peak.label}</b>에 올라왔습니다.
              </li>
            ) : (
              <li className="text-muted">
                공고가 특정 달에 몰리지는 않았습니다. 열두 달에 고르게 퍼져 있어서, 몇 월에
                뽑는다고 말하기 어렵습니다.
              </li>
            )}
          </ul>
          {stat.n >= 12 && <MonthBars months={stat.months} />}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {stat.firstReg?.slice(0, 4)}~{stat.lastReg?.slice(0, 4)}년에 모인{" "}
            {stat.n.toLocaleString()}건을 센 것입니다. 이 기간 밖의 공고와, 나라일터에 올리지
            않은 공고는 빠져 있습니다.
          </p>
        </section>
      )}

      {trend && trend.years.length > 0 && (
        <section className="card mt-6 p-5" aria-labelledby="org-trend-h">
          <h2 id="org-trend-h" className="text-[15px] font-bold">연도별 공고와 채용 지수</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Stat label="최근 12개월 공고" value={`${trend.n12.toLocaleString("ko-KR")}건`}
                  note={yoy == null ? (trend.n12 ? "그 전 해에는 공고가 없었습니다" : "최근 1년은 공고가 없었습니다") : `그 전 12개월보다 ${yoy >= 0 ? `${yoy}% 많음` : `${-yoy}% 적음`}`} />
            <Stat label="채용 지수" value={trend.index != null ? String(trend.index) : "—"}
                  note={trend.index != null && trend.base
                    ? `${indexWord(trend.index)} · 평소 한 해 ${trend.base.avg}건(${trend.base.from}~${trend.base.to}년 평균) = 100`
                    : "공고가 적거나 기간이 짧아 내지 않습니다"} />
            <Stat label="최근 1년 공고 순위" value={trend.rank ? `${trend.rank.toLocaleString("ko-KR")}위` : "—"}
                  note={trend.rank && trend.ranked ? `공고를 낸 ${trend.ranked.toLocaleString("ko-KR")}곳 가운데 상위 ${Math.max(1, Math.round((trend.rank / trend.ranked) * 100))}%` : "최근 1년 공고가 없습니다"} />
          </div>
          <h3 className="mt-5 text-[13px] font-bold text-ink2">연도별 공고 수</h3>
          <YearBars years={trend.years} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            채용 지수는 최근 12개월 공고 수를 평소 한 해 공고 수로 나눈 값입니다. 100이면 평소만큼, 200이면 평소의 두 배를 뽑고
            있다는 뜻입니다. 평소는 끊김 없이 모인 2020년부터 지난해까지의 평균으로 잡았습니다. 공고 건수라서 한 공고에 여러 명을
            뽑는 것도 한 건이고, 합격자 발표 같은 안내 공고도 한 건으로 셉니다. 2015~2019년은 자료를 추가하는 중이라 빗금으로 표시했습니다.
          </p>
        </section>
      )}

      {mix.total >= 5 && (mix.kinds.length > 0 || mix.words.length > 0) && (
        <section className="card mt-6 p-5" aria-labelledby="org-mix-h">
          <h2 id="org-mix-h" className="text-[15px] font-bold">어떤 자리를 주로 뽑나</h2>
          <p className="mt-1 text-[12.5px] text-muted">최근 공고 가운데 합격자 발표·면접 일정 같은 안내를 뺀 채용 공고 {mix.total.toLocaleString("ko-KR")}건의 제목에서 센 것입니다. 한 공고에 여러 형태가 섞이면 각각 셉니다.</p>
          {mix.kinds.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {mix.kinds.slice(0, 5).map((k) => (
                <li key={k.label} className="flex items-center gap-3 text-[13.5px]">
                  <span className="w-28 shrink-0 text-ink2">{k.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ground">
                    <span className="block h-full rounded-full bg-brand/70" style={{ width: `${Math.round((k.n / mix.total) * 100)}%` }} />
                  </span>
                  <span className="num w-20 shrink-0 text-right text-muted">{k.n}건 · {Math.round((k.n / mix.total) * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
          {mix.words.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[13px] font-bold text-ink2">제목에 자주 나온 말</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mix.words.map((w) => (
                  <Link key={w.word} href={jobPath({ q: `${shortOrg} ${w.word}`, page: 1 })} className="chip !py-1 !text-[12.5px]">
                    {w.word} <span className="num ml-1 text-faint">{w.n}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <JobList board={board} route={route} />

      {own.length > 0 && <OwnPosts org={org} posts={own} />}

      <AdSlot name="page_bottom" />

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">{org} 공고를 볼 때</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            같은 기관이라도 정규직, 공무직(무기계약직), 기간제, 임기제가 따로 있습니다. 목록의
            구분 칩으로 걸러 보시면 어떤 자리를 주로 뽑는 곳인지 보입니다. 공무직은 공무원이
            아니라 기관 소속 근로자이고, 기간제는 기간이 끝나면 계약이 끝납니다.
          </p>
          <p>
            지난 공고를 열어 보시는 것도 도움이 됩니다. 요구하는 자격증과 경력 조건은 회차가
            바뀌어도 크게 달라지지 않습니다. 다음 공고를 기다리는 동안 무엇을 준비해야 할지는
            지난 공고문이 제일 정확하게 알려 줍니다.
          </p>
          <p>
            여기 있는 것이 이 기관 공고 전부는 아닙니다. 인사혁신처 나라일터에 올라온 것만
            모으고 있어서, 기관 홈페이지 채용 게시판에만 올리는 공고는 빠집니다. 가고 싶은
            기관이 정해져 있다면 그 기관 게시판도 같이 보세요.
          </p>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="org-prep-h">
        <h2 id="org-prep-h" className="sec-title text-[1.0625rem] font-extrabold">{org} 지원서 준비</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            자기소개서와 이력서는 공고문의 <b>응시 자격, 우대 사항, 제출 서류</b> 칸에서 시작하면 됩니다. 같은 기관이라도 자리마다
            묻는 항목이 다르고, 자기소개서 문항을 공고문에 붙여 두는 곳이 많습니다. 아래 목록에서 지난 공고를 몇 건 열어 문항과
            요구 자격이 회차마다 어떻게 바뀌었는지 보시면, 다음 공고 전에 미리 써 둘 수 있습니다.
          </p>
          {mix.kinds.some((k) => k.label === "공무직" || k.label === "기간제" || k.label === "정규직·일반직") && (
            <p>
              공공기관 채용은 대개 블라인드 방식이라, 지원서에 출신 학교·나이·가족 같은 것을 적지 못하게 하는 경우가 많습니다.
              대신 공고문에 붙은 <b>직무기술서</b>에 적힌 일과 필요한 능력을 기준으로, 비슷한 일을 해 본 경험을 구체적으로
              적는 것이 핵심입니다. 무엇을 적으면 안 되는지는 공고문마다 따로 적혀 있으니 꼭 확인하세요.
            </p>
          )}
          {mix.kinds.some((k) => k.label === "임기제" || k.label === "전문경력관") && (
            <p>
              임기제 공무원이나 전문경력관은 정해진 경력 요건을 채워야 응시할 수 있습니다. 경력증명서에 적힌 기간과 하던 일이
              공고의 요건과 맞는지가 서류 심사의 중심이라, 경력을 기간·기관·맡은 일로 나눠 정리해 두면 좋습니다. 직무수행계획서를
              함께 내라는 공고도 있습니다.
            </p>
          )}
          <p>
            이 기관 합격 후기나 자기소개서 예시를 더 보고 싶다면 취업 포털에서 기관 이름으로 찾아보세요. 남의 글은 참고만 하고,
            문장은 내 경험으로 새로 쓰는 것이 좋습니다. 비슷한 글이 많으면 서류에서 오히려 눈에 띄지 않습니다.
          </p>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            ...outLinks,
            ...mix.words.slice(0, 2).map((w): [string, string, string] =>
              ["잡코리아", `${w.word} 합격 자소서`, `https://www.jobkorea.co.kr/starter/passassay?schTxt=${enc(w.word)}`]),
          ].map(([site, label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener noreferrer nofollow"
                 className="card card-link flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
                <span><span className="text-[12px] font-semibold text-brand">{site}</span> <b className="ml-1">{label}</b></span>
                <span aria-hidden className="text-faint">↗</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">바깥 사이트로 넘어갑니다. 나라지원과 관계없는 곳이고, 그쪽 글의 내용은 나라지원이 확인하지 않았습니다.</p>
      </section>

      <GuideBanner title="취업을 준비하신다면 이것도" />
      <RelatedLinks items={jobsRelated()} />
      <PromoBanner placement="jobs-org" context="job" />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-card bg-ground px-4 py-3">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <b className="num mt-0.5 block text-[1.35rem] leading-tight text-ink">{value}</b>
      <span className="mt-1 block text-[12px] leading-snug text-muted">{note}</span>
    </div>
  );
}

/** 기관 홈페이지 게시판에만 올라온 글. 나라일터 목록과 겹칠 수 있다. 원문으로 바로 보낸다. */
function OwnPosts({ org, posts }: { org: string; posts: OrgPost[] }) {
  const jobs = posts.filter((p) => p.kind === "job").slice(0, 10);
  const notices = posts.filter((p) => p.kind === "notice").slice(0, 6);
  const home = posts.find((p) => p.homepage)?.homepage;
  const List = ({ rows }: { rows: OrgPost[] }) => (
    <ul className="mt-2 divide-y divide-line">
      {rows.map((p) => (
        <li key={p.url}>
          <a href={p.url} target="_blank" rel="noopener noreferrer nofollow"
             className="flex items-baseline justify-between gap-3 py-2.5 text-[14px] hover:text-brand">
            <span className="min-w-0 flex-1 leading-snug">{p.title}</span>
            <span className="num shrink-0 text-[12px] text-faint">{p.posted ? dot(p.posted) : ""} ↗</span>
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="card mt-6 p-5" aria-labelledby="own-h">
      <h2 id="own-h" className="text-[15px] font-bold">{org} 홈페이지에 올라온 글</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
        나라일터에 올리지 않고 기관 홈페이지에만 올리는 공고가 있어 함께 모았습니다. 제목만 옮겼고, 누르면 기관 홈페이지 원문으로 갑니다.
        지원 자격과 마감은 원문에서 확인하세요.
      </p>
      {jobs.length > 0 && (<><h3 className="mt-4 text-[13px] font-bold text-ink2">채용 게시판</h3><List rows={jobs} /></>)}
      {notices.length > 0 && (<><h3 className="mt-4 text-[13px] font-bold text-ink2">공지·고시공고</h3><List rows={notices} /></>)}
      {home && (
        <a href={home} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block text-[13px] font-semibold text-brand underline underline-offset-4">
          {org} 홈페이지 ↗
        </a>
      )}
    </section>
  );
}
