import { Suspense } from "react";
import ConditionSentence from "@/components/ConditionSentence";
import ProgramEntry from "@/components/ProgramEntry";
import { getCoverage, getRegions, matchWelfare } from "@/lib/db";

export const revalidate = 3600;

type SP = { [k: string]: string | string[] | undefined };

const one = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;
const many = (v: string | string[] | undefined) =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

export default async function Home({ searchParams }: { searchParams: SP }) {
  const [regions, coverage] = await Promise.all([getRegions(), getCoverage()]);

  const sido = one(searchParams.sido);
  const sigungu = one(searchParams.sigungu);
  const ageRaw = one(searchParams.age);
  const age = ageRaw ? Number(ageRaw) : undefined;
  const employment = one(searchParams.emp);
  const household = many(searchParams.hh);

  const asked = Boolean(sido || age || employment || household.length);

  const results = asked
    ? await matchWelfare({ sido, sigungu, age, employment, household })
    : [];

  return (
    <>
      <Suspense fallback={<div className="h-40" />}>
        <ConditionSentence regions={regions} />
      </Suspense>

      {!asked ? (
        <section className="mt-16 border-t border-rule pt-8">
          <p className="max-w-[34rem] leading-relaxed">
            지자체와 중앙부처가 제공하는 복지서비스는 종류가 많고 지역마다
            달라서, 해당되는데도 모르고 지나치는 경우가 많습니다. 위 문장의
            빈칸을 채우면 조건에 걸리는 사업을 찾아 보여드립니다.
          </p>
          <p className="num mt-6 text-sm text-muted">
            현재 {coverage.usable.toLocaleString()}건의 복지서비스를 조건별로
            찾을 수 있습니다. 자료는 매일 갱신됩니다.
          </p>
        </section>
      ) : (
        <section className="mt-14">
          <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
            <h2 className="text-sm font-bold">
              해당될 수 있는 사업
            </h2>
            <span className="num text-sm text-muted">
              {results.length}건
              {results.length >= 60 && " 이상"}
            </span>
          </div>

          {results.length === 0 ? (
            <p className="mt-8 leading-relaxed text-muted">
              입력하신 조건에 걸리는 사업을 찾지 못했습니다. 시·군·구를 지우고
              시도 단위로 넓혀 보시거나, 아래 항목 선택을 줄여 보세요.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-rule">
              {results.map((p) => (
                <ProgramEntry key={p.id} p={p} myAge={age} />
              ))}
            </div>
          )}

          <p className="mt-10 text-xs leading-relaxed text-muted">
            여기 나온 사업이 곧 신청 자격이 있다는 뜻은 아닙니다. 소득·재산
            기준처럼 화면에 담기지 않는 조건이 남아 있을 수 있으니, 사업명을
            눌러 원문에서 확인하세요. 출처는 복지로(한국사회보장정보원)입니다.
          </p>
        </section>
      )}
    </>
  );
}
