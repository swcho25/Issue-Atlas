import { jobListSchema, meSchema, sourceListSchema } from "@/shared/api";
import { href } from "@/shared/lib/url";
import { adminGet } from "@/shared/server";

import { type ImportQuery, type JobQuery, PAGE_SIZE } from "../model/query";
import {
  importDetailSchema,
  importPageSchema,
  importStatuses,
  templatesSchema,
} from "../model/schema";

// 데이터 소스 API(서버 전용): 출처(C2 /v1/sources) · 수집 이력(C2 /v1/admin/jobs) · CSV 요청(contracts/csv-imports)

export const getSources = () => adminGet("/v1/sources", sourceListSchema).then((l) => l.sources);

export const getJobs = (q: JobQuery) =>
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

export const getJobTotal = () =>
  adminGet(href("/v1/admin/jobs", { size: 1 }), jobListSchema).then((l) => l.total);

export const getImports = (q: ImportQuery) =>
  adminGet(
    href("/v1/admin/imports", { status: q.status, page: q.page, size: PAGE_SIZE }),
    importPageSchema,
  );

/** 상태 칸마다 건수 + 전체. 건수만 필요해 한 줄씩만 받는다 */
export async function getImportCounts() {
  const [all, ...totals] = await Promise.all(
    [null, ...importStatuses].map((status) =>
      adminGet(href("/v1/admin/imports", { status, size: 1 }), importPageSchema).then(
        (p) => p.total,
      ),
    ),
  );
  return {
    all,
    ...(Object.fromEntries(importStatuses.map((s, i) => [s, totals[i]])) as Record<
      (typeof importStatuses)[number],
      number
    >),
  };
}

export const getImport = (id: string) =>
  adminGet(`/v1/admin/imports/${encodeURIComponent(id)}`, importDetailSchema);

export const getTemplates = () => adminGet("/v1/admin/import-templates", templatesSchema);
export const getMe = () => adminGet("/v1/auth/me", meSchema);
