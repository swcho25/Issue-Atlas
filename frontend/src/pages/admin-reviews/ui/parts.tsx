import { href } from "@/shared/lib/url";
import { SegmentLinks } from "@/shared/ui/segment";

import { statusBadge } from "../model/labels";
import { statusTabs } from "../model/query";
import type { ReviewStatus } from "../model/schema";

// 검수 화면들이 함께 쓰는 위쪽 탭 줄

/** 위쪽 탭: 상태 다섯 칸(건수) + 변경 이력. 출처 거르기는 상태 칸을 오가도 그대로 둔다 */
export function ReviewsNav({
  current,
  counts,
  changeTotal,
  origin,
}: {
  current: ReviewStatus | "changes";
  counts: Record<ReviewStatus, number>;
  changeTotal: number;
  origin?: string | null;
}) {
  return (
    <SegmentLinks
      label="검수 상태"
      items={[
        ...statusTabs.map((s) => ({
          key: s,
          label: statusBadge[s].label,
          count: counts[s],
          href: href("/admin/reviews", { status: s === "pending" ? null : s, origin }),
          active: current === s,
        })),
        {
          key: "changes",
          label: "변경 이력",
          count: changeTotal,
          href: "/admin/reviews/changes",
          active: current === "changes",
        },
      ]}
    />
  );
}
