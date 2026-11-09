import { z } from "zod";

import { dateTime, id, schemaVersion } from "./common";

// GET /v1/admin/jobs · /v1/admin/jobs/{job_run_id} 응답(contracts/c2/schemas/job-list · job.schema.json, c2-0.1).
// 수집 실행 한 번의 기록. running 은 아직 끝 기록이 없는 실행이고, 재실행은 없다
const count = z.number().int().min(0).nullable();

export const jobStatus = z.enum(["running", "ok", "failed", "aborted"]);

const job = z.object({
  job_run_id: id,
  source_id: z.string(),
  source_name: z.string(),
  spec_id: z.string(),
  method: z.enum(["api", "file", "board", "rss"]),
  collector_version: z.string(),
  status: jobStatus,
  started_at: dateTime,
  finished_at: dateTime.nullable(),
  received: count,
  inserted: count,
  duplicates: count,
  /** 고정 원인 코드만(외부 응답 · 예외 문구는 없다) */
  error_code: z.string().nullable(),
  /** 수집기마다 칸이 다른 실행 기록 */
  details: z.record(z.string(), z.unknown()),
});

export const jobListSchema = z.object({
  schema_version: schemaVersion,
  jobs: z.array(job),
  page: z.number().int().min(1),
  size: z.number().int().min(1),
  total: z.number().int().min(0),
});
export const jobSchema = z.object({ schema_version: schemaVersion, job });
export type Job = z.infer<typeof job>;
export type JobStatus = z.infer<typeof jobStatus>;
