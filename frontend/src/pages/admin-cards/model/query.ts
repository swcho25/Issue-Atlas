import { one, pageOf, type SearchParams } from "@/shared/lib/url";

import { type ApprovalStatus, approvalStatuses } from "./schema";

/** 한 쪽에 보이는 요청 수 */
export const PAGE_SIZE = 20;

/** /admin/cards?status · page · id(고른 요청). 상태 칸 순서는 처리할 것 먼저 */
export function approvalQuery(sp: SearchParams) {
  const status = one(sp.status);
  return {
    status: (approvalStatuses.find((s) => s === status) ?? "pending") as ApprovalStatus,
    page: pageOf(sp.page),
    id: one(sp.id) ?? null,
  };
}
export type ApprovalQuery = ReturnType<typeof approvalQuery>;
