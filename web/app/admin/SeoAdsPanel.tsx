"use client";

import { useState, useTransition } from "react";
import { AD_SLOTS, AD_SLOT_LABEL, type Ads, type AdSlotName, type Seo } from "@/lib/settings";
import { refreshCache, saveJsonSetting } from "./actions";

const input = "w-full rounded-ctl border border-line px-3 py-2 text-sm outline-none focus:border-brand";

function Save({ onSave }: { onSave: () => Promise<{ error: string | null }> }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        onClick={() => start(async () => {
          const r = await onSave();
          if (!r.error) await refreshCache();
          setMsg(r.error ?? "저장하고 캐시를 비웠습니다");
          setTimeout(() => setMsg(""), 3000);
        })}
        disabled={pending}
        className="btn btn-primary px-4 py-2 text-sm"
      >
        저장
      </button>
      {msg && <span className="text-xs text-brand">{msg}</span>}
    </div>
  );
}

/** 검색엔진 확인 토큰과 기본 설명. 코드를 고치지 않고 관리자에서 바꾼다. */
export function SeoPanel({ initial }: { initial: Seo }) {
  const [v, setV] = useState<Seo>(initial);
  const f = (k: keyof Seo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-bold">검색엔진 (SEO)</h2>
      <p className="mt-1 text-xs text-faint">
        확인 토큰은 &lt;meta name=&quot;…-site-verification&quot;&gt; 로 모든 화면 head 에 나갑니다. 값만 넣으세요.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {([["naver", "네이버 서치어드바이저"], ["google", "구글 서치콘솔"], ["bing", "빙 웹마스터"]] as const).map(([k, label]) => (
          <div key={k}>
            <label className="block text-xs font-bold text-muted">{label}</label>
            <input value={v[k]} onChange={f(k)} className={`${input} mt-1.5 font-mono text-xs`} placeholder="content 값" />
          </div>
        ))}
        <div className="sm:col-span-3">
          <label className="block text-xs font-bold text-muted">기본 설명 (description)</label>
          <p className="text-xs text-faint">비우면 코드의 기본 문장을 씁니다. 검색 결과에 그대로 보입니다. 120자 안팎.</p>
          <textarea value={v.description} onChange={f("description")} rows={2} className={`${input} mt-1.5`} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted">기본 키워드</label>
          <p className="text-xs text-faint">쉼표로 나눕니다. 비우면 코드의 기본값.</p>
          <input value={v.keywords} onChange={f("keywords")} className={`${input} mt-1.5`} placeholder="정부지원금, 복지 혜택, …" />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={v.index} onChange={(e) => setV({ ...v, index: e.target.checked })} />
          검색엔진 색인 허용
        </label>
      </div>
      <Save onSave={() => saveJsonSetting("seo", v)} />
    </section>
  );
}

function SlotEditor({ name, cfg, onChange }: {
  name: AdSlotName; cfg: Ads[AdSlotName]; onChange: (c: Ads[AdSlotName]) => void;
}) {
  return (
    <div className="rounded-card border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={cfg.on} onChange={(e) => onChange({ ...cfg, on: e.target.checked })} />
          {AD_SLOT_LABEL[name]}
        </label>
        <select value={cfg.kind} onChange={(e) => onChange({ ...cfg, kind: e.target.value as "html" | "image" })}
                className="rounded-ctl border border-line px-2 py-1 text-xs">
          <option value="html">HTML / 스크립트 (애드센스 등)</option>
          <option value="image">이미지 배너 + 링크</option>
        </select>
      </div>
      {cfg.kind === "html" ? (
        <textarea value={cfg.html} onChange={(e) => onChange({ ...cfg, html: e.target.value })} rows={4}
                  className={`${input} mt-3 font-mono text-xs`} placeholder="<ins class=&quot;adsbygoogle&quot; …></ins><script>…</script>" />
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input value={cfg.img} onChange={(e) => onChange({ ...cfg, img: e.target.value })} className={input} placeholder="이미지 주소 (https://…)" />
          <input value={cfg.href} onChange={(e) => onChange({ ...cfg, href: e.target.value })} className={input} placeholder="눌렀을 때 갈 주소" />
          <input value={cfg.alt} onChange={(e) => onChange({ ...cfg, alt: e.target.value })} className={input} placeholder="대체 글 (무슨 광고인지)" />
        </div>
      )}
    </div>
  );
}

/** 광고 지면 넷. 자리는 코드가 정하고, 켜고 끄기와 내용은 여기서. */
export function AdsPanel({ initial }: { initial: Ads }) {
  const [v, setV] = useState<Ads>(initial);
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-bold">광고 지면</h2>
      <p className="mt-1 text-xs text-faint">
        본문이 끝난 자리에만 나옵니다. 첫 화면과 목록 사이에는 두지 않습니다. 끄면 자리 자체가 사라집니다.
        높이는 140px 안쪽으로 잡히고 &quot;광고&quot; 표시가 붙습니다.
      </p>
      <div className="mt-4 grid gap-3">
        {AD_SLOTS.map((n) => (
          <SlotEditor key={n} name={n} cfg={v[n]} onChange={(c) => setV({ ...v, [n]: c })} />
        ))}
      </div>
      <Save onSave={() => saveJsonSetting("ads", v)} />
    </section>
  );
}
