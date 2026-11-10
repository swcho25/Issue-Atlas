import Link from "next/link";
import { Suspense } from "react";

import { getAdmins } from "@/entities/admin-user";
import { monthDay, monthDayTime } from "@/shared/lib/format";
import type { SearchParams } from "@/shared/lib/url";
import { StatusBadge } from "@/shared/ui/badge";
import { buttonClass } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Pager } from "@/shared/ui/pager";
import { SegmentLinks } from "@/shared/ui/segment";

import { getImports, getLatestJobs, getMe, getSources } from "../api/server";
import { importBadge, jobBadge } from "../model/labels";
import { PAGE_SIZE, type SourcesQuery, sourcesHref, sourcesQuery } from "../model/query";
import { ImportPanel } from "./ImportPanel";
import { SourcePanel } from "./SourcePanel";

// /admin/sources — 07 · 데이터 소스 한 화면. 왼쪽은 「출처 · CSV 요청」 전환과 목록, 오른쪽은 고른 줄의 상세
// (카드 승인 · 검수와 같은 구조). 출처 보기의 오른쪽은 수집 기록(고른 출처가 없으면 전체), CSV 요청 보기의 오른쪽은
// 고른 요청 · 올리기 양식 · 내 차례(내가 반영 담당자인 반영 대기). 상태는 모두 주소에 둔다
export function AdminSourcesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <main className="h-full bg-bg-app">
      <Suspense
        fallback={
          <p className="px-7 pt-6 text-body-13 text-text-3">데이터 소스를 불러오는 중이에요</p>
        }
      >
        <SourcesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SourcesContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = sourcesQuery(await searchParams);
  const [sources, me, all] = await Promise.all([
    getSources(),
    getMe(),
    getImports({ page: 1, size: 1 }),
  ]);
  const mine = await getImports({ status: "pending", assignee: me.id, page: 1, size: 1 });
  return (
    <div className="flex h-full">
      <aside className="flex w-90 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-1 px-6 pt-6 pb-8">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-heading-24 text-text-1">데이터 소스</h1>
          <Link href={sourcesHref({ view: "imports", isNew: true })} className={buttonClass()}>
            <Icon name="plus" />
            CSV 올리기
          </Link>
        </header>
        <SegmentLinks
          label="보기"
          items={[
            {
              key: "sources",
              label: "출처",
              count: sources.length,
              href: sourcesHref({}),
              active: q.view === "sources",
            },
            {
              key: "imports",
              label: "CSV 요청",
              count: all.total,
              href: sourcesHref({ view: "imports" }),
              active: q.view === "imports",
            },
          ]}
        />
        {q.view === "sources" ? (
          <SourceList sources={sources} q={q} />
        ) : (
          <Suspense
            fallback={<p className="text-body-13 text-text-3">CSV 요청을 불러오는 중이에요</p>}
          >
            <ImportList q={q} meId={me.id} mineTotal={mine.total} allTotal={all.total} />
          </Suspense>
        )}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-7 pt-6 pb-10 *:shrink-0">
        <Suspense
          key={`${q.view}:${q.source ?? q.id ?? (q.isNew ? "new" : "")}`}
          fallback={<p className="text-body-13 text-text-3">불러오는 중이에요</p>}
        >
          {q.view === "sources" ? (
            <SourcePanel q={q} sources={sources} />
          ) : (
            <ImportPanel q={q} me={me} />
          )}
        </Suspense>
      </section>
    </div>
  );
}

const itemClass = (active: boolean) =>
  `flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
    active
      ? "border-primary-line bg-primary-soft"
      : "border-border-1 bg-surface-1 hover:bg-surface-2"
  }`;

/** 출처 목록: 이름 · 기관 · 등급 + 가장 최근 수집 실행. 다시 누르면 고른 것을 푼다(전체 수집 기록) */
async function SourceList({
  sources,
  q,
}: {
  sources: Awaited<ReturnType<typeof getSources>>;
  q: SourcesQuery;
}) {
  const latest = await getLatestJobs(sources.map((s) => s.source_id));
  if (sources.length === 0) return <p className="py-6 text-body-13 text-text-3">출처 없음</p>;
  return (
    <ul className="flex flex-col gap-2">
      {sources.map((s) => {
        const job = latest[s.source_id];
        const active = q.source === s.source_id;
        return (
          <li key={s.source_id}>
            <Link
              href={sourcesHref({ source: active ? null : s.source_id, status: q.status })}
              aria-current={active ? "true" : undefined}
              className={itemClass(active)}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-label-14 truncate text-text-1">{s.name}</span>
                <span className="truncate text-caption-12 text-text-3">
                  {s.org}
                  {s.source_grade && ` · 등급 ${s.source_grade}`}
                </span>
              </span>
              {job ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge tone={jobBadge[job.status].tone}>
                    {jobBadge[job.status].label}
                  </StatusBadge>
                  <span className="text-caption-11 text-text-3">
                    {monthDayTime(job.started_at)}
                  </span>
                </span>
              ) : (
                <span className="shrink-0 text-caption-12 text-text-3">기록 없음</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** CSV 요청 목록(올린 순): 「전체 · 내 차례」. 내 차례 = 내가 반영 담당자인 반영 대기 */
async function ImportList({
  q,
  meId,
  mineTotal,
  allTotal,
}: {
  q: SourcesQuery;
  meId: number;
  mineTotal: number;
  allTotal: number;
}) {
  const [list, admins] = await Promise.all([
    getImports(q.mine ? { status: "pending", assignee: meId, page: q.page } : { page: q.page }),
    getAdmins(),
  ]);
  const who = (id: number) =>
    `${admins.find((u) => u.id === id)?.name ?? `#${id}`}${id === meId ? " (나)" : ""}`;
  return (
    <>
      <SegmentLinks
        label="요청 거르기"
        items={[
          {
            key: "all",
            label: "전체",
            count: allTotal,
            href: sourcesHref({ view: "imports", id: q.id }),
            active: !q.mine,
          },
          {
            key: "mine",
            label: "내 차례",
            count: mineTotal,
            href: sourcesHref({ view: "imports", id: q.id, mine: true }),
            active: q.mine,
          },
        ]}
      />
      {list.items.length === 0 ? (
        <p className="py-6 text-body-13 text-text-3">
          {q.mine ? "내 차례인 요청 없음" : "CSV 요청 없음"}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.items.map((r) => {
            const active = q.id === r.import_id;
            return (
              <li key={r.import_id}>
                <Link
                  href={sourcesHref({
                    view: "imports",
                    id: r.import_id,
                    mine: q.mine,
                    page: q.page,
                  })}
                  aria-current={active ? "true" : undefined}
                  className={itemClass(active)}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-label-14 truncate text-text-1">{r.file_name}</span>
                    <span className="truncate text-caption-12 text-text-3">
                      {who(r.requested_by)} → {who(r.assignee_id)} · {monthDay(r.created_at)}
                    </span>
                  </span>
                  <StatusBadge tone={importBadge[r.status].tone}>
                    {importBadge[r.status].label}
                  </StatusBadge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pager
        page={q.page}
        size={PAGE_SIZE}
        total={list.total}
        hrefFor={(page) => sourcesHref({ view: "imports", mine: q.mine, page })}
      />
    </>
  );
}
