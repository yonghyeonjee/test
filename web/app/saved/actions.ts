"use server";

import {
  digits,
  normName,
  phoneTail,
  svc,
  validBizNo,
  validEmail,
  type SavedRow,
} from "@/lib/saved";

export type SaveState = { ok?: string; error?: string };
export type FindState = { rows?: SavedRow[]; error?: string; asked?: boolean };

// 이름과 번호만으로 여는 방식이라, 남의 것을 찍어 보는 시도를 늦춘다.
const TRIES = new Map<string, { n: number; until: number }>();
const LIMIT = 8;
const LOCK_MS = 10 * 60_000;

export async function saveSearch(
  _prev: SaveState,
  form: FormData
): Promise<SaveState> {
  const kind = String(form.get("kind") ?? "welfare");
  const query = String(form.get("query") ?? "");
  const label = String(form.get("label") ?? "").trim() || null;
  const name = normName(String(form.get("name") ?? ""));
  const phoneRaw = String(form.get("phone") ?? "");
  const email = String(form.get("email") ?? "").trim();
  const bizRaw = String(form.get("biz_no") ?? "").trim();
  const agreed = form.get("agree") === "on";

  if (!agreed) return { error: "개인정보 수집·이용에 동의해야 저장됩니다." };
  if (name.length < 2) return { error: "이름을 정확히 적어주세요." };

  const tail = phoneTail(phoneRaw);
  if (!tail) return { error: "휴대폰 번호를 정확히 적어주세요." };
  if (!validEmail(email)) return { error: "이메일 주소를 다시 확인해주세요." };
  if (bizRaw && !validBizNo(bizRaw))
    return { error: "사업자등록번호가 올바르지 않습니다." };
  if (!query) return { error: "저장할 조건이 없습니다." };

  try {
    const { error } = await svc().from("saved_searches").insert({
      kind: kind === "business" ? "business" : "welfare",
      label,
      query,
      name,
      phone: digits(phoneRaw),
      phone_tail: tail,
      email,
      biz_no: bizRaw ? digits(bizRaw) : null,
    });
    if (error) throw error;
  } catch {
    return { error: "저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  return { ok: "저장했습니다. 이름과 휴대폰 번호로 다시 열 수 있습니다." };
}

export async function findSaved(
  _prev: FindState,
  form: FormData
): Promise<FindState> {
  const name = normName(String(form.get("name") ?? ""));
  const tail = phoneTail(String(form.get("phone") ?? ""));
  const now = Date.now();
  const bucket = `${name}:${tail}`;

  const rec = TRIES.get(bucket);
  if (rec && rec.until > now) {
    const min = Math.ceil((rec.until - now) / 60_000);
    return { error: `시도가 많았습니다. ${min}분 뒤에 다시 해주세요.`, asked: true };
  }
  if (!name || !tail)
    return { error: "이름과 휴대폰 번호를 모두 적어주세요.", asked: true };

  // 맞든 틀리든 같은 시간이 걸리게 둔다.
  await new Promise((r) => setTimeout(r, 400));

  let rows: SavedRow[] = [];
  try {
    const { data, error } = await svc()
      .from("saved_searches")
      // 이메일·전화·사업자번호는 돌려주지 않는다. 남이 열어도 조건만 보인다.
      .select("id,kind,label,query,created_at")
      .eq("phone_tail", tail)
      .eq("name", name)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    rows = (data ?? []) as SavedRow[];
  } catch {
    return { error: "지금은 불러올 수 없습니다. 잠시 후 다시 시도해주세요.", asked: true };
  }

  if (rows.length === 0) {
    const n = (rec && rec.until <= now ? 0 : rec?.n ?? 0) + 1;
    TRIES.set(bucket, { n, until: n >= LIMIT ? now + LOCK_MS : 0 });
    return { rows: [], asked: true };
  }

  TRIES.delete(bucket);
  return { rows, asked: true };
}
