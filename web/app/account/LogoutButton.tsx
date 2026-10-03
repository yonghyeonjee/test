"use client";

import { useRouter } from "next/navigation";
import { logoutAccount } from "./actions";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button type="button" className="underline underline-offset-4 hover:text-ink"
            onClick={async () => { await logoutAccount(); router.refresh(); }}>
      로그아웃
    </button>
  );
}
