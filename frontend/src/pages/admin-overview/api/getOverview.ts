import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError, apiGet } from "@/shared/api";

import type { PeriodDays } from "../model/labels";
import { overviewSchema } from "../model/schema";

// 운영 요약(서버 전용). 관리자 세션 쿠키(JSESSIONID)를 그대로 실어 부른다(AdminLayout 과 같은 방법).
// 그 사이 세션이 끝났거나 관리자가 아니면(401 · 403) 랜딩으로. 7일은 계약 기본값이라 기간을 보내지 않는다
export async function getOverview(days: PeriodDays) {
  const cookie = (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const query =
    days === 7
      ? ""
      : `?from=${encodeURIComponent(new Date(Date.now() - days * 86_400_000).toISOString())}`;
  try {
    return await apiGet(`/v1/admin/overview${query}`, overviewSchema, {
      headers: { cookie },
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect("/");
    throw e;
  }
}
