import type { Metadata } from "next";
import SavedLookup from "@/components/SavedLookup";
import { t } from "@/lib/seo";

export const metadata: Metadata = {
  title: t("저장한 조건 다시 보기"),
  description:
    "저장해 둔 조회 조건을 이름과 휴대폰 번호로 다시 엽니다. 회원가입은 없습니다.",
  robots: { index: false, follow: false },
};

export default function SavedPage() {
  return (
    <div className="py-4">
      <h1 className="text-[1.75rem] font-extrabold leading-tight">
        저장한 조건 다시 보기
      </h1>
      <p className="mt-3 max-w-[34rem] leading-relaxed text-muted">
        저장하실 때 넣으신 이름과 휴대폰 번호를 그대로 넣어주세요.
      </p>

      <SavedLookup />
    </div>
  );
}
