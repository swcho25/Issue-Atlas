import { z } from "zod";

// contracts/c3(카드 저장 · 승인 v0.2, 승인 요청 · 담당자 처리 #205) 응답 중 이 화면이 쓰는 것.
// 초안(draft_spec)은 미완성도 저장되는 큰 객체라 통째로 받고, 읽을 칸은 model/spec 이 하나씩 꺼낸다
const time = z.iso.datetime({ offset: true });

export const approvalStatuses = ["pending", "on_hold", "approved", "rejected"] as const;
export const approvalStatus = z.enum(approvalStatuses);
export type ApprovalStatus = z.infer<typeof approvalStatus>;

export const decisions = ["approve", "hold", "reject"] as const;
export type Decision = (typeof decisions)[number];

export const approvalRequestSchema = z.object({
  request_id: z.string(),
  card_id: z.string(),
  draft_revision: z.number().int(),
  requested_by: z.number().int(),
  requester_name: z.string(),
  approver_id: z.number().int(),
  approver_name: z.string(),
  status: approvalStatus,
  reason: z.string(),
  /** 요청의 동시 처리 막는 번호(초안 번호 · 카드 버전과 다르다) */
  revision: z.number().int(),
  created_at: time,
  decided_by: z.number().int().nullable(),
  decided_at: time.nullable(),
  decision_reason: z.string().nullable(),
  approved_version: z.number().int().nullable(),
});
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;

export const approvalPageSchema = z.object({
  items: z.array(approvalRequestSchema),
  page: z.number().int(),
  size: z.number().int(),
  total: z.number().int(),
});

const specSchema = z.record(z.string(), z.unknown());
export type Spec = z.infer<typeof specSchema>;

export const approvalDetailSchema = z.object({
  request: approvalRequestSchema,
  /** 요청 당시 초안 */
  draft_spec: specSchema,
  /** 요청 당시 고정한 지표별 규칙 버전 */
  indicator_versions: z.record(z.string(), z.number().int()),
  current_version: z.number().int().nullable(),
  decisions: z.array(
    z.object({
      decision_id: z.number().int(),
      actor_id: z.number().int(),
      decision: z.enum(decisions),
      reason: z.string(),
      created_at: time,
    }),
  ),
});
export type ApprovalDetail = z.infer<typeof approvalDetailSchema>;

export const cardStatuses = ["legacy", "card", "candidate", "on_hold"] as const;
export const cardDraftSchema = z.object({
  card_id: z.string(),
  status: z.enum(cardStatuses),
  card_version: z.number().int(),
  current_version: z.number().int().nullable(),
  draft_revision: z.number().int(),
  draft_spec: specSchema,
});
export type CardDraft = z.infer<typeof cardDraftSchema>;

export const checksSchema = z.object({
  draft_revision: z.number().int(),
  valid: z.boolean(),
  checks: z.array(z.object({ check_no: z.number().int(), ok: z.boolean(), label: z.string() })),
});
export type Checks = z.infer<typeof checksSchema>;

export const revisionsSchema = z.array(
  z.object({
    revision_id: z.number().int(),
    from_version: z.number().int(),
    to_version: z.number().int(),
    reason: z.string(),
    approved_by: z.string(),
    created_at: time,
  }),
);
export type Revision = z.infer<typeof revisionsSchema>[number];

export const userPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      email: z.string(),
      name: z.string(),
      role: z.string(),
      is_active: z.boolean(),
    }),
  ),
  page: z.number().int(),
  size: z.number().int(),
  total: z.number().int(),
});
export type AdminUser = z.infer<typeof userPageSchema>["items"][number];

export const versionSchema = z.object({
  card_id: z.string(),
  version: z.number().int(),
  spec: specSchema,
  /** 이 승인본을 만든 초안 번호 */
  draft_revision: z.number().int(),
  approved_by: z.string(),
  approved_at: time,
});
