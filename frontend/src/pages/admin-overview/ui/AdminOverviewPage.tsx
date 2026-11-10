import Link from "next/link";
import { Suspense } from "react";

import { monthDay, monthDayTime, num } from "@/shared/lib/format";
import { type SearchParams } from "@/shared/lib/url";
import { StatusBadge } from "@/shared/ui/badge";
import { Icon, type IconName } from "@/shared/ui/icon";
import { SegmentLinks } from "@/shared/ui/segment";

import { getOverview } from "../api/getOverview";
import { daysOf, jobBadge, type PeriodDays, periodDays, storageLabel } from "../model/labels";
import type { Overview, SourceStatus } from "../model/schema";

// /admin — 07 · 운영 요약(Figma 2374:6586). 관리자 첫 화면. 들어오는 것은 AdminLayout 이 ADMIN 만 통과시킨다.
// 값은 모두 GET /v1/admin/overview. Figma 초안 맨 위 「자동 채움률 · 검수 수정 · 정답 일치율」 은 이 API 에 없어
// (실행 비교 · 정답 세트가 필요) 기간 안 처리 건수로 바꿨다. 대기 칸 · 출처 줄은 그 화면(카드 승인 · CSV 적재 · 수집 이력)으로 잇는다

export function AdminOverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="flex h-full flex-col gap-4 overflow-y-auto bg-bg-app px-7 pt-6 pb-10">
      <Suspense
        fallback={<p className="text-body-13 text-text-3">운영 요약을 불러오는 중이에요</p>}
      >
        <OverviewContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OverviewContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const days = daysOf((await searchParams).days);
  const o = await getOverview(days);
  const { reviews, approvals, imports } = o.current_queues;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-heading-24 text-text-1">운영 요약</h1>
        <PeriodTabs days={days} />
      </header>

      {/* 위 세 칸은 기간과 상관없는 지금 상태(완료 상태는 누적), 아래 「최근 N일 처리」는 기간 안 기록이라
          같은 「보류」라도 수가 다를 수 있다(계약 operations) — 그래서 「지금」 · 「누적」을 붙인다 */}
      <div className="grid grid-cols-3 gap-3">
        <QueueCard
          icon="shield"
          title="검수 대기"
          value={reviews.pending}
          sub={`지금 보류 ${reviews.on_hold} · 승인 대기 ${reviews.approval_pending}`}
          href="/admin/reviews"
        />
        <QueueCard
          icon="cards"
          title="카드 승인 대기"
          value={approvals.pending}
          sub={`지금 보류 ${approvals.on_hold} · 누적 승인 ${approvals.approved} · 반려 ${approvals.rejected}`}
          href="/admin/cards"
        />
        <QueueCard
          icon="db"
          title="CSV 적재 대기"
          value={imports.pending}
          sub={`누적 검증 실패 ${imports.validation_failed} · 실패 ${imports.failed} · 완료 보고 ${imports.completed}`}
          href="/admin/sources/imports?status=pending"
        />
      </div>

      <Activity overview={o} days={days} />

      <div className="grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start gap-3">
        <Inventory overview={o} />
        <Sources sources={o.source_statuses} />
      </div>
    </>
  );
}

function PeriodTabs({ days }: { days: PeriodDays }) {
  return (
    <SegmentLinks
      label="기간"
      items={periodDays.map((d) => ({
        key: String(d),
        label: `최근 ${d}일`,
        href: d === 7 ? "/admin" : `/admin?days=${d}`,
        active: days === d,
      }))}
    />
  );
}

const card = "rounded-xl border border-border-1 bg-surface-1";

function QueueCard({
  icon,
  title,
  value,
  sub,
  href,
}: {
  icon: IconName;
  title: string;
  value: number;
  sub: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
        <Icon name={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label-13 text-text-1">{title}</span>
        <span className="truncate text-caption-12 text-text-3">{sub}</span>
      </span>
      <span className="text-heading-24 text-text-1 tabular-nums">{num(value)}</span>
      {href && <Icon name="chevronRight" className="size-4 text-text-3" />}
    </>
  );
  const cls = `${card} flex items-center gap-3 px-4 py-3.5`;
  return href ? (
    <Link href={href} className={`${cls} hover:bg-surface-2`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** 기간 안 처리 기록. 항목끼리 더해 자료 건수로 쓰지 않는다(계약). 검수 「수정」은 초안 저장 · 승인 요청이지 적용 완료가 아니다 */
function Activity({ overview: o, days }: { overview: Overview; days: PeriodDays }) {
  const a = o.period_activity;
  const groups: { title: string; items: [string, number][] }[] = [
    {
      title: "검수 처리",
      items: [
        ["확정", a.review_decisions.confirm],
        ["수정 요청", a.review_decisions.correct],
        ["보류", a.review_decisions.hold],
        ["반려", a.review_decisions.reject],
      ],
    },
    {
      title: "카드 승인 결정",
      items: [
        ["승인", a.approval_decisions.approve],
        ["보류", a.approval_decisions.hold],
        ["반려", a.approval_decisions.reject],
      ],
    },
    {
      title: "CSV 결과 보고",
      items: [
        ["완료", a.import_results.completed],
        ["실패", a.import_results.failed],
      ],
    },
    {
      title: "수집 작업 시작",
      items: [
        ["성공", a.jobs_started.ok],
        ["실패", a.jobs_started.failed],
        ["중단", a.jobs_started.aborted],
        ["끝 기록 없음", a.jobs_started.running],
      ],
    },
  ];
  return (
    <section aria-label={`최근 ${days}일 처리`} className={`${card} flex flex-col gap-3 p-4`}>
      <h2 className="text-heading-16 text-text-1">
        최근 {days}일 처리{" "}
        <span className="text-caption-12 text-text-3">
          {monthDay(o.period.from)} – {monthDay(o.period.to)}
        </span>
      </h2>
      <div className="grid grid-cols-4 gap-3">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label-13 text-text-1">{g.title}</span>
              <span className="text-heading-20 text-text-1 tabular-nums">
                {num(g.items.reduce((n, [, v]) => n + v, 0))}
              </span>
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption-12 text-text-2">
              {g.items.map(([label, v]) => (
                <li key={label}>
                  {label} <span className="text-text-1 tabular-nums">{num(v)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 자료 단계별 건수. 서로 다른 단계라 더하지 않는다 */
function Inventory({ overview: o }: { overview: Overview }) {
  const inv = o.current_inventory;
  const rows: [string, number][] = [
    ["원본", inv.raw_records],
    ["정제", inv.normalized_records],
    ["사용 가능", inv.ready_records],
  ];
  return (
    <section aria-label="수집 현황" className={`${card} flex flex-col gap-2 p-4`}>
      <h2 className="text-heading-16 text-text-1">수집 현황</h2>
      {rows.map(([label, v]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5"
        >
          <span className="text-body-13 text-text-1">{label}</span>
          <span className="text-title-14 text-text-1 tabular-nums">{num(v)}</span>
        </div>
      ))}
    </section>
  );
}

/** 출처별 최근 작업. 최신 작업 하나의 상태라 출처 전체가 정상인지 판정하지 않는다 */
function Sources({ sources }: { sources: SourceStatus[] }) {
  return (
    <section aria-label="출처 상태" className={`${card} overflow-hidden`}>
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
        <h2 className="text-heading-16 text-text-1">출처 상태</h2>
      </div>
      <ul>
        {sources.map((s) => (
          <li key={s.source_id} className="border-t border-border-1">
            {/* 줄을 누르면 그 출처의 수집 이력(/admin/sources/jobs?source=) */}
            <Link
              href={`/admin/sources/jobs?source=${encodeURIComponent(s.source_id)}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-13 text-text-1">
                  {s.name} <span className="text-caption-12 text-text-3">{s.source_id}</span>
                </span>
                <span className="truncate text-caption-12 text-text-3">
                  {[
                    s.storage_scope && (storageLabel[s.storage_scope] ?? s.storage_scope),
                    s.reliability_grade && `등급 ${s.reliability_grade}`,
                    `명세 ${s.spec_count}${s.never_run_spec_count ? ` (안 돈 것 ${s.never_run_spec_count})` : ""}`,
                    s.last_successful_at
                      ? `마지막 성공 ${monthDayTime(s.last_successful_at)}`
                      : "성공 기록 없음",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <StatusBadge tone={jobBadge[s.latest_job_status].tone}>
                {jobBadge[s.latest_job_status].label}
              </StatusBadge>
              <Icon name="chevronRight" className="size-4 text-text-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
