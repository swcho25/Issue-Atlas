import { type JobStatus, jobListSchema, meSchema, sourceListSchema } from "@/shared/api";
import { href } from "@/shared/lib/url";
import { adminGet } from "@/shared/server";

import { PAGE_SIZE } from "../model/query";
import {
  type ImportStatus,
  importDetailSchema,
  importPageSchema,
  templatesSchema,
} from "../model/schema";

// 데이터 소스 API(서버 전용): 출처(C2 /v1/sources) · 수집 기록(C2 /v1/admin/jobs) · CSV 요청(contracts/csv-imports)

export const getSources = () => adminGet("/v1/sources", sourceListSchema).then((l) => l.sources);

/** 수집 기록(최근 시작 순). 출처를 주면 그 출처만 */
export const getJobs = (q: { status: JobStatus | null; source: string | null; page: number }) =>
  adminGet(
    href("/v1/admin/jobs", {
      status: q.status,
      source_id: q.source,
      page: q.page,
      size: PAGE_SIZE,
    }),
    jobListSchema,
  );

/** 출처마다 가장 최근 수집 실행 하나(출처 전체가 정상인지 판정하는 값이 아니다) */
export async function getLatestJobs(sourceIds: string[]) {
  const latest = await Promise.all(
    sourceIds.map((id) =>
      adminGet(href("/v1/admin/jobs", { source_id: id, size: 1 }), jobListSchema).then(
        (l) => l.jobs[0] ?? null,
      ),
    ),
  );
  return Object.fromEntries(sourceIds.map((id, i) => [id, latest[i]]));
}

/** CSV 요청(올린 순). assignee 를 주면 그 사람이 반영 담당자인 것만 */
export const getImports = (q: {
  status?: ImportStatus | null;
  assignee?: number | null;
  page: number;
  size?: number;
}) =>
  adminGet(
    href("/v1/admin/imports", {
      status: q.status,
      assignee_id: q.assignee,
      page: q.page,
      size: q.size ?? PAGE_SIZE,
    }),
    importPageSchema,
  );

export const getImport = (id: string) =>
  adminGet(`/v1/admin/imports/${encodeURIComponent(id)}`, importDetailSchema);

export const getTemplates = () => adminGet("/v1/admin/import-templates", templatesSchema);
export const getMe = () => adminGet("/v1/auth/me", meSchema);
