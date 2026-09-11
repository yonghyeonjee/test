/**
 * 자료를 받아 오는 동안 보이는 뼈대. 공공 API 는 느릴 때 2~3초가 걸린다.
 * 빈 화면보다 자리가 잡혀 있는 편이 훨씬 덜 불안하다.
 */
export function SkeletonPage({ rows = 6 }: { rows?: number }) {
  return (
    <div className="pb-4" aria-busy="true" aria-live="polite">
      <div className="hero -mx-5 mt-2 px-6 py-9 sm:mx-0 sm:rounded-card sm:px-10">
        <div className="sk h-3 w-16 bg-white/20" />
        <div className="sk mt-4 h-8 w-2/3 bg-white/25" />
        <div className="sk mt-3 h-4 w-1/2 bg-white/15" />
      </div>
      <div className="mt-6 flex gap-2">
        <div className="sk h-11 flex-1" />
        <div className="sk h-11 w-20" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk h-9 w-20 rounded-pill" />)}
      </div>
      <div className="mt-8 grid gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="card p-5">
            <div className="flex gap-2"><div className="sk h-5 w-14 rounded-pill" /><div className="sk h-5 w-16 rounded-pill" /></div>
            <div className="sk mt-3 h-5 w-3/4" />
            <div className="sk mt-2 h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
