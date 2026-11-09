import { browserPost } from "@/shared/api";

import { type ApprovalDetail, approvalRequestSchema, type Decision } from "../model/schema";

// 승인 요청 처리(POST /v1/admin/approval-requests/{id}/decisions). 요청의 revision 으로 동시 처리를 막는다(초안 번호가 아님)
export const decideApproval = (detail: ApprovalDetail, decision: Decision, reason: string) =>
  browserPost(
    `/v1/admin/approval-requests/${encodeURIComponent(detail.request.request_id)}/decisions`,
    { expected_revision: detail.request.revision, decision, reason: reason.trim() },
    approvalRequestSchema,
  );

// 승인 요청 보내기(POST /v1/admin/cards/{id}/approval-requests). 마지막으로 본 초안 번호를 보낸다(그 사이 바뀌었으면 409)
export const requestApproval = (input: {
  cardId: string;
  draftRevision: number;
  approverId: number;
  reason: string;
}) =>
  browserPost(
    `/v1/admin/cards/${encodeURIComponent(input.cardId)}/approval-requests`,
    {
      expected_revision: input.draftRevision,
      approver_id: input.approverId,
      reason: input.reason.trim(),
    },
    approvalRequestSchema,
  );
