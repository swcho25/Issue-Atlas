import Link from "next/link";
import { Suspense } from "react";

import { dateTime } from "@/shared/lib/format";
import { href, type SearchParams } from "@/shared/lib/url";
import { StatusBadge } from "@/shared/ui/badge";
import { Pager } from "@/shared/ui/pager";
import { SegmentLinks } from "@/shared/ui/segment";
import { table } from "@/shared/ui/table";

import { getChanges, getReviewCounts } from "../api/server";
import { actionLabel, fieldLabel, flatValues, scopeLabel, targetLabel } from "../model/labels";
import { changeQuery, PAGE_SIZE } from "../model/query";
import { type Change, changeActions } from "../model/schema";
import { ReviewsNav } from "./parts";

// /admin/reviews/changes — 07 · 변경 이력(Figma 2374:7220). 검수 처리와 카드 최종 승인이 한 줄에 모인다(GET /v1/admin/changes).
// 「반영」 칸(2회차 반영 여부)은 API 에 없어 두지 않는다
export function AdminChangesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="flex h-full flex-col gap-4 overflow-y-auto bg-bg-app px-7 pt-6 pb-10">
      <h1 className="text-heading-24 text-text-1">변경 이력</h1>
      <Suspense
        fallback={<p className="text-body-13 text-text-3">변경 이력을 불러오는 중이에요</p>}
      >
        <ChangesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const actionTone = {
  confirm: "green",
  correct: "primary",
  hold: "gray",
  reject: "red",
  approve: "blue",
} as const;

async function ChangesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = changeQuery(await searchParams);
  const [list, counts] = await Promise.all([getChanges(q), getReviewCounts(null)]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReviewsNav current="changes" counts={counts} changeTotal={list.total} />
        <SegmentLinks
          label="처리 종류"
          items={[null, ...changeActions].map((a) => ({
            key: a ?? "all",
            label: a ? actionLabel[a] : "전체",
            href: href("/admin/reviews/changes", { action: a }),
            active: q.action === a,
          }))}
        />
      </div>
      {list.items.length === 0 ? (
        <p className="rounded-xl border border-border-1 px-4 py-10 text-center text-body-13 text-text-3">
          변경 이력 없음
        </p>
      ) : (
        <div className={table.wrap}>
          <table className={table.box}>
            <colgroup>
              <col className="w-36" />
              <col className="w-52" />
              <col className="w-56" />
              <col className="w-28" />
              <col className="w-28" />
              <col />
            </colgroup>
            <thead className={table.headRow}>
              <tr>
                <th className={table.headCell}>시각</th>
                <th className={table.headCell}>처리자</th>
                <th className={table.headCell}>대상</th>
                <th className={table.headCell}>처리</th>
                <th className={table.headCell}>적용 범위</th>
                <th className={table.headCell}>사유 · 바뀐 칸</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((c) => (
                <ChangeRow key={c.change_id} change={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={q.page}
        size={PAGE_SIZE}
        total={list.total}
        hrefFor={(page) => href("/admin/reviews/changes", { action: q.action, page })}
      />
    </>
  );
}

/** 전후가 다른 칸 이름(카드 최종 승인은 이전 값이 비어 있어 「승인한 카드」로만) */
function changedFields(c: Change) {
  if (c.action === "approve") return [];
  const before = new Map(flatValues(c.before_value));
  return flatValues(c.after_value)
    .filter(([k, v]) => before.get(k) !== v)
    .map(([k]) => fieldLabel(k));
}

function ChangeRow({ change: c }: { change: Change }) {
  const fields = changedFields(c);
  const target = (
    <>
      {targetLabel[c.target_type]} {c.target_id}
    </>
  );
  return (
    <tr className="border-t border-border-1 text-body-13">
      <td className={`${table.bodyCell} text-text-2`}>{dateTime(c.created_at)}</td>
      <td className={`${table.bodyCell} truncate text-text-2`}>{c.actor_email}</td>
      <td className={`${table.bodyCell} truncate`}>
        {c.review_id ? (
          <Link
            href={`/admin/reviews/${encodeURIComponent(c.review_id)}`}
            className="text-text-1 hover:underline"
          >
            {target}
          </Link>
        ) : (
          <span className="text-text-1">{target}</span>
        )}
      </td>
      <td className={table.bodyCell}>
        <StatusBadge tone={actionTone[c.action]}>{actionLabel[c.action]}</StatusBadge>
      </td>
      <td className={`${table.bodyCell} text-text-2`}>{scopeLabel[c.scope]}</td>
      <td className={table.bodyCell}>
        <p className="truncate text-text-1">{c.reason}</p>
        {fields.length > 0 && (
          <p className="truncate text-caption-12 text-text-3">바뀐 칸: {fields.join(" · ")}</p>
        )}
      </td>
    </tr>
  );
}
