import { changeActions, type ChangeAction, type Origin, type ReviewStatus } from "./schema";

// 목록 화면 상태는 주소(?status · origin · page)에 둔다 — 뒤로 가기 · 새로 고침 · 링크 공유가 그대로 된다

export type SearchParams = Record<string, string | string[] | undefined>;

/** 한 쪽에 보이는 줄 수 */
export const PAGE_SIZE = 20;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 상태 칸 순서: 처리할 것 먼저 */
export const statusTabs: ReviewStatus[] = [
  "pending",
  "on_hold",
  "approval_pending",
  "resolved",
  "rejected",
];
/** 출처 거르기(일괄 적재는 이 API 가 아직 만들지 않아 칸을 두지 않는다) */
export const originTabs: (Origin | null)[] = [null, "user", "admin", "model"];

const pageOf = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
};

export function reviewQuery(sp: SearchParams) {
  const status = one(sp.status);
  const origin = one(sp.origin);
  return {
    status: statusTabs.find((s) => s === status) ?? "pending",
    origin: originTabs.find((o) => o === origin) ?? null,
    page: pageOf(one(sp.page)),
  };
}
export type ReviewQuery = ReturnType<typeof reviewQuery>;

export function changeQuery(sp: SearchParams) {
  const action = one(sp.action);
  return {
    action: changeActions.find((a) => a === action) ?? null,
    page: pageOf(one(sp.page)),
  };
}
export type ChangeQuery = ReturnType<typeof changeQuery>;

/** 값이 있는 칸만 남긴 주소 */
export function href(path: string, params: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export type { ChangeAction };
