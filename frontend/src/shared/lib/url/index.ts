// 목록 화면 상태는 주소(?status · page …)에 둔다 — 뒤로 가기 · 새로 고침 · 링크 공유가 그대로 된다

export type SearchParams = Record<string, string | string[] | undefined>;

/** 주소 값 하나(같은 이름이 여러 번 오면 처음 것) */
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 쪽 번호(1 이상 정수가 아니면 1) */
export const pageOf = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return Number.isInteger(n) && n >= 1 ? n : 1;
};

/** 값이 있는 칸만 남긴 주소 */
export function href(path: string, params: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
