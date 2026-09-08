/**
 * 저장한 조건 — 서버 보관.
 *
 * 로그인이 없으므로 브라우저가 만든 무작위 UUID 를 열쇠로 쓴다.
 * 이 열쇠는 그 자체로 누구인지 알려주지 않으며, 이름·연락처는 받지 않는다.
 * 서버에 두는 이유는 브라우저 데이터를 지워도 남기고, 나중에 알림 기능의
 * 바탕이 되며, 어떤 조건이 많이 저장되는지 볼 수 있기 때문이다.
 */

import { db } from "./db";

const KEY = "jiwon.device.v1";

export type Saved = {
  cond_key: string;
  query: string;
  label: string[];
  created_at: string;
};

/** 이 브라우저의 익명 열쇠. 없으면 만든다. */
export function deviceKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let k = window.localStorage.getItem(KEY);
    if (!k) {
      k = crypto.randomUUID();
      window.localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    // 사생활 보호 모드 등에서 저장이 막히면 저장 기능만 쉰다
    return null;
  }
}

/** 계정으로 불러왔을 때 열쇠를 갈아끼운다 */
export function setDeviceKey(key: string) {
  try {
    window.localStorage.setItem(KEY, key);
  } catch {
    /* noop */
  }
}

/** 순서가 달라도 같은 조건이면 같은 열쇠가 나오게 정렬한다 */
export const keyOf = (query: string) =>
  Array.from(new URLSearchParams(query).entries())
    .filter(([k]) => !["via"].includes(k))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");

export async function listSaved(): Promise<Saved[]> {
  const key = deviceKey();
  if (!key) return [];
  const { data } = await db.rpc("saved_list", { p_key: key });
  return (data ?? []) as Saved[];
}

export async function addSaved(
  query: string,
  label: string[],
  kind = "welfare"
) {
  const key = deviceKey();
  if (!key) return false;
  const { error } = await db.rpc("saved_add", {
    p_key: key,
    p_cond: keyOf(query),
    p_kind: kind,
    p_query: query,
    p_label: label,
  });
  return !error;
}

export async function removeSaved(condKey: string) {
  const key = deviceKey();
  if (!key) return;
  await db.rpc("saved_remove", { p_key: key, p_cond: condKey });
}

// ── 복구 코드 ────────────────────────────────────────────
//
// 캐시를 지우거나 기기를 바꿔도 저장한 조건을 되찾기 위한 것.
// 이름·전화번호를 쓰지 않는 이유는, 저장 조건에 저소득·장애인·한부모
// 같은 항목이 들어가기 때문이다. 아는 사람이 열어볼 수 있으면 안 된다.

/** 이 기기의 복구 코드를 받는다. 저장한 조건이 없으면 null. */
export async function getRecoveryCode(): Promise<string | null> {
  const key = deviceKey();
  if (!key) return null;
  const { data } = await db.rpc("recovery_issue", { p_key: key });
  return (data as string | null) ?? null;
}

/** 코드로 이 브라우저에 조건을 되살린다. */
export async function claimRecoveryCode(code: string): Promise<boolean> {
  const clean = code.trim().toUpperCase().replace(/[^A-Z2-9]/g, "");
  if (clean.length !== 8) return false;
  const { data } = await db.rpc("recovery_claim", { p_code: clean });
  const key = data as string | null;
  if (!key) return false;
  try {
    window.localStorage.setItem(KEY, key);
  } catch {
    return false;
  }
  return true;
}

/** 다시 열었을 때. 실패해도 화면을 막지 않는다. */
export function markOpened(query: string) {
  const key = deviceKey();
  if (!key) return;
  void db
    .rpc("saved_open", { p_key: key, p_cond: keyOf(query) })
    .then(
      () => {},
      () => {}
    );
}
