import type { JobStatus } from "@/shared/api";
import { one, pageOf, type SearchParams } from "@/shared/lib/url";

import { type ImportStatus, importStatuses } from "./schema";

/** 한 쪽에 보이는 줄 수 */
export const PAGE_SIZE = 20;

export const jobStatuses: JobStatus[] = ["failed", "aborted", "running", "ok"];

/** /admin/sources/jobs?status · source · page. 상태 · 출처를 고르지 않으면 전체 */
export function jobQuery(sp: SearchParams) {
  const status = one(sp.status);
  return {
    status: jobStatuses.find((s) => s === status) ?? null,
    source: one(sp.source) || null,
    page: pageOf(sp.page),
  };
}
export type JobQuery = ReturnType<typeof jobQuery>;

/** /admin/sources/imports?status · page. 상태를 고르지 않으면 전체 */
export function importQuery(sp: SearchParams) {
  const status = one(sp.status);
  return {
    status: (importStatuses.find((s) => s === status) ?? null) as ImportStatus | null,
    page: pageOf(sp.page),
  };
}
export type ImportQuery = ReturnType<typeof importQuery>;
