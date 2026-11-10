import type { JobStatus } from "@/shared/api";
import { href, one, pageOf, type SearchParams } from "@/shared/lib/url";

/** 한 쪽에 보이는 줄 수 */
export const PAGE_SIZE = 20;

export const jobStatuses: JobStatus[] = ["failed", "aborted", "running", "ok"];

/**
 * /admin/sources 한 화면의 주소. 출처 보기(기본)는 ?source(고른 출처) · status(수집 기록 거르기) · page(수집 기록 쪽),
 * CSV 요청 보기(?view=imports)는 ?id(고른 요청) · mine(내 차례만) · new(올리기 양식) · page(요청 목록 쪽)
 */
export function sourcesQuery(sp: SearchParams) {
  const view = one(sp.view) === "imports" ? "imports" : "sources";
  const status = one(sp.status);
  return {
    view,
    source: one(sp.source) || null,
    status: jobStatuses.find((s) => s === status) ?? null,
    id: one(sp.id) || null,
    mine: one(sp.mine) === "1",
    isNew: one(sp.new) === "1",
    page: pageOf(sp.page),
  } as const;
}
export type SourcesQuery = ReturnType<typeof sourcesQuery>;

/** 주소 만들기. 기본값(출처 보기 · 1쪽 · 끔)은 빼서 짧게 */
export const sourcesHref = (p: {
  view?: "imports";
  source?: string | null;
  status?: JobStatus | null;
  id?: string | null;
  mine?: boolean;
  isNew?: boolean;
  page?: number;
}) =>
  href("/admin/sources", {
    view: p.view,
    source: p.source,
    status: p.status,
    id: p.id,
    mine: p.mine ? 1 : null,
    new: p.isNew ? 1 : null,
    page: p.page && p.page > 1 ? p.page : null,
  });
