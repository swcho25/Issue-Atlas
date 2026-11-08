import { meSchema, sourceListSchema } from "@/shared/api";
import { href } from "@/shared/lib/url";
import { adminGet, adminGetOrNull } from "@/shared/server";

import { type ApprovalQuery, PAGE_SIZE } from "../model/query";
import {
  approvalDetailSchema,
  approvalPageSchema,
  approvalStatuses,
  cardDraftSchema,
  checksSchema,
  revisionsSchema,
  versionSchema,
} from "../model/schema";
import { specName } from "../model/spec";

// 카드 승인 API(서버 전용, contracts/c3). 세션 쿠키 · 401/403/404 처리는 adminGet
const card = (id: string) => `/v1/admin/cards/${encodeURIComponent(id)}`;

export const getApprovals = (q: Pick<ApprovalQuery, "status" | "page">, cardId?: string) =>
  adminGet(
    href("/v1/admin/approval-requests", {
      status: q.status,
      card_id: cardId,
      page: q.page,
      size: PAGE_SIZE,
    }),
    approvalPageSchema,
  );

/** 상태 칸마다 건수. 건수만 필요해 한 줄씩만 받는다 */
export async function getApprovalCounts() {
  const totals = await Promise.all(
    approvalStatuses.map((status) =>
      adminGet(href("/v1/admin/approval-requests", { status, size: 1 }), approvalPageSchema).then(
        (p) => p.total,
      ),
    ),
  );
  return Object.fromEntries(approvalStatuses.map((s, i) => [s, totals[i]])) as Record<
    (typeof approvalStatuses)[number],
    number
  >;
}

/** 이 카드의 요청 전부(새것부터). 열린 요청(대기 · 보류)이 있으면 새 요청을 못 낸다 */
export const getCardApprovals = (cardId: string) =>
  adminGet(
    href("/v1/admin/approval-requests", { card_id: cardId, size: 100 }),
    approvalPageSchema,
  ).then((p) => p.items);

export const getApproval = (id: string) =>
  adminGet(`/v1/admin/approval-requests/${encodeURIComponent(id)}`, approvalDetailSchema);

export const getCardDraft = (id: string) => adminGet(`${card(id)}/draft`, cardDraftSchema);
export const getCardChecks = (id: string) => adminGet(`${card(id)}/checks`, checksSchema);
export const getCardVersion = (id: string, version: number) =>
  adminGet(`${card(id)}/versions/${version}`, versionSchema);
export const getCardRevisions = (id: string) => adminGet(`${card(id)}/revisions`, revisionsSchema);

/** 목록에 보일 카드 이름(초안의 name). 지워진 카드면 이름 없이 ID 만 */
export async function getCardNames(ids: string[]) {
  const unique = [...new Set(ids)];
  const drafts = await Promise.all(
    unique.map((id) => adminGetOrNull(`${card(id)}/draft`, cardDraftSchema)),
  );
  return Object.fromEntries(
    unique.map((id, i) => [id, drafts[i] ? specName(drafts[i].draft_spec) : null]),
  );
}

export const getSources = () => adminGet("/v1/sources", sourceListSchema).then((l) => l.sources);
export const getMe = () => adminGet("/v1/auth/me", meSchema);
