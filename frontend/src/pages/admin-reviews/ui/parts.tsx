import Link from "next/link";

import { statusBadge } from "../model/labels";
import { href, statusTabs } from "../model/query";
import type { ReviewStatus } from "../model/schema";

// 검수 화면들이 함께 쓰는 조각: 링크 탭(주소가 상태) · 쪽 넘기기 · 위쪽 탭 줄

type SegmentItem = { key: string; label: string; count?: number; href: string; active: boolean };

/** 내 질문의 탭과 같은 모양(회색 틀 · 고른 칸 흰색 · 개수). 칸은 링크라 주소가 바뀐다 */
export function SegmentLinks({ label, items }: { label: string; items: SegmentItem[] }) {
  return (
    <nav aria-label={label} className="inline-flex w-fit gap-0.5 rounded-lg bg-surface-2 p-0.75">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex h-7.5 items-center gap-1.5 rounded-md px-3 text-label-13 whitespace-nowrap ${
            t.active ? "bg-surface-1 text-text-1 shadow-xs" : "text-text-2 hover:text-text-1"
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="text-caption-11 text-text-3">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

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

export function Pager({
  page,
  size,
  total,
  hrefFor,
}: {
  page: number;
  size: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const last = Math.max(1, Math.ceil(total / size));
  if (last <= 1) return null;
  const step = "rounded-md px-2.5 py-1 text-label-13";
  return (
    <nav
      aria-label="쪽"
      className="flex items-center justify-center gap-3 text-body-13 text-text-2"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${step} hover:bg-surface-2`}>
          이전
        </Link>
      ) : (
        <span className={`${step} text-text-3`}>이전</span>
      )}
      <span>
        {page} / {last}
      </span>
      {page < last ? (
        <Link href={hrefFor(page + 1)} className={`${step} hover:bg-surface-2`}>
          다음
        </Link>
      ) : (
        <span className={`${step} text-text-3`}>다음</span>
      )}
    </nav>
  );
}

/** 표 틀(Figma 07: 모서리 12 · 테두리 · 머리 줄 surface-2) */
export const tableBox =
  "w-full overflow-hidden rounded-xl border border-border-1 bg-surface-1 text-left";
export const headRow = "bg-surface-2 text-caption-11 text-text-3";
export const headCell = "px-4 py-2.5 font-normal";
export const bodyCell = "px-4 py-3 align-middle";
