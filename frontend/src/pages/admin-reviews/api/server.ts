import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { z } from "zod";

import { ApiError, apiGet } from "@/shared/api";

import type { ChangeQuery, ReviewQuery } from "../model/query";
import { href, PAGE_SIZE, statusTabs } from "../model/query";
import { changePageSchema, reviewDetailSchema, reviewPageSchema } from "../model/schema";

// 관리자 검수 API(서버 전용). 관리자 세션 쿠키(JSESSIONID)를 그대로 실어 부른다(AdminLayout 과 같은 방법).
// 그 사이 세션이 끝났거나 관리자가 아니면(401 · 403) 랜딩으로
async function adminGet<S extends z.ZodType>(path: string, schema: S) {
  const cookie = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  try {
    return await apiGet(path, schema, { headers: { cookie }, cache: "no-store" });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/");
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export const getReviews = (q: ReviewQuery) =>
  adminGet(
    href("/v1/admin/reviews", {
      status: q.status,
      origin: q.origin,
      page: q.page,
      size: PAGE_SIZE,
    }),
    reviewPageSchema,
  );

/** 상태 칸마다 건수(같은 출처 거르기 안에서). 건수만 필요해 한 줄씩만 받는다 */
export async function getReviewCounts(origin: ReviewQuery["origin"]) {
  const totals = await Promise.all(
    statusTabs.map((status) =>
      adminGet(href("/v1/admin/reviews", { status, origin, size: 1 }), reviewPageSchema).then(
        (p) => p.total,
      ),
    ),
  );
  return Object.fromEntries(statusTabs.map((s, i) => [s, totals[i]])) as Record<
    (typeof statusTabs)[number],
    number
  >;
}

export const getReview = (id: string) =>
  adminGet(`/v1/admin/reviews/${encodeURIComponent(id)}`, reviewDetailSchema);

/** 변경 이력 전체 건수(탭 숫자) */
export const getChangeTotal = () =>
  adminGet(href("/v1/admin/changes", { size: 1 }), changePageSchema).then((p) => p.total);

export const getChanges = (q: ChangeQuery) =>
  adminGet(
    href("/v1/admin/changes", { action: q.action, page: q.page, size: PAGE_SIZE }),
    changePageSchema,
  );
