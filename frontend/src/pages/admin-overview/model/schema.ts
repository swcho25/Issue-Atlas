import { z } from "zod";

// 운영 요약(GET /v1/admin/overview, contracts/operations v0.1). 운영 요약 화면에서만 쓰여 이 슬라이스에 둔다

const counts = <K extends string>(keys: readonly K[]) =>
  z.object(Object.fromEntries(keys.map((k) => [k, z.number().int()])) as Record<K, z.ZodNumber>);

export const jobStatuses = ["ok", "failed", "aborted", "running", "unknown"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const sourceStatusSchema = z.object({
  source_id: z.string(),
  name: z.string(),
  storage_scope: z.string().nullable(),
  reliability_grade: z.string().nullable(),
  robots_status: z.string().nullable(),
  spec_count: z.number().int(),
  never_run_spec_count: z.number().int(),
  latest_job_status: z.enum(jobStatuses),
  last_started_at: z.string().nullable(),
  last_successful_at: z.string().nullable(),
});
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

export const overviewSchema = z.object({
  generated_at: z.string(),
  period: z.object({ from: z.string(), to: z.string() }),
  current_queues: z.object({
    reviews: counts(["pending", "on_hold", "resolved", "rejected", "approval_pending"] as const),
    approvals: counts(["pending", "on_hold", "approved", "rejected"] as const),
    imports: counts(["validation_failed", "no_changes", "pending", "completed", "failed"] as const),
  }),
  period_activity: z.object({
    review_decisions: counts(["confirm", "correct", "hold", "reject"] as const),
    approval_decisions: counts(["approve", "reject", "hold"] as const),
    import_results: counts(["completed", "failed"] as const),
    jobs_started: counts(["ok", "failed", "aborted", "running"] as const),
  }),
  current_inventory: z.object({
    raw_records: z.number().int(),
    normalized_records: z.number().int(),
    ready_records: z.number().int(),
  }),
  source_statuses: z.array(sourceStatusSchema),
});
export type Overview = z.infer<typeof overviewSchema>;
