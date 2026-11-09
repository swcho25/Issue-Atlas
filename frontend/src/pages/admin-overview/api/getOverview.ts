import { adminGet } from "@/shared/server";

import type { PeriodDays } from "../model/labels";
import { overviewSchema } from "../model/schema";

// 운영 요약(서버 전용). 7일은 계약 기본값이라 기간을 보내지 않는다
export function getOverview(days: PeriodDays) {
  const query =
    days === 7
      ? ""
      : `?from=${encodeURIComponent(new Date(Date.now() - days * 86_400_000).toISOString())}`;
  return adminGet(`/v1/admin/overview${query}`, overviewSchema);
}
