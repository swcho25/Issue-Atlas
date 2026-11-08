import Link from "next/link";
import { Suspense } from "react";

import { dateTime } from "@/shared/lib/format";
import { StatusBadge } from "@/shared/ui/badge";
import { BackIcon, backButtonClass } from "@/shared/ui/button";

import { getReview } from "../api/server";
import {
  actionLabel,
  fieldLabel,
  flatValues,
  issueLabel,
  originLabel,
  scopeLabel,
  statusBadge,
  targetLabel,
  targetTitle,
} from "../model/labels";
import type { Change, ReviewDetail } from "../model/schema";
import { DecisionPanel } from "./DecisionPanel";

// /admin/reviews/[id] — 07 · 검수 상세 + 처리(Figma 2374:6857). 왼쪽은 대상 · 사유 · 값 비교 · 제안 · 이력, 오른쪽은 처리 패널.
// 상세는 서버에서 관리자 세션으로 받고, 처리하면 DecisionPanel 이 router.refresh 로 다시 받는다
export function AdminReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="h-full bg-bg-app">
      <Suspense
        fallback={
          <p className="px-7 pt-6 text-body-13 text-text-3">검수 요청을 불러오는 중이에요</p>
        }
      >
        <DetailContent params={params} />
      </Suspense>
    </main>
  );
}

async function DetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getReview(decodeURIComponent(id));
  const r = detail.request;
  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-7 pt-6 pb-10">
        <div className="flex items-center gap-3">
          <Link href="/admin/reviews" aria-label="검수 목록" className={backButtonClass()}>
            <BackIcon />
          </Link>
          <span className="text-body-13 text-text-3">검수 목록</span>
        </div>
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={statusBadge[r.status].tone}>
              {statusBadge[r.status].label}
            </StatusBadge>
            <StatusBadge tone="primary">{issueLabel[r.issue_type]}</StatusBadge>
            <StatusBadge tone="gray">{originLabel[r.origin]}</StatusBadge>
          </div>
          <h1 className="text-heading-24 text-text-1">
            {targetTitle(r.target_type, r.target_id, r.submitted_value)}
          </h1>
          <p className="text-body-13 text-text-3">
            {targetLabel[r.target_type]} {r.target_id}
            {r.card_id && ` · 카드 ${r.card_id}`} · 등록 {dateTime(r.created_at)} · 수정 번호{" "}
            {r.revision}
          </p>
        </header>

        <Block title="사유">
          <p className="text-body-14 whitespace-pre-wrap text-text-1">{r.reason}</p>
        </Block>

        <ValueCompare detail={detail} />

        {r.proposed_value && (
          <Block title="수정 제안" note="보관 · 자료에 미적용">
            <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1.5 text-body-13">
              {flatValues(r.proposed_value).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-text-3">{fieldLabel(k)}</dt>
                  <dd className="break-all text-text-1">{v}</dd>
                </div>
              ))}
            </dl>
          </Block>
        )}

        <Block title="처리 이력">
          {detail.decisions.length === 0 ? (
            <p className="text-body-13 text-text-3">처리 이력 없음</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {detail.decisions.map((c) => (
                <DecisionRow key={c.change_id} change={c} />
              ))}
            </ol>
          )}
        </Block>
      </section>
      <DecisionPanel key={r.revision} detail={detail} />
    </div>
  );
}

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-2 p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-label-13 text-text-1">{title}</h2>
        {note && <p className="text-caption-12 text-text-3">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** 요청 당시 값과 지금 값을 칸마다 나란히. 달라진 칸은 앰버 글자로 */
function ValueCompare({ detail }: { detail: ReviewDetail }) {
  const { request: r, current_value } = detail;
  const before = new Map(flatValues(r.submitted_value, r.target_type));
  const now = new Map(flatValues(current_value, r.target_type));
  const keys = [...new Set([...before.keys(), ...now.keys()])];
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label-13 text-text-1">
        값{" "}
        <span className="text-caption-12 text-text-3">· 적용 범위 {scopeLabel[detail.scope]}</span>
      </h2>
      <table className="w-full table-fixed overflow-hidden rounded-xl border border-border-1 text-left text-body-13">
        <colgroup>
          <col className="w-44" />
          <col />
          <col />
        </colgroup>
        <thead className="bg-surface-2 text-caption-11 text-text-3">
          <tr>
            <th className="px-4 py-2 font-normal">칸</th>
            <th className="px-4 py-2 font-normal">요청 당시</th>
            <th className="px-4 py-2 font-normal">지금</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const a = before.get(k) ?? "—";
            const b = now.get(k) ?? "—";
            return (
              <tr key={k} className="border-t border-border-1 align-top">
                <th scope="row" className="px-4 py-2 font-normal text-text-3">
                  {fieldLabel(k)}
                </th>
                <td className="px-4 py-2 break-all text-text-2">{a}</td>
                <td
                  className={`px-4 py-2 break-all ${a === b ? "text-text-2" : "text-primary-text"}`}
                >
                  {b}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function DecisionRow({ change: c }: { change: Change }) {
  return (
    <li className="flex flex-col gap-0.5 border-l-2 border-border-2 pl-3">
      <p className="text-body-13 text-text-1">
        {actionLabel[c.action]} · {scopeLabel[c.scope]}
        <span className="text-text-3">
          {" "}
          · {c.actor_email} · {dateTime(c.created_at)}
        </span>
      </p>
      <p className="text-body-13 text-text-2">{c.reason}</p>
    </li>
  );
}
