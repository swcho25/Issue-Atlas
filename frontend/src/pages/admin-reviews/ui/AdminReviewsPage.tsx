import Link from "next/link";
import { Suspense } from "react";

import { StatusBadge } from "@/shared/ui/badge";

import { getChangeTotal, getReviewCounts, getReviews } from "../api/server";
import {
  dateTime,
  issueLabel,
  originLabel,
  statusBadge,
  targetMeta,
  targetTitle,
} from "../model/labels";
import { href, originTabs, PAGE_SIZE, reviewQuery, type SearchParams } from "../model/query";
import type { Review } from "../model/schema";
import {
  bodyCell,
  headCell,
  headRow,
  Pager,
  ReviewsNav,
  SegmentLinks,
  tableBox,
  tableWrap,
} from "./parts";

// /admin/reviews — 07 · 검수 목록(Figma 2374:6701). 상태 · 출처 · 쪽은 주소에 두고 서버에서 관리자 세션으로 받는다.
// Figma 초안의 「AI 확신」 칸은 API 에 없어 두지 않고, 계약에 있는 사유 · 제안 · 날짜를 보인다
export function AdminReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="flex h-full flex-col gap-4 overflow-y-auto bg-bg-app px-7 pt-6 pb-10">
      <h1 className="text-heading-24 text-text-1">검수</h1>
      <Suspense
        fallback={<p className="text-body-13 text-text-3">검수 요청을 불러오는 중이에요</p>}
      >
        <ReviewsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ReviewsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = reviewQuery(await searchParams);
  const [list, counts, changeTotal] = await Promise.all([
    getReviews(q),
    getReviewCounts(q.origin),
    getChangeTotal(),
  ]);
  const status = q.status === "pending" ? null : q.status;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReviewsNav
          current={q.status}
          counts={counts}
          changeTotal={changeTotal}
          origin={q.origin}
        />
        <SegmentLinks
          label="요청 출처"
          items={originTabs.map((o) => ({
            key: o ?? "all",
            label: o ? originLabel[o] : "전체",
            href: href("/admin/reviews", { status, origin: o }),
            active: q.origin === o,
          }))}
        />
      </div>
      {list.items.length === 0 ? (
        <p className="rounded-xl border border-border-1 px-4 py-10 text-center text-body-13 text-text-3">
          {statusBadge[q.status].label} 요청 없음
        </p>
      ) : (
        <ReviewTable reviews={list.items} />
      )}
      <Pager
        page={q.page}
        size={PAGE_SIZE}
        total={list.total}
        hrefFor={(page) => href("/admin/reviews", { status, origin: q.origin, page })}
      />
    </>
  );
}

const proposal = (r: Review) => {
  if (!r.proposed_value) return "—";
  const entries = Object.entries(r.proposed_value);
  return (
    entries.map(([, v]) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(" · ") ||
    "—"
  );
};

function ReviewTable({ reviews }: { reviews: Review[] }) {
  return (
    <div className={tableWrap}>
      <table className={tableBox}>
        <colgroup>
          <col className="w-24" />
          <col />
          <col className="w-28" />
          <col className="w-56" />
          <col className="w-44" />
          <col className="w-24" />
          <col className="w-36" />
        </colgroup>
        <thead className={headRow}>
          <tr>
            <th className={headCell}>문제</th>
            <th className={headCell}>대상</th>
            <th className={headCell}>출처</th>
            <th className={headCell}>사유</th>
            <th className={headCell}>수정 제안</th>
            <th className={headCell}>상태</th>
            <th className={headCell}>등록</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((r) => (
            <tr
              key={r.review_id}
              className="relative border-t border-border-1 text-body-13 hover:bg-surface-2"
            >
              <td className={`${bodyCell} text-text-1`}>{issueLabel[r.issue_type]}</td>
              <td className={bodyCell}>
                {/* 줄 전체를 누르면 상세(링크는 제목 하나, 나머지 칸은 덮개로) */}
                <Link
                  href={`/admin/reviews/${encodeURIComponent(r.review_id)}`}
                  className="block truncate text-text-1 after:absolute after:inset-0 focus-visible:underline"
                >
                  {targetTitle(r.target_type, r.target_id, r.submitted_value)}
                </Link>
                <span className="block truncate text-caption-12 text-text-3">
                  {targetMeta(r.target_type, r.target_id, r.submitted_value)}
                </span>
              </td>
              <td className={`${bodyCell} text-text-2`}>{originLabel[r.origin]}</td>
              <td className={`${bodyCell} truncate text-text-2`}>{r.reason}</td>
              <td className={`${bodyCell} truncate text-text-2`}>{proposal(r)}</td>
              <td className={bodyCell}>
                <StatusBadge tone={statusBadge[r.status].tone}>
                  {statusBadge[r.status].label}
                </StatusBadge>
              </td>
              <td className={`${bodyCell} text-text-3`}>{dateTime(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
