import { z } from "zod";

// 관리자 검수 API(contracts/reviews/openapi.json v0.1.1). 검수 화면에서만 쓰여 이 슬라이스에 둔다

export const targetTypes = ["news_event", "normalized_record", "source", "card"] as const;
export const issueTypes = [
  "location",
  "classification",
  "duplicate",
  "value",
  "wording",
  "metadata",
  "other",
] as const;
export const origins = ["user", "admin", "local_import", "model"] as const;
export const reviewStatuses = [
  "pending",
  "on_hold",
  "approval_pending",
  "resolved",
  "rejected",
] as const;
export const decisionActions = ["confirm", "correct", "hold", "reject"] as const;
export const changeActions = ["confirm", "correct", "hold", "reject", "approve"] as const;
export const scopes = ["record", "source", "card"] as const;

export type TargetType = (typeof targetTypes)[number];
export type IssueType = (typeof issueTypes)[number];
export type Origin = (typeof origins)[number];
export type ReviewStatus = (typeof reviewStatuses)[number];
export type DecisionAction = (typeof decisionActions)[number];
export type ChangeAction = (typeof changeActions)[number];
export type Scope = (typeof scopes)[number];

/** 대상 값(요청 당시 · 지금 · 제안 · 변경 전후). 대상 종류마다 칸이 달라 열린 객체로 받는다 */
const values = z.record(z.string(), z.unknown());

export const reviewSchema = z.object({
  review_id: z.string(),
  origin: z.enum(origins),
  target_type: z.enum(targetTypes),
  target_id: z.string(),
  issue_type: z.enum(issueTypes),
  card_id: z.string().nullable(),
  reason: z.string(),
  proposed_value: values.nullable(),
  submitted_value: values,
  submitted_by: z.number().int(),
  status: z.enum(reviewStatuses),
  revision: z.number().int(),
  approval_request_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Review = z.infer<typeof reviewSchema>;

export const changeSchema = z.object({
  change_id: z.string(),
  review_id: z.string().nullable(),
  target_type: z.enum(targetTypes),
  target_id: z.string(),
  action: z.enum(changeActions),
  scope: z.enum(scopes),
  actor_id: z.number().int().nullable(),
  actor_email: z.string(),
  reason: z.string(),
  before_value: values,
  after_value: values,
  revision: z.number().int(),
  created_at: z.string(),
});
export type Change = z.infer<typeof changeSchema>;

export const reviewDetailSchema = z.object({
  request: reviewSchema,
  current_value: values,
  proposable_fields: z.array(z.string()),
  editable_fields: z.array(z.string()),
  scope: z.enum(scopes),
  approval_status: z.string().nullable(),
  supported_actions: z.array(z.enum(decisionActions)),
  decisions: z.array(changeSchema),
});
export type ReviewDetail = z.infer<typeof reviewDetailSchema>;

const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    size: z.number().int(),
    total: z.number().int(),
  });

export const reviewPageSchema = page(reviewSchema);
export type ReviewPage = z.infer<typeof reviewPageSchema>;
export const changePageSchema = page(changeSchema);
export type ChangePage = z.infer<typeof changePageSchema>;
